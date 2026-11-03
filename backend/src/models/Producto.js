const { Schema, model } = require('mongoose');

/**
 * Producto del inventario.
 *
 * `optimisticConcurrency: true` activa el Optimistic Locking de Mongoose:
 * cada `save()` incluye `__v` en el filtro, así que si otro proceso modificó
 * el documento entre la lectura y la escritura, Mongoose lanza `VersionError`
 * (lo traducimos a HTTP 409). Las ventas además incrementan `__v` al
 * descontar stock, de modo que una edición concurrente también lo detecta.
 */
const productoSchema = new Schema(
  {
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, maxlength: 120 },
    precio: { type: Number, required: [true, 'El precio es obligatorio'], min: [0, 'El precio no puede ser negativo'] },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'El stock no puede ser negativo'],
      validate: { validator: Number.isInteger, message: 'El stock debe ser un entero' },
    },
    categoria: { type: String, required: [true, 'La categoría es obligatoria'], trim: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

productoSchema.index({ nombre: 1 });
productoSchema.index({ categoria: 1 });

module.exports = model('Producto', productoSchema);
