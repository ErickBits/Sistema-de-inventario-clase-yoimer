const { Venta, Factura, Pago, Auditoria } = require('../models');
const ventaService = require('../services/ventaService');
const AppError = require('../utils/AppError');

/** POST /api/ventas  body: { cliente_id, items: [{ producto_id, cantidad }], vendedor? } */
exports.crear = async (req, res) => {
  const { cliente_id, items, vendedor } = req.body ?? {};
  const resultado = await ventaService.crearVenta({ cliente_id, items, vendedor });
  res.status(201).json(resultado);
};

/** GET /api/ventas */
exports.listar = async (req, res) => {
  const ventas = await Venta.find().sort({ fecha: -1 }).limit(200).populate('cliente_id', 'nombre documento').lean();
  const facturas = await Factura.find({ venta_id: { $in: ventas.map((v) => v._id) } }).lean();
  const porVenta = new Map(facturas.map((f) => [String(f.venta_id), f]));
  res.json(ventas.map((v) => ({ ...v, factura: porVenta.get(String(v._id)) ?? null })));
};

/** GET /api/ventas/:id  — venta + factura + pagos */
exports.obtener = async (req, res) => {
  const venta = await Venta.findById(req.params.id).populate('cliente_id').lean();
  if (!venta) throw new AppError(404, 'Venta no encontrada');
  const [factura, pagos] = await Promise.all([
    Factura.findOne({ venta_id: venta._id }).lean(),
    Pago.find({ venta_id: venta._id }).sort({ fecha: 1 }).lean(),
  ]);
  res.json({ ...venta, factura, pagos });
};

/** POST /api/ventas/:id/pagos  body: { monto, metodo } */
exports.pagar = async (req, res) => {
  res.status(201).json(await ventaService.registrarPago(req.params.id, req.body ?? {}));
};

/** PATCH /api/ventas/:id/envio  body: { estado_envio } */
exports.envio = async (req, res) => {
  res.json(await ventaService.actualizarEnvio(req.params.id, req.body ?? {}));
};

/** POST /api/ventas/:id/anular */
exports.anular = async (req, res) => {
  res.json(await ventaService.anularVenta(req.params.id, req.body ?? {}));
};

/** GET /api/auditoria?entidad=&entidad_id= */
exports.auditoria = async (req, res) => {
  const filtro = {};
  if (req.query.entidad) filtro.entidad = String(req.query.entidad);
  if (req.query.entidad_id) filtro.entidad_id = String(req.query.entidad_id);
  res.json(await Auditoria.find(filtro).sort({ fecha: -1 }).limit(300));
};
