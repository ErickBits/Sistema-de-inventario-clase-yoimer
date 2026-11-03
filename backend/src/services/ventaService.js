const mongoose = require('mongoose');
const { Producto, Cliente, Venta, Factura, Pago, Auditoria, Contador } = require('../models');
const { ESTADOS_ENVIO } = require('../models/Venta');
const AppError = require('../utils/AppError');
const { redondear } = require('../utils/dinero');

/**
 * Ejecuta `fn` dentro de una transacción de MongoDB.
 *
 * `session.withTransaction` reintenta automáticamente ante
 * `TransientTransactionError` (p.ej. WriteConflict cuando dos ventas tocan el
 * mismo producto a la vez) y ante `UnknownTransactionCommitResult`.
 * Cualquier otro error (incluidos nuestros AppError) aborta y hace rollback.
 */
async function enTransaccion(fn) {
  const session = await mongoose.startSession();
  try {
    let resultado;
    await session.withTransaction(async () => {
      resultado = await fn(session); // se reasigna en cada reintento
    });
    return resultado;
  } finally {
    await session.endSession();
  }
}

/**
 * Valida y normaliza las líneas de la venta (regla 4: sin cantidades negativas).
 * Agrupa productos repetidos para validar el stock contra la cantidad TOTAL.
 */
function normalizarItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'La venta debe incluir al menos un producto');
  }
  const agrupado = new Map();
  for (const [i, item] of items.entries()) {
    const cantidad = Number(item?.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new AppError(400, `Línea ${i + 1}: la cantidad debe ser un entero mayor que 0`);
    }
    if (!mongoose.isValidObjectId(item.producto_id)) {
      throw new AppError(400, `Línea ${i + 1}: producto_id inválido`);
    }
    const id = String(item.producto_id);
    agrupado.set(id, (agrupado.get(id) ?? 0) + cantidad);
  }
  return [...agrupado].map(([producto_id, cantidad]) => ({ producto_id, cantidad }));
}

/**
 * RF: Procesar una venta.
 *
 * Todo ocurre en UNA transacción: descuento de stock de cada producto,
 * creación de la venta, emisión de la factura y auditoría. Si cualquier línea
 * falla (p.ej. stock insuficiente en el 3er producto), se revierte todo y el
 * inventario queda exactamente como estaba.
 *
 * @param {{cliente_id: string, items: {producto_id: string, cantidad: number}[], vendedor?: string}} datos
 */
async function crearVenta({ cliente_id, items, vendedor = 'sistema' }) {
  const lineas = normalizarItems(items);
  if (!mongoose.isValidObjectId(cliente_id)) throw new AppError(400, 'cliente_id inválido');

  return enTransaccion(async (session) => {
    const cliente = await Cliente.findById(cliente_id).session(session);
    if (!cliente) throw new AppError(404, 'Cliente no encontrado');

    const detalles = [];
    const movimientos = [];

    for (const { producto_id, cantidad } of lineas) {
      // Reglas 1, 2 y 5: VALIDAR y DESCONTAR en una sola operación atómica.
      // El filtro `stock >= cantidad` lo evalúa el servidor junto con el $inc,
      // así que es imposible que el stock quede negativo, sin importar cuántos
      // vendedores compren a la vez. `__v` se incrementa para que cualquier
      // edición concurrente del producto (optimistic locking) lo detecte.
      const producto = await Producto.findOneAndUpdate(
        { _id: producto_id, stock: { $gte: cantidad } },
        { $inc: { stock: -cantidad, __v: 1 } },
        { returnDocument: 'after', session }
      );

      if (!producto) {
        // Distinguir "no existe" de "no alcanza" para dar un error útil.
        const actual = await Producto.findById(producto_id).select('nombre stock').session(session);
        if (!actual) throw new AppError(404, `Producto ${producto_id} no encontrado`);
        throw new AppError(
          409,
          `Stock insuficiente para "${actual.nombre}": disponible ${actual.stock}, solicitado ${cantidad}`,
          { producto_id, disponible: actual.stock, solicitado: cantidad }
        );
      }

      // El precio SIEMPRE se toma de la BD, nunca del cliente HTTP.
      const subtotal = redondear(producto.precio * cantidad);
      detalles.push({ producto_id: producto._id, nombre: producto.nombre, cantidad, precio: producto.precio, subtotal });
      movimientos.push({
        entidad: 'Producto',
        entidad_id: producto._id,
        accion: 'SALIDA_VENTA',
        cantidad,
        stock_anterior: producto.stock + cantidad,
        stock_nuevo: producto.stock,
        usuario: vendedor,
      });
    }

    // Regla 3: total = Σ subtotales de DetalleVenta.
    const total = redondear(detalles.reduce((acc, d) => acc + d.subtotal, 0));

    const [venta] = await Venta.create([{ cliente_id, detalles, total, vendedor }], { session });

    // Facturación automática con consecutivo atómico (también transaccional:
    // si la venta se revierte, el número no se "quema").
    const seq = await Contador.siguiente('factura', session);
    const [factura] = await Factura.create(
      [{ numero: `F-${String(seq).padStart(6, '0')}`, total, venta_id: venta._id, cliente_id }],
      { session }
    );

    await Auditoria.insertMany(
      [
        ...movimientos.map((m) => ({ ...m, referencia: venta._id })),
        { entidad: 'Venta', entidad_id: venta._id, accion: 'CREACION', detalle: { total, factura: factura.numero }, usuario: vendedor },
      ],
      { session }
    );

    return { venta, factura };
  });
}

