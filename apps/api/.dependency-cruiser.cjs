/**
 * Fronteras entre módulos (ADR-001, ADR-015, module-boundaries.md).
 * Se ejecuta en `pnpm lint` y en CI.
 */
const CORE =
  '^src/modules/(admin|catalog|purchasing|production|inventory|sales|distribution|pos|finance|accounting)/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-no-depende-de-complementos',
      comment: 'El núcleo no puede importar el asistente, Telegram ni el ToolGateway (DEC-071, PM §4.A).',
      severity: 'error',
      from: { path: CORE },
      to: { path: '^src/(addons|modules/(assistant|telegram))/' },
    },
    {
      name: 'complementos-solo-via-toolgateway',
      comment: 'Los complementos solo usan el ToolGateway, nunca repositorios ni la BD del núcleo.',
      severity: 'error',
      from: { path: '^src/addons/(assistant|telegram)/' },
      to: { path: `${CORE}(infrastructure|domain)/|^src/platform/db/` },
    },
    {
      name: 'dominio-sin-infraestructura',
      comment: 'domain/ no importa Express, Drizzle, pg ni infraestructura (system-overview §2).',
      severity: 'error',
      from: { path: '/domain/' },
      to: { path: '(node_modules/(express|drizzle-orm|pg|pino)|/infrastructure/|/http/)' },
    },
    {
      name: 'acceso-entre-modulos-solo-por-public',
      comment: 'Un módulo solo importa de otro a través de application/public.ts.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/application/public\\.ts$'],
      },
    },
    {
      name: 'sin-ciclos',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    exclude: { path: '\\.test\\.ts$' },
  },
};
