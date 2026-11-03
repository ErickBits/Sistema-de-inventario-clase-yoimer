const { Router } = require('express');
const productos = require('../controllers/productoController');
const clientes = require('../controllers/clienteController');
const ventas = require('../controllers/ventaController');

const router = Router();

// Productos (CRUD)
router.get('/productos', productos.listar);
router.get('/productos/:id', productos.obtener);
router.post('/productos', productos.crear);
router.put('/productos/:id', productos.actualizar);
router.delete('/productos/:id', productos.eliminar);

// Clientes
router.get('/clientes', clientes.listar);
router.get('/clientes/:id', clientes.obtener);
router.post('/clientes', clientes.crear);

// Ventas / pedidos, pagos, envíos
router.get('/ventas', ventas.listar);
router.get('/ventas/:id', ventas.obtener);
router.post('/ventas', ventas.crear);
router.post('/ventas/:id/pagos', ventas.pagar);
router.patch('/ventas/:id/envio', ventas.envio);
router.post('/ventas/:id/anular', ventas.anular);

// Auditoría
router.get('/auditoria', ventas.auditoria);

module.exports = router;
