const { Schema } = require('mongoose');

/**
 * DetalleVenta: línea de una venta.
 *
 * Se modela como SUBDOCUMENTO embebido en Venta (no como colección aparte):
 * una venta y sus líneas se leen/escriben siempre juntas, y así la venta queda
 * escrita en una sola operación atómica. `precio` y `nombre` son una "foto"
 * del producto al momento de vender: cambios futuros de precio no alteran
 * ventas históricas.
 */
const detalleVentaSchema = new Schema(
  {
    producto_id: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
    nombre: { type: String, required: true },
    cantidad: {
      type: Number,
      required: true,
      min: [1, 'La cantidad debe ser al menos 1'],
      validate: { validator: Number.isInteger, message: 'La cantidad debe ser un entero' },
    },
    precio: { type: Number, required: true, min: [0, 'El precio no puede ser negativo'] },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

module.exports = detalleVentaSchema;
