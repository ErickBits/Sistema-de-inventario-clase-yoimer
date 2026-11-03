const { Schema, model } = require('mongoose');

const pagoSchema = new Schema(
  {
    venta_id: { type: Schema.Types.ObjectId, ref: 'Venta', required: true, index: true },
    monto: { type: Number, required: true, min: [0.01, 'El monto debe ser positivo'] },
    metodo: { type: String, enum: ['efectivo', 'tarjeta', 'transferencia'], default: 'efectivo' },
    fecha: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = model('Pago', pagoSchema);
