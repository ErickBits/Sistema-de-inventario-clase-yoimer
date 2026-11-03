import { useState } from 'react';
import { api, dinero } from '../api';
import { useCarga } from '../useCarga';

export default function NuevaVenta({ irA }) {
  const { datos: productos, recargar } = useCarga('/productos');
  const { datos: clientes } = useCarga('/clientes');
  const [clienteId, setClienteId] = useState('');
  const [items, setItems] = useState([]); // [{ producto, cantidad }]
  const [sel, setSel] = useState({ productoId: '', cantidad: 1 });
  const [error, setError] = useState('');
  const [factura, setFactura] = useState(null);

  function agregar(e) {
    e.preventDefault();
    const producto = productos.find((p) => p._id === sel.productoId);
    const cantidad = Number(sel.cantidad);
    if (!producto || !Number.isInteger(cantidad) || cantidad < 1) return setError('Seleccione un producto y una cantidad válida');
    const yaEnCarrito = items.find((i) => i.producto._id === producto._id)?.cantidad ?? 0;
    // Validación de UX; la definitiva (y segura ante concurrencia) la hace el backend.
    if (yaEnCarrito + cantidad > producto.stock) return setError(`Sólo hay ${producto.stock} unidades de ${producto.nombre}`);
    setError('');
    setItems(yaEnCarrito
      ? items.map((i) => (i.producto._id === producto._id ? { ...i, cantidad: i.cantidad + cantidad } : i))
      : [...items, { producto, cantidad }]);
    setSel({ productoId: '', cantidad: 1 });
  }

  // Vista previa del total (el total oficial lo calcula el backend con precios de la BD).
  const total = items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);

  async function confirmar() {
    try {
      const r = await api('/ventas', {
        method: 'POST',
        body: { cliente_id: clienteId, items: items.map((i) => ({ producto_id: i.producto._id, cantidad: i.cantidad })) },
      });
      setFactura(r);
      setItems([]);
      setError('');
      recargar();
    } catch (err) {
      setError(err.message);
      recargar(); // el stock pudo cambiar por otra venta concurrente
    }
  }

  if (factura) {
    const { venta, factura: f } = factura;
    return (
      <section className="panel factura">
        <h2>Factura {f.numero}</h2>
        <p className="tenue">{new Date(f.fecha).toLocaleString('es-CO')}</p>
        <table>
          <thead><tr><th>Producto</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th></tr></thead>
          <tbody>
            {venta.detalles.map((d) => (
              <tr key={d.producto_id}><td>{d.nombre}</td><td className="num">{d.cantidad}</td><td className="num">{dinero(d.precio)}</td><td className="num">{dinero(d.subtotal)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan="3">Total</td><td className="num">{dinero(f.total)}</td></tr></tfoot>
        </table>
        <div className="fila">
          <button className="primario" onClick={() => setFactura(null)}>Nueva venta</button>
          <button onClick={() => irA('ventas')}>Ir a ventas (registrar pago)</button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2>Nueva venta</h2>
      <div className="fila">
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">— Cliente —</option>
          {(clientes ?? []).map((c) => <option key={c._id} value={c._id}>{c.nombre} ({c.documento})</option>)}
        </select>
      </div>

      <form className="fila" onSubmit={agregar}>
        <select value={sel.productoId} onChange={(e) => setSel({ ...sel, productoId: e.target.value })}>
          <option value="">— Producto —</option>
          {(productos ?? []).map((p) => (
            <option key={p._id} value={p._id} disabled={p.stock === 0}>
              {p.nombre} · {dinero(p.precio)} · stock {p.stock}
            </option>
          ))}
        </select>
        <input type="number" min="1" step="1" value={sel.cantidad} onChange={(e) => setSel({ ...sel, cantidad: e.target.value })} style={{ width: 90 }} />
        <button>Agregar</button>
      </form>

      {error && <p className="error">{error}</p>}

      <table>
        <thead><tr><th>Producto</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th><th /></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.producto._id}>
              <td>{i.producto.nombre}</td>
              <td className="num">{i.cantidad}</td>
              <td className="num">{dinero(i.producto.precio)}</td>
              <td className="num">{dinero(i.producto.precio * i.cantidad)}</td>
              <td className="acciones"><button onClick={() => setItems(items.filter((x) => x !== i))}>Quitar</button></td>
            </tr>
          ))}
          {!items.length && <tr><td colSpan="5" className="tenue">Agregue productos a la venta</td></tr>}
        </tbody>
        <tfoot><tr><td colSpan="3">Total</td><td className="num">{dinero(total)}</td><td /></tr></tfoot>
      </table>

      <button className="primario" disabled={!clienteId || !items.length} onClick={confirmar}>
        Confirmar venta y facturar
      </button>
    </section>
  );
}