/** RF: Registrar un pago (parcial o total). Al cubrir el total la venta pasa a "pagada". */
async function registrarPago(ventaId, { monto, metodo, usuario = 'sistema' }) {
  monto = redondear(Number(monto));
  if (!Number.isFinite(monto) || monto <= 0) throw new AppError(400, 'El monto debe ser un número mayor que 0');

  return enTransaccion(async (session) => {
    const venta = await Venta.findById(ventaId).session(session);
    if (!venta) throw new AppError(404, 'Venta no encontrada');
    if (venta.estado !== 'pendiente') throw new AppError(409, `No se puede pagar una venta ${venta.estado}`);

    const saldo = redondear(venta.total - venta.pagado);
    if (monto > saldo) throw new AppError(400, `El monto excede el saldo pendiente (${saldo})`);

    const [pago] = await Pago.create([{ venta_id: venta._id, monto, metodo }], { session });
    venta.pagado = redondear(venta.pagado + monto);
    if (venta.pagado >= venta.total) venta.estado = 'pagada';
    // Dos pagos simultáneos sobre la misma venta => WriteConflict => uno se
    // reintenta y vuelve a validar el saldo. Nunca se paga de más.
    await venta.save({ session });

    await Auditoria.create(
      [{ entidad: 'Pago', entidad_id: pago._id, accion: 'PAGO', referencia: venta._id, detalle: { monto, metodo: pago.metodo, saldo: redondear(venta.total - venta.pagado) }, usuario }],
      { session }
    );
    return { venta, pago };
  });
}

/** RF: Avanzar el estado de envío (sólo hacia el siguiente estado y sólo si está pagada). */
async function actualizarEnvio(ventaId, { estado_envio, usuario = 'sistema' }) {
  if (!ESTADOS_ENVIO.includes(estado_envio)) {
    throw new AppError(400, `estado_envio debe ser uno de: ${ESTADOS_ENVIO.join(', ')}`);
  }
  return enTransaccion(async (session) => {
    const venta = await Venta.findById(ventaId).session(session);
    if (!venta) throw new AppError(404, 'Venta no encontrada');
    if (venta.estado !== 'pagada') throw new AppError(409, 'Sólo se pueden despachar ventas pagadas');

    const actual = ESTADOS_ENVIO.indexOf(venta.estado_envio);
    if (ESTADOS_ENVIO.indexOf(estado_envio) !== actual + 1) {
      throw new AppError(409, `Transición inválida: ${venta.estado_envio} → ${estado_envio}`);
    }
    const anterior = venta.estado_envio;
    venta.estado_envio = estado_envio;
    await venta.save({ session });
    await Auditoria.create(
      [{ entidad: 'Venta', entidad_id: venta._id, accion: 'ENVIO', detalle: { de: anterior, a: estado_envio }, usuario }],
      { session }
    );
    return venta;
  });
}

/** Anula una venta no despachada: devuelve el stock y anula la factura. */
async function anularVenta(ventaId, { usuario = 'sistema' } = {}) {
  return enTransaccion(async (session) => {
    const venta = await Venta.findById(ventaId).session(session);
    if (!venta) throw new AppError(404, 'Venta no encontrada');
    if (venta.estado === 'anulada') throw new AppError(409, 'La venta ya está anulada');
    if (venta.estado_envio !== 'por_despachar') throw new AppError(409, 'No se puede anular una venta ya despachada');

    const movimientos = [];
    for (const d of venta.detalles) {
      const producto = await Producto.findOneAndUpdate(
        { _id: d.producto_id },
        { $inc: { stock: d.cantidad, __v: 1 } },
        { returnDocument: 'after', session }
      );
      if (!producto) continue; // el producto fue eliminado: no hay stock que reponer
      movimientos.push({
        entidad: 'Producto', entidad_id: producto._id, accion: 'ENTRADA_ANULACION', cantidad: d.cantidad,
        stock_anterior: producto.stock - d.cantidad, stock_nuevo: producto.stock, referencia: venta._id, usuario,
      });
    }

    venta.estado = 'anulada';
    await venta.save({ session });
    await Factura.updateOne({ venta_id: venta._id }, { estado: 'anulada' }, { session });
    await Auditoria.insertMany(
      [...movimientos, { entidad: 'Venta', entidad_id: venta._id, accion: 'ANULACION', usuario }],
      { session }
    );
    return venta;
  });
}

module.exports = { crearVenta, registrarPago, actualizarEnvio, anularVenta, enTransaccion, normalizarItems };
