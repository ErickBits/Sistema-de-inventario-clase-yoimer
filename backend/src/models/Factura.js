const { Schema, model } = require('mongoose');

const facturaSchema = new Schema(
  {
    numero: { type: String, required: true, unique: true }, // Ej: F-000001 (consecutivo)
    fecha: { type: Date, default: Date.now },
    total: { type: Number, required: true, min: 0 },
    venta_id: { type: Schema.Types.ObjectId, ref: 'Venta', required: true, unique: true },
    cliente_id: { type: Schema.Types.ObjectId, ref: 'Cliente', required: true },
    estado: { type: String, enum: ['emitida', 'anulada'], default: 'emitida' },
  },
  { timestamps: true }
);

module.exports = model('Factura', facturaSchema);
