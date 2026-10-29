import { Link } from 'react-router';
import { ServerStatus } from '../../shared/ui/ServerStatus';

/** Shell del portal del distribuidor (ADR-014, RF-182): una columna, botones grandes, uso en celular. */
export function RutaShell() {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-surface px-4 py-4">
      <header className="mb-6 flex items-center justify-between">
        <Link to="/" className="font-bold text-chimichurri-strong">
          Quatreros <span className="ml-1 font-normal text-ink-muted">Ruta</span>
        </Link>
        <ServerStatus />
      </header>
      <h1 className="text-xl font-bold">Despachos de hoy</h1>
      <p className="mt-2 text-ink-muted">
        Aquí verás los pedidos asignados, con dirección y valor a cobrar. Se habilita con el módulo de
        despachos.
      </p>
    </div>
  );
}
