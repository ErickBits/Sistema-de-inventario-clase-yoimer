const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

/** Traduce errores de negocio y de Mongoose a respuestas HTTP coherentes. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    return res.status(400).json({ error: 'Datos inválidos', details });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Valor inválido para ${err.path}` });
  }
  if (err instanceof mongoose.Error.VersionError) {
    return res.status(409).json({ error: 'El registro fue modificado por otro usuario. Recargue e intente de nuevo.' });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'Registro duplicado', details: err.keyValue });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = errorHandler;
