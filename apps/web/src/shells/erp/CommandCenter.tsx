import type { MeResponse } from '@quatreros/contracts';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { isUsable, SECTIONS } from '../../shared/modules';
import { Badge, type BadgeTone } from '../../shared/ui/Badge';
import { Card, CardLabel } from '../../shared/ui/Card';
import { useDocumentTitle } from '../../shared/ui/useDocumentTitle';

/**
 * Tarjeta del bento grid del Command Center (sistema de diseño Parte 2 §1). Mientras el módulo que la
 * alimenta no exista, muestra un estado vacío honesto con la entrega que la activa (Anexo B: sin cifras
 * inventadas).
 */
function BentoTile({
  label,
  shows,
  delivery,
  tone = 'neutral',
  className = '',
}: {
  label: string;
  shows: ReactNode;
  delivery: number;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <CardLabel>{label}</CardLabel>
      <p aria-hidden className="mt-3 font-mono text-display font-bold text-control">
        —
      </p>
      <p className="mt-2 text-ash">{shows}</p>
      <div className="mt-auto pt-4">
        <Badge tone={tone}>Se activa con la entrega {delivery}</Badge>
      </div>
    </Card>
  );
}

export function CommandCenter({ me }: { me: MeResponse }) {
  useDocumentTitle('Command Center');
  const available = SECTIONS.flatMap((s) => s.modules).filter((m) => isUsable(m, me));
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-ash">Hola, {me.user.fullName.split(' ')[0]}</p>
          <h1 className="text-display font-bold">Command Center</h1>
        </div>
      </div>

      {available.length > 0 ? (
        <section aria-labelledby="puedes-usar" className="mt-6">
          <h2 id="puedes-usar" className="text-title font-semibold">
            Puedes usar
          </h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {available.map((m) => (
              <li key={m.id}>
                <Link to={m.path ?? '/erp'} className="block rounded-2xl">
                  <Card interactive className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-title font-semibold">{m.name}</span>
                      <span className="mt-1 block text-ash">{m.description}</span>
                    </span>
                    <span aria-hidden className="text-display text-ember">
                      ›
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="tablero" className="mt-8">
        <h2 id="tablero" className="text-title font-semibold">
          Tablero del día
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <BentoTile
            label="Ventas del día"
            shows="Ventas de hoy en caja, comparadas con ayer."
            delivery={6}
          />
          <BentoTile
            label="Estado de reparto"
            shows="Pedidos entregados, en ruta y con entrega parcial."
            delivery={5}
          />
          <BentoTile
            label="Producción y mermas"
            shows="Kilos producidos por producto y rendimiento promedio."
            delivery={4}
          />
          <BentoTile
            label="Alertas FEFO y salida preferente"
            shows="Lotes próximos a vencer, con días restantes y paquetes en cada sede."
            delivery={2}
            tone="warning"
            className="md:col-span-2 lg:col-span-3"
          />
          <BentoTile
            label="Estado de caja POS"
            shows="Total por caja y por medio de pago del turno abierto."
            delivery={6}
          />
          <BentoTile
            label="Crédito y cartera"
            shows="Clientes cerca o por encima de su cupo y saldos vencidos."
            delivery={7}
          />
          <BentoTile
            label="Sugerencia de IA"
            shows="Recomendaciones del asistente, siempre con confirmación humana."
            delivery={8}
            tone="info"
          />
        </div>
      </section>
    </>
  );
}
