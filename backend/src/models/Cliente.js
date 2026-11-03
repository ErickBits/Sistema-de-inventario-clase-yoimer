const { Schema, model } = require('mongoose');

const clienteSchema = new Schema(
  {
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, maxlength: 120 },
    documento: { type: String, required: [true, 'El documento es obligatorio'], trim: true, unique: true },
    telefono: { type: String, trim: true, match: [/^[0-9+\-\s()]{7,20}$/, 'Teléfono inválido'] },
  },
  { timestamps: true }
);

module.exports = model('Cliente', clienteSchema);
