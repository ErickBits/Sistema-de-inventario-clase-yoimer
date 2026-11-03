import { useState } from 'react';
import Productos from './pages/Productos.jsx';
import Clientes from './pages/Clientes.jsx';
import NuevaVenta from './pages/NuevaVenta.jsx';
import Ventas from './pages/Ventas.jsx';
import Auditoria from './pages/Auditoria.jsx';

const SECCIONES = {
  venta: ['Nueva venta', NuevaVenta],
  ventas: ['Ventas', Ventas],
  productos: ['Productos', Productos],
  clientes: ['Clientes', Clientes],
  auditoria: ['Auditoría', Auditoria],
};

export default function App() {
  const [seccion, setSeccion] = useState('venta');
  const Pagina = SECCIONES[seccion][1];
  return (
    <div className="app">
      <header>
        <h1>Ventas &amp; Inventario</h1>
        <nav>
          {Object.entries(SECCIONES).map(([k, [titulo]]) => (
            <button key={k} className={k === seccion ? 'tab activo' : 'tab'} onClick={() => setSeccion(k)}>
              {titulo}
            </button>
          ))}
        </nav>
      </header>
      <main>
        <Pagina irA={setSeccion} />
      </main>
    </div>
  );
}
