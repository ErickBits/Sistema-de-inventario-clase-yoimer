import { useState } from 'react';
import { api, dinero } from '../api';
import { useCarga } from '../useCarga';

const VACIO = { nombre: '', precio: '', stock: '', categoria: '' };

export default function Productos() {
  const { datos: productos, error, setError, recargar } = useCarga('/productos');
  const [form, setForm] = useState(VACIO);
  const [editando, setEditando] = useState(null); // producto original (incluye __v)
  const [filtro, setFiltro] = useState('');

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    const body = { ...form, precio: Number(form.precio), stock: Number(form.stock) };
    try {
      if (editando) {
        // Se envía la versión leída: si otro usuario o una venta modificó el
        // producto, el backend responde 409 (optimistic locking).
        await api(`/productos/${editando._id}`, { method: 'PUT', body: { ...body, __v: editando.__v } });
      } else {
        await api('/productos', { method: 'POST', body });
      }
      cancelar();
      recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  function editar(p) {
    setEditando(p);
    setForm({ nombre: p.nombre, precio: p.precio, stock: p.stock, categoria: p.categoria });
  }
  function cancelar() {
    setEditando(null);
    setForm(VACIO);
  }
  async function eliminar(p) {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    await api(`/productos/${p._id}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    recargar();
  }

  const visibles = (productos ?? []).filter((p) =>
    `${p.nombre} ${p.categoria}`.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <section>
      <h2>{editando ? `Editar: ${editando.nombre}` : 'Registrar producto'}</h2>
      <form className="fila" onSubmit={guardar}>
        <input name="nombre" placeholder="Nombre" value={form.nombre} onChange={cambiar} required />
        <input name="categoria" placeholder="Categoría" value={form.categoria} onChange={cambiar} required />
        <input name="precio" type="number" min="0" step="0.01" placeholder="Precio" value={form.precio} onChange={cambiar} required />
        <input name="stock" type="number" min="0" step="1" placeholder="Stock" value={form.stock} onChange={cambiar} required />
        <button className="primario">{editando ? 'Guardar' : 'Agregar'}</button>
        {editando && <button type="button" onClick={cancelar}>Cancelar</button>}
      </form>
      {error && <p className="error">{error}</p>}

      <div className="encabezado">
        <h2>Inventario</h2>
        <input placeholder="Buscar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      </div>
      <table>
        <thead>
          <tr><th>Nombre</th><th>Categoría</th><th className="num">Precio</th><th className="num">Stock</th><th /></tr>
        </thead>
        <tbody>
          {visibles.map((p) => (
            <tr key={p._id}>
              <td>{p.nombre}</td>
              <td className="tenue">{p.categoria}</td>
              <td className="num">{dinero(p.precio)}</td>
              <td className={`num ${p.stock === 0 ? 'agotado' : p.stock < 5 ? 'bajo' : ''}`}>{p.stock}</td>
              <td className="acciones">
                <button onClick={() => editar(p)}>Editar</button>
                <button className="peligro" onClick={() => eliminar(p)}>Eliminar</button>
              </td>
            </tr>
          ))}
          {productos && !visibles.length && <tr><td colSpan="5" className="tenue">Sin productos</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
