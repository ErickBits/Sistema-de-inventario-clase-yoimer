const { Schema, model } = require('mongoose');

/** Secuencias atómicas (p.ej. consecutivo de facturas). */
const contadorSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });

const Contador = model('Contador', contadorSchema);

/** Devuelve el siguiente valor de la secuencia. Participa de la transacción si se pasa `session`. */
Contador.siguiente = async function (nombre, session) {
  const doc = await Contador.findOneAndUpdate(
    { _id: nombre },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', session }
  );
  return doc.seq;
};

module.exports = Contador;
