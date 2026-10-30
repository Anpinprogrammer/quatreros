---
name: 'quatreros-conventions'
description: 'Usar al escribir, revisar o planear código o documentación del proyecto Quatreros (ERP de producción, inventarios, distribución, POS y contabilidad).'
---

# Convenciones del proyecto Quatreros

> Guía de arranque para agentes: `AGENTS.md` en la raíz. Traspaso y siguiente tarea: `docs/HANDOFF.md`.

## Fuentes de verdad (leer antes de actuar)

1. `docs/Quatreros_Documento_Maestro_v1.0.pdf` (DM) — visión y decisiones del negocio.
2. `docs/00-discovery/decision-register.md` — decisiones canónicas `DEC-###` y su estado.
3. `docs/00-discovery/domain-glossary.md` — vocabulario obligatorio y nombres de código.
4. `docs/00-discovery/open-questions.md` — lo que NO está decidido.
5. `docs/PROJECT-STATUS.md` — etapa actual y bloqueos.
6. `docs/05-design/sistema-de-diseno.md` — sistema de diseño "Los Quatreros" (DEC-086), base visual única.

Si una regla de negocio no tiene origen en DM o en una `DEC-###` CONFIRMED (o `PROVISIONAL` por DEC-083), **no se implementa**: se registra como pregunta.

## Estados

`CONFIRMED` · `PROPOSED` · `PENDING` · `BLOCKED` · `PROVISIONAL` (DEC-083: aplicada en el prototipo, configurable, se confirma antes del piloto). Nunca convertir PROPOSED o PENDING en CONFIRMED sin aprobación explícita del responsable.

## Stack (DEC-060)

- Frontend: React + TypeScript + Tailwind, organizado por funcionalidad (`features/<modulo>/`).
- Backend: Node.js + Express + TypeScript, monolito modular.
- Base de datos: PostgreSQL con migraciones versionadas.
- No introducir tecnologías nuevas sin ADR en `docs/02-architecture/architecture-decisions.md`.

## Diseño de interfaz (DEC-086) — obligatorio

- Toda pantalla, componente, mockup o propuesta visual se basa **exclusivamente** en `docs/05-design/sistema-de-diseno.md`. No se usan colores, tipografías ni componentes fuera de ese sistema.
- Modo oscuro nativo. Tokens solo vía Tailwind (`bg-char`, `bg-smoke`, `border-grill`, `text-chalk`, `text-ash`, `bg-ember`, `success/warning/danger/info`); nada de colores sueltos.
- Tipografía: Inter (texto) y JetBrains Mono (montos, cantidades, pesos, códigos, totales). Escala Display 28/32, Title 20/24, Body 14/20, Caption 12/16.
- Componentes de `apps/web/src/shared/ui/`: `Button` (primary ≥ 52 px, secondary, ghost, danger), `Card`/`CardLabel` (bento), `Badge`, `TextField` (≥ 48 px), `PasswordField`, `CheckboxGroup`, `Alert`. Las pantallas no redefinen estos componentes.
- Accesibilidad WCAG 2.1 AA según el Anexo A: etiqueta del botón primario como texto grande en negrita; borde de campos `control` (#71717A); foco Ember visible; sin movimiento con `prefers-reduced-motion`.
- La Parte 2 (bocetos de pantallas) define cómo se ven y recorren las pantallas, no reglas de negocio (Anexo B): sin cifras inventadas; lo que dependa de decisiones abiertas (P-06, P-08, P-10, P-01..P-04) se muestra como "Espera decisión".
- Toda pantalla nueva se agrega a `apps/web/e2e/accesibilidad.spec.ts` (axe sin hallazgos y sin desplazamiento horizontal).

## Principios no negociables

- Núcleo (ERP, POS, distribución, inventario, contabilidad) **sin dependencias hacia IA ni Telegram** (DEC-071).
- IA y Telegram solo invocan servicios de negocio del backend; nunca SQL directo (DEC-P05, DEC-P06).
- Una sola implementación de cada regla de negocio, en la capa de dominio/servicio del backend.
- Validación, permisos, filtro por sede y aprobaciones **siempre en el servidor** (DEC-041, DEC-042).
- Cambios sensibles generan evento de auditoría (DEC-044).
- Sin edición silenciosa ni borrado destructivo de registros cerrados; corregir con reversión (DEC-P10).
- Existencias solo cambian mediante movimientos inmutables del kardex (DEC-P21).
- Dinero: `NUMERIC` o enteros en pesos; nunca `float` (DEC-P22). Cantidades con unidad explícita, convertidas a unidad base.
- Escrituras con efecto financiero o de inventario son idempotentes (DEC-P23) y transaccionales.
- Asistente **Quatreros AI** (DEC-087, ADR-023): agente de Anthropic Managed Agents configurado en `quatreros-ai/`. Sus herramientas son `custom` y las resuelve el backend con la identidad de la sesión (nunca con argumentos del modelo). Las escrituras solo se **preparan**: se ejecutan con confirmación humana persistida. `ant apply` solo con autorización del responsable; `claude-lock.json` no se edita a mano. Memoria e historial del agente no son fuente de verdad (DEC-088).
- Contabilidad: la capa de motor genérico se puede construir; las reglas de contabilización por operación están BLOCKED hasta P-01..P-04 (DEC-081).

## Nombres

- Código, tablas y API en inglés usando la columna **Código** del glosario (`StockMovement`, `SalesOrder`, `Dispatch`, `DriverSettlement`).
- Tablas en `snake_case` plural (`stock_movements`); tipos y clases en `PascalCase`; variables en `camelCase`.
- Textos de UI en español de Colombia.
- Términos a evitar: ver sección final del glosario ("factura" para comprobantes internos, "distribuidor" para clientes, "stock" sin calificar).

## Capas del backend

`modules/<modulo>/{domain, application, infrastructure, http}`. El dominio no importa Express ni el ORM. Los controladores no contienen reglas de negocio.

## Commits y PRs

- Conventional Commits en español: `feat(inv): traslado entre ubicaciones con FEFO`.
- Alcances: `adm, cat, comp, prod, inv, com, dis, pos, fin, cont, ia, tg, mig, plat, docs`.
- Cada PR referencia sus IDs: `RF-###`, `BR-###`, `DEC-###`, y lista las pruebas ejecutadas.
- No se mezclan cambios de varios módulos verticales en un PR salvo dependencia directa.
- No se fusionan PRs de Dependabot ni se fusiona a `main` sin aprobación del responsable.

## Secretos

Nunca credenciales en el repositorio. Variables documentadas en `.env.example` sin valores reales. `BETTER_AUTH_SECRET` se genera por entorno (`openssl rand -base64 32`) y vive solo en `.env` o en el hosting.
