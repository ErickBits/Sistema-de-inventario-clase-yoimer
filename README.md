# Sistema de Gestión de Ventas e Inventario (MVP)

Node.js + Express 5 · MongoDB (Mongoose 9, Atlas) · React 19 (Vite)

```
backend/
  src/models/        Producto, Cliente, Venta (+ DetalleVenta embebido), Factura, Pago, Auditoria, Contador
  src/services/      ventaService.js  ← lógica transaccional (venta, pago, envío, anulación)
  src/controllers/   productos (CRUD + optimistic locking), clientes, ventas
  tests/             ventas.test.js   ← 5 casos del flujo de ventas
frontend/src/pages/  Nueva venta · Ventas · Productos · Clientes · Auditoría
```

## Puesta en marcha

```bash
# Backend
cd backend && cp .env.example .env   # poner la URI de Atlas en MONGODB_URI
npm install && npm run dev           # http://localhost:4000

# Frontend (otra terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxy /api → :4000)

# Pruebas (requiere MongoDB con replica set; Atlas o local con --replSet)
cd backend && MONGODB_URI_TEST="mongodb://127.0.0.1:27017/ventas_test?replicaSet=rs0" npm test
```

> ⚠️ Las transacciones requieren replica set. Atlas ya lo es. En local:
> `mongod --replSet rs0 --dbpath ./data` y luego `mongosh --eval "rs.initiate()"`.

## API

| Método | Ruta | RF |
|---|---|---|
| GET/POST | `/api/productos` | Consultar / registrar productos |
| GET/PUT/DELETE | `/api/productos/:id` | Consultar / editar (envía `__v`) / eliminar |
| GET/POST | `/api/clientes` · GET `/api/clientes/:id` | Registro de clientes y sus pedidos |
| POST | `/api/ventas` `{cliente_id, items:[{producto_id, cantidad}]}` | Venta + descuento de stock + factura |
| GET | `/api/ventas` · `/api/ventas/:id` | Consultar ventas (con factura y pagos) |
| POST | `/api/ventas/:id/pagos` `{monto, metodo}` | Registro de pagos (parciales) |
| PATCH | `/api/ventas/:id/envio` `{estado_envio}` | por_despachar → despachado → en_transito → entregado |
| POST | `/api/ventas/:id/anular` | Anula y devuelve stock (sólo si no se despachó) |
| GET | `/api/auditoria?entidad=` | Auditoría automática de movimientos |

## Estrategia de concurrencia

Se combinan **tres capas**, cada una con un propósito distinto:

1. **Decremento condicional atómico (evita sobreventa).** El stock se valida y descuenta en
   *una sola* operación del servidor:
   ```js
   Producto.findOneAndUpdate(
     { _id, stock: { $gte: cantidad } },        // condición
     { $inc: { stock: -cantidad, __v: 1 } },    // descuento
     { session })
   ```
   MongoDB garantiza atomicidad por documento: si dos vendedores compiten por la última unidad,
   sólo uno cumple el filtro; el otro recibe `null` → HTTP 409. No existe la ventana
   *leer → validar → escribir* del enfoque ingenuo, y el stock **no puede quedar negativo**.

2. **Transacción multi-documento (todo o nada).** Una venta toca varios productos, la venta,
   la factura, el contador de facturas y la auditoría. Todo corre en `session.withTransaction()`:
   si la 3.ª línea no tiene stock, se revierten los descuentos de las líneas 1 y 2. Cuando dos
   transacciones modifican el mismo producto, MongoDB lanza `WriteConflict`
   (`TransientTransactionError`) y `withTransaction` **reintenta automáticamente** la transacción,
   que vuelve a evaluar el stock con el valor ya confirmado.

3. **Optimistic Locking para ediciones (`optimisticConcurrency: true`).** Al editar un producto
   el frontend envía el `__v` que leyó; si no coincide (otro usuario lo editó, o una venta
   descontó stock — las ventas también incrementan `__v`), se responde 409 en vez de pisar el
   cambio. Esto evita, p. ej., que un administrador con la pantalla abierta restaure un stock
   viejo encima de ventas ya realizadas.

¿Por qué no sólo optimistic locking para las ventas? Con alta contención (muchos vendedores
sobre un producto popular) obliga al cliente a reintentar manualmente; el decremento condicional
nunca falla por "versión", sólo por falta real de stock. La prueba 5 lanza 20 ventas simultáneas
sobre stock 5 y verifica exactamente 5 éxitos, 15 rechazos, stock final 0 y facturas únicas.

## Decisiones de diseño

- **DetalleVenta embebido** en Venta: se lee/escribe siempre con la venta; guarda una copia de
  `nombre` y `precio` para que cambios de precio no alteren ventas históricas.
- **El precio lo pone el servidor**: el cliente sólo envía `producto_id` y `cantidad`.
- **Factura automática** con consecutivo `F-000001` generado dentro de la transacción (sin huecos
  si la venta se revierte).
- **Auditoría** escrita en la misma transacción que el cambio: nunca hay registros huérfanos.
- Fuera del alcance del MVP: autenticación/roles (el campo `vendedor`/`usuario` está listo para
  conectarse a un login) y reembolsos al anular ventas pagadas.
# Sistema-de-inventario-clase-yoimer
