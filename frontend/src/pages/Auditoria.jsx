import { useState } from 'react';
import { fecha } from '../api';
import { useCarga } from '../useCarga';

export default function Auditoria() {
  const [entidad, setEntidad] = useState('');
  const { datos: registros, error, recargar } = useCarga(`/auditoria${entidad ? `?entidad=${entidad}` : ''}`);

  return (
    <section>
      <div className="encabezado">
        <h2>Auditoría de movimientos</h2>
        <div className="fila">
          <select value={entidad} onChange={(e) => setEntidad(e.target.value)}>
            <option value="">Todas</option>
            {['Producto', 'Cliente', 'Venta', 'Pago'].map((e) => <option key={e}>{e}</option>)}
          </select>
          <button onClick={recargar}>Actualizar</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Fecha</th><th>Entidad</th><th>Acción</th><th className="num">Cant.</th><th className="num">Stock</th><th>Usuario</th></tr></thead>
        <tbody>
          {(registros ?? []).map((a) => (
            <tr key={a._id}>
              <td className="tenue">{fecha(a.fecha)}</td>
              <td>{a.entidad}</td>
              <td><code>{a.accion}</code></td>
              <td className="num">{a.cantidad ?? ''}</td>
              <td className="num tenue">{a.stock_anterior != null ? `${a.stock_anterior} → ${a.stock_nuevo}` : ''}</td>
              <td className="tenue">{a.usuario}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
