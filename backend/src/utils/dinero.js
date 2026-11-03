/** Redondea a 2 decimales evitando errores de coma flotante (0.1 + 0.2). */
const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

module.exports = { redondear };
