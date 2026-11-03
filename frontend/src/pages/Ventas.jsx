import { api, dinero, fecha } from '../api';
import { useCarga } from '../useCarga';

const SIGUIENTE_ENVIO = { por_despachar: 'despachado', despachado: 'en_transito', en_transito: 'entregado' };
const etiqueta = (s) => s.replace('_', ' ');

export default function Ventas() {
  const { datos: ventas, error, setError, recargar } = useCarga('/ventas');

  const accion = (fn) => async (...args) => {
    try {
      await fn(...args);
      recargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const pagar = accion(async (v) => {
    const saldo = Math.round((v.total - v.pagado) * 100) / 100;
    const monto = prompt(`Monto a pagar (saldo ${dinero(saldo)}):`, saldo);
    if (monto === null) return;
    const metodo = prompt('Método (efectivo / tarjeta / transferencia):', 'efectivo') || 'efectivo';
    await api(`/ventas/${v._id}/pagos`, { method: 'POST', body: { monto: Number(monto), metodo } });
  });
  const avanzarEnvio = accion((v) =>
    api(`/ventas/${v._id}/envio`, { method: 'PATCH', body: { estado_envio: SIGUIENTE_ENVIO[v.estado_envio] } })
  );
  const anular = accion(async (v) => {
    if (confirm('¿Anular la venta? El stock será devuelto al inventario.')) {
      await api(`/ventas/${v._id}/anular`, { method: 'POST' });
    }
  });

  return (
    <section>
      <div className="encabezado">
        <h2>Ventas / pedidos</h2>
        <button onClick={recargar}>Actualizar</button>
      </div>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th className="num">Total</th><th className="num">Pagado</th><th>Estado</th><th>Envío</th><th /></tr>
        </thead>
        <tbody>
          {(ventas ?? []).map((v) => (
            <tr key={v._id}>
              <td>{v.factura?.numero}</td>
              <td className="tenue">{fecha(v.fecha)}</td>
              <td>{v.cliente_id?.nombre ?? '—'}</td>
              <td className="num">{dinero(v.total)}</td>
              <td className="num">{dinero(v.pagado)}</td>
              <td><span className={`etiqueta ${v.estado}`}>{v.estado}</span></td>
              <td className="tenue">{etiqueta(v.estado_envio)}</td>
              <td className="acciones">
                {v.estado === 'pendiente' && <button onClick={() => pagar(v)}>Pagar</button>}
                {v.estado === 'pagada' && SIGUIENTE_ENVIO[v.estado_envio] && (
                  <button onClick={() => avanzarEnvio(v)}>→ {etiqueta(SIGUIENTE_ENVIO[v.estado_envio])}</button>
                )}
                {v.estado !== 'anulada' && v.estado_envio === 'por_despachar' && (
                  <button className="peligro" onClick={() => anular(v)}>Anular</button>
                )}
              </td>
            </tr>
          ))}
          {ventas && !ventas.length && <tr><td colSpan="8" className="tenue">Sin ventas</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
