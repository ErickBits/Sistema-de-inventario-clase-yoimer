/**
 * Suite de pruebas del flujo de ventas (node:test, sin dependencias extra).
 *
 * Requiere un MongoDB con replica set (transacciones). Ejemplo local:
 *   mongod --replSet rs0 --dbpath ./data --port 27017
 *   mongosh --eval "rs.initiate()"
 *   MONGODB_URI_TEST="mongodb://127.0.0.1:27017/ventas_test?replicaSet=rs0" npm test
 *
 * ⚠️  La base de datos de pruebas se BORRA al iniciar.
 */
require('dotenv').config({ quiet: true });
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const { conectarDB } = require('../src/config/db');
const { Producto, Venta, Factura, Auditoria } = require('../src/models');

let server;
let baseUrl;
let cliente;

/** Pequeño helper HTTP sobre fetch nativo. */
async function api(method, path, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const crearProducto = (datos) =>
  api('POST', '/api/productos', { categoria: 'General', ...datos }).then((r) => {
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body;
  });

before(async () => {
  const uri = process.env.MONGODB_URI_TEST;
  assert.ok(uri, 'Defina MONGODB_URI_TEST (MongoDB con replica set)');
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await conectarDB(uri);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([Producto, Venta, Factura, Auditoria].map((m) => m.deleteMany({})));
  const r = await api('POST', '/api/clientes', {
    nombre: 'Cliente Prueba',
    documento: `DOC-${Date.now()}-${Math.random()}`,
    telefono: '3001234567',
  });
  cliente = r.body;
});

// ---------------------------------------------------------------------------
test('1. Venta exitosa: descuenta stock, calcula total, factura y audita', async () => {
  const teclado = await crearProducto({ nombre: 'Teclado', precio: 45.5, stock: 10 });
  const mouse = await crearProducto({ nombre: 'Mouse', precio: 19.99, stock: 5 });

  const r = await api('POST', '/api/ventas', {
    cliente_id: cliente._id,
    items: [
      { producto_id: teclado._id, cantidad: 2 }, // 91.00
      { producto_id: mouse._id, cantidad: 3 },   // 59.97
    ],
  });

  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.venta.total, 150.97, 'total = Σ subtotales');
  assert.deepEqual(r.body.venta.detalles.map((d) => d.subtotal), [91, 59.97]);
  assert.match(r.body.factura.numero, /^F-\d{6}$/);
  assert.equal(r.body.factura.total, r.body.venta.total);

  assert.equal((await Producto.findById(teclado._id)).stock, 8);
  assert.equal((await Producto.findById(mouse._id)).stock, 2);

  const salidas = await Auditoria.find({ accion: 'SALIDA_VENTA', referencia: r.body.venta._id });
  assert.equal(salidas.length, 2, 'un movimiento de inventario por producto');
});

// ---------------------------------------------------------------------------
test('2. Stock insuficiente: rechaza con 409 y no modifica nada', async () => {
  const monitor = await crearProducto({ nombre: 'Monitor', precio: 200, stock: 3 });

  const r = await api('POST', '/api/ventas', {
    cliente_id: cliente._id,
    items: [{ producto_id: monitor._id, cantidad: 4 }],
  });

  assert.equal(r.status, 409);
  assert.match(r.body.error, /Stock insuficiente/);
  assert.equal(r.body.details.disponible, 3);
  assert.equal((await Producto.findById(monitor._id)).stock, 3);
  assert.equal(await Venta.countDocuments(), 0);
  assert.equal(await Factura.countDocuments(), 0);
});

// ---------------------------------------------------------------------------
test('3. Cantidades negativas, cero o decimales son rechazadas (400)', async () => {
  const cable = await crearProducto({ nombre: 'Cable', precio: 5, stock: 10 });

  for (const cantidad of [-5, 0, 1.5, 'abc']) {
    const r = await api('POST', '/api/ventas', {
      cliente_id: cliente._id,
      items: [{ producto_id: cable._id, cantidad }],
    });
    assert.equal(r.status, 400, `cantidad=${cantidad} debería ser rechazada`);
  }
  // Tampoco se permite stock/precio negativo al registrar productos.
  assert.equal((await api('POST', '/api/productos', { nombre: 'X', precio: 1, stock: -1, categoria: 'A' })).status, 400);
  assert.equal((await api('POST', '/api/productos', { nombre: 'X', precio: -1, stock: 1, categoria: 'A' })).status, 400);

  assert.equal((await Producto.findById(cable._id)).stock, 10, 'el stock no debe cambiar');
});

// ---------------------------------------------------------------------------
test('4. Atomicidad: si una línea falla, ninguna se descuenta (rollback)', async () => {
  const silla = await crearProducto({ nombre: 'Silla', precio: 80, stock: 10 });
  const mesa = await crearProducto({ nombre: 'Mesa', precio: 150, stock: 1 });

  const r = await api('POST', '/api/ventas', {
    cliente_id: cliente._id,
    items: [
      { producto_id: silla._id, cantidad: 4 }, // OK por sí sola...
      { producto_id: mesa._id, cantidad: 2 },  // ...pero esta falla
    ],
  });

  assert.equal(r.status, 409);
  assert.equal((await Producto.findById(silla._id)).stock, 10, 'la silla NO debe quedar descontada');
  assert.equal((await Producto.findById(mesa._id)).stock, 1);
  assert.equal(await Auditoria.countDocuments({ accion: 'SALIDA_VENTA' }), 0, 'ni auditoría huérfana');
  assert.equal(await Venta.countDocuments(), 0);
});

// ---------------------------------------------------------------------------
test('5. Concurrencia: 20 vendedores simultáneos sobre stock 5 => exactamente 5 ventas', async () => {
  const consola = await crearProducto({ nombre: 'Consola', precio: 499.99, stock: 5 });

  const intentos = Array.from({ length: 20 }, (_, i) =>
    api('POST', '/api/ventas', {
      cliente_id: cliente._id,
      vendedor: `vendedor-${i}`,
      items: [{ producto_id: consola._id, cantidad: 1 }],
    })
  );
  const resultados = await Promise.all(intentos);

  const exitosas = resultados.filter((r) => r.status === 201);
  const rechazadas = resultados.filter((r) => r.status === 409);
  assert.equal(exitosas.length, 5, 'sólo se pueden vender 5 unidades');
  assert.equal(rechazadas.length, 15);

  const final = await Producto.findById(consola._id);
  assert.equal(final.stock, 0, 'el stock nunca es negativo');
  assert.equal(await Venta.countDocuments(), 5);

  // Los consecutivos de factura son únicos y sin huecos pese a la concurrencia.
  const numeros = exitosas.map((r) => r.body.factura.numero).sort();
  assert.equal(new Set(numeros).size, 5);

  // Optimistic locking: una edición con la versión leída ANTES de las ventas es rechazada.
  const edicion = await api('PUT', `/api/productos/${consola._id}`, { precio: 450, __v: consola.__v });
  assert.equal(edicion.status, 409);
  assert.equal((await Producto.findById(consola._id)).precio, 499.99);
});
