import { useState } from 'react';
import { api, dinero, fecha } from '../api';
import { useCarga } from '../useCarga';

export default function Clientes() {
  const { datos: clientes, error, setError, recargar } = useCarga('/clientes');
  const [form, setForm] = useState({ nombre: '', documento: '', telefono: '' });
  const [detalle, setDetalle] = useState(null);

  async function guardar(e) {
    e.preventDefault();
    try {
      await api('/clientes', { method: 'POST', body: form });
      setForm({ nombre: '', documento: '', telefono: '' });
      recargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const verPedidos = (c) => api(`/clientes/${c._id}`).then(setDetalle).catch((e) => setError(e.message));
  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <section>
      <h2>Registrar cliente</h2>
      <form className="fila" onSubmit={guardar}>
        <input name="nombre" placeholder="Nombre" value={form.nombre} onChange={cambiar} required />
        <input name="documento" placeholder="Documento" value={form.documento} onChange={cambiar} required />
        <input name="telefono" placeholder="Teléfono" value={form.telefono} onChange={cambiar} />
        <button className="primario">Agregar</button>
      </form>
      {error && <p className="error">{error}</p>}

      <h2>Clientes</h2>
      <table>
        <thead><tr><th>Nombre</th><th>Documento</th><th>Teléfono</th><th /></tr></thead>
        <tbody>
          {(clientes ?? []).map((c) => (
            <tr key={c._id}>
              <td>{c.nombre}</td>
              <td>{c.documento}</td>
              <td className="tenue">{c.telefono}</td>
              <td className="acciones"><button onClick={() => verPedidos(c)}>Pedidos</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {detalle && (
        <div className="panel">
          <div className="encabezado">
            <h3>Pedidos de {detalle.nombre}</h3>
            <button onClick={() => setDetalle(null)}>Cerrar</button>
          </div>
          {detalle.ventas.length === 0 ? <p className="tenue">Sin pedidos.</p> : (
            <ul className="lista">
              {detalle.ventas.map((v) => (
                <li key={v._id}>
                  {fecha(v.fecha)} · {v.detalles.length} ítem(s) · <b>{dinero(v.total)}</b> ·{' '}
                  <span className={`etiqueta ${v.estado}`}>{v.estado}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
