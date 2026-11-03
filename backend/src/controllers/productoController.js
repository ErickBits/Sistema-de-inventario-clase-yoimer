const { Producto, Auditoria } = require('../models');
const { enTransaccion } = require('../services/ventaService');
const AppError = require('../utils/AppError');

const CAMPOS = ['nombre', 'precio', 'stock', 'categoria'];
const pick = (obj) => Object.fromEntries(CAMPOS.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** GET /api/productos?q=&categoria= */
exports.listar = async (req, res) => {
  const filtro = {};
  if (req.query.q) filtro.nombre = { $regex: escaparRegex(String(req.query.q)), $options: 'i' };
  if (req.query.categoria) filtro.categoria = String(req.query.categoria);
  res.json(await Producto.find(filtro).sort({ nombre: 1 }));
};

/** GET /api/productos/:id */
exports.obtener = async (req, res) => {
  const producto = await Producto.findById(req.params.id);
  if (!producto) throw new AppError(404, 'Producto no encontrado');
  res.json(producto);
};

/** POST /api/productos */
exports.crear = async (req, res) => {
  const producto = await enTransaccion(async (session) => {
    const [p] = await Producto.create([pick(req.body)], { session });
    await Auditoria.create(
      [{ entidad: 'Producto', entidad_id: p._id, accion: 'CREACION', cantidad: p.stock, stock_anterior: 0, stock_nuevo: p.stock, detalle: pick(p) }],
      { session }
    );
    return p;
  });
  res.status(201).json(producto);
};

/**
 * PUT /api/productos/:id  — Optimistic Locking.
 * El cliente envía el `__v` que leyó. Si no coincide con el actual, alguien
 * (otro usuario o una venta) cambió el producto: respondemos 409 en vez de
 * pisar silenciosamente esos cambios.
 */
exports.actualizar = async (req, res) => {
  const producto = await enTransaccion(async (session) => {
    const p = await Producto.findById(req.params.id).session(session);
    if (!p) throw new AppError(404, 'Producto no encontrado');
    if (req.body.__v !== undefined && Number(req.body.__v) !== p.__v) {
      throw new AppError(409, 'El producto fue modificado por otro usuario (versión desactualizada). Recargue e intente de nuevo.', { version_actual: p.__v });
    }
    const antes = pick(p.toObject());
    p.set(pick(req.body));
    await p.save({ session }); // con optimisticConcurrency => VersionError si cambió entre find y save
    await Auditoria.create(
      [{
        entidad: 'Producto', entidad_id: p._id, accion: 'EDICION', detalle: { antes, despues: pick(p.toObject()) },
        ...(antes.stock !== p.stock && { cantidad: p.stock - antes.stock, stock_anterior: antes.stock, stock_nuevo: p.stock }),
      }],
      { session }
    );
    return p;
  });
  res.json(producto);
};

/** DELETE /api/productos/:id */
exports.eliminar = async (req, res) => {
  await enTransaccion(async (session) => {
    const p = await Producto.findByIdAndDelete(req.params.id, { session });
    if (!p) throw new AppError(404, 'Producto no encontrado');
    await Auditoria.create([{ entidad: 'Producto', entidad_id: p._id, accion: 'ELIMINACION', detalle: pick(p) }], { session });
  });
  res.status(204).end();
};
