const { Schema, model } = require('mongoose');

/**
 * Bitácora inmutable de movimientos. Se escribe DENTRO de la misma transacción
 * que el cambio auditado: si la operación se revierte, su auditoría también.
 */
const auditoriaSchema = new Schema(
  {
    fecha: { type: Date, default: Date.now },
    entidad: { type: String, enum: ['Producto', 'Cliente', 'Venta', 'Pago'], required: true },
    entidad_id: { type: Schema.Types.ObjectId, required: true },
    accion: {
      type: String,
      required: true,
      enum: ['CREACION', 'EDICION', 'ELIMINACION', 'SALIDA_VENTA', 'ENTRADA_ANULACION', 'PAGO', 'ENVIO', 'ANULACION'],
    },
    cantidad: Number, // unidades movidas (movimientos de inventario)
    stock_anterior: Number,
    stock_nuevo: Number,
    referencia: { type: Schema.Types.ObjectId }, // p.ej. la venta que originó la salida
    detalle: { type: Schema.Types.Mixed },
    usuario: { type: String, default: 'sistema' },
  },
  { versionKey: false }
);

auditoriaSchema.index({ entidad: 1, entidad_id: 1, fecha: -1 });
auditoriaSchema.index({ fecha: -1 });

module.exports = model('Auditoria', auditoriaSchema);
