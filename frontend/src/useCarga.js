import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Carga un recurso de la API y expone `recargar` + manejo de error. */
export function useCarga(path) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const recargar = useCallback(() => {
    setError('');
    return api(path).then(setDatos).catch((e) => setError(e.message));
  }, [path]);
  useEffect(() => { recargar(); }, [recargar]);
  return { datos, error, setError, recargar };
}
