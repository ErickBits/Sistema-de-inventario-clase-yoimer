require('dotenv').config({ quiet: true });
const app = require('./app');
const { conectarDB } = require('./config/db');

const PORT = process.env.PORT || 4000;

conectarDB(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('No se pudo conectar a MongoDB:', err.message);
    process.exit(1);
  });
