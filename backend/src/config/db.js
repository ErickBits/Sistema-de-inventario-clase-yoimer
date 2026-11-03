const mongoose = require('mongoose');
const models = require('../models');

/**
 * Conecta a MongoDB. Las transacciones multi-documento requieren un replica set
 * (MongoDB Atlas siempre lo es; en local: `mongod --replSet rs0`).
 */
async function conectarDB(uri) {
  if (!uri) throw new Error('Falta MONGODB_URI');
  await mongoose.connect(uri);
  // Crear colecciones e índices ANTES de recibir tráfico: dentro de una
  // transacción no conviene crear colecciones/índices implícitamente.
  await Promise.all(Object.values(models).map((m) => m.init()));
  return mongoose.connection;
}

module.exports = { conectarDB };
