import { Link } from 'react-router';

const shells = [
  { to: '/erp', name: 'Administración', detail: 'Compras, producción, inventario, ventas y contabilidad' },
  { to: '/pos', name: 'Caja', detail: 'Ventas en el punto de asados, turnos y cierre' },
  { to: '/ruta', name: 'Ruta', detail: 'Entregas, cobros y devoluciones del repartidor' },
];

/** Entrada: tras el inicio de sesión, cada rol irá directo a su shell; por ahora se elige aquí. */
export function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-chimichurri-strong">Quatreros</h1>
      <p className="mt-2 text-ink-muted">Elige dónde vas a trabajar.</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {shells.map((s) => (
          <li key={s.to}>
            <Link
              to={s.to}
              className="block h-full rounded-panel border border-line bg-panel p-4 hover:border-chimichurri"
            >
              <span className="block text-lg font-semibold">{s.name}</span>
              <span className="mt-1 block text-sm text-ink-muted">{s.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
