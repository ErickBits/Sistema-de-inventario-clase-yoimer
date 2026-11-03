const { Cliente, Venta, Auditoria } = require('../models');
const AppError = require('../utils/AppError');

/** GET /api/clientes */
exports.listar = async (req, res) => {
  res.json(await Cliente.find().sort({ nombre: 1 }));
};

/** GET /api/clientes/:id  — incluye sus pedidos (ventas) */
exports.obtener = async (req, res) => {
  const cliente = await Cliente.findById(req.params.id);
  if (!cliente) throw new AppError(404, 'Cliente no encontrado');
  const ventas = await Venta.find({ cliente_id: cliente._id }).sort({ fecha: -1 });
  res.json({ ...cliente.toObject(), ventas });
};

/** POST /api/clientes */
exports.crear = async (req, res) => {
  const { nombre, documento, telefono } = req.body ?? {};
  const cliente = await Cliente.create({ nombre, documento, telefono });
  await Auditoria.create({ entidad: 'Cliente', entidad_id: cliente._id, accion: 'CREACION', detalle: { nombre, documento } });
  res.status(201).json(cliente);
};
