/** Cliente HTTP mínimo: lanza Error con el mensaje del backend si la respuesta no es 2xx. */
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const detalle = data?.details && typeof data.details === 'object' ? ': ' + Object.values(data.details).join(', ') : '';
    throw new Error((data?.error || `Error ${res.status}`) + detalle);
  }
  return data;
}

export const dinero = (n) =>
  Number(n ?? 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2 });

export const fecha = (d) => new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
