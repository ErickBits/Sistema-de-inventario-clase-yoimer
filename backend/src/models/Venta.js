const { Schema, model } = require('mongoose');
const detalleVentaSchema = require('./DetalleVenta');

const ESTADOS_VENTA = ['pendiente', 'pagada', 'anulada'];
// Flujo lineal de envío: cada estado sólo puede avanzar al siguiente.
const ESTADOS_ENVIO = ['por_despachar', 'despachado', 'en_transito', 'entregado'];

const ventaSchema = new Schema(
  {
    fecha: { type: Date, default: Date.now },
    cliente_id: { type: Schema.Types.ObjectId, ref: 'Cliente', required: true },
    detalles: {
      type: [detalleVentaSchema],
      validate: { validator: (v) => v.length > 0, message: 'La venta debe tener al menos un producto' },
    },
    total: { type: Number, required: true, min: 0 },
    pagado: { type: Number, default: 0, min: 0 },
    estado: { type: String, enum: ESTADOS_VENTA, default: 'pendiente' },
    estado_envio: { type: String, enum: ESTADOS_ENVIO, default: 'por_despachar' },
    vendedor: { type: String, default: 'sistema', trim: true },
  },
  { timestamps: true }
);

ventaSchema.index({ cliente_id: 1, fecha: -1 });

module.exports = model('Venta', ventaSchema);
module.exports.ESTADOS_VENTA = ESTADOS_VENTA;
module.exports.ESTADOS_ENVIO = ESTADOS_ENVIO;
