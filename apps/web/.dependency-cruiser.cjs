/**
 * Fronteras de la SPA (ADR-024, module-boundaries.md).
 * Las capas de presentación pueden depender de las de abajo; nunca al contrario.
 * Se ejecuta en `pnpm lint` y en CI.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'componentes-sin-pages',
      comment: 'Un componente reutilizable no conoce las pantallas que lo montan.',
      severity: 'error',
      from: { path: '^src/components/' },
      to: { path: '^src/pages/' },
    },
    {
      name: 'hooks-sin-ui',
      comment: 'Los hooks no dependen de componentes ni de pantallas (solo de servicios y lib).',
      severity: 'error',
      from: { path: '^src/hooks/' },
      to: { path: '^src/(components|pages)/' },
    },
    {
      name: 'servicios-sin-ui',
      comment: 'La capa de servicios no conoce React: ni pantallas, ni componentes, ni hooks.',
      severity: 'error',
      from: { path: '^src/services/' },
      to: { path: '^src/(components|hooks|pages)/' },
    },
    {
      name: 'lib-puro',
      comment: 'lib/ es código puro: no importa presentación, estado ni llamadas a la API.',
      severity: 'error',
      from: { path: '^src/lib/' },
      to: { path: '^src/(components|config|hooks|pages|services)/' },
    },
    {
      name: 'config-sin-presentacion',
      comment: 'config/ describe el producto; no monta pantallas ni componentes.',
      severity: 'error',
      from: { path: '^src/config/' },
      to: { path: '^src/(components|hooks|pages|services)/' },
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
    exclude: { path: '\\.test\\.(ts|tsx)$|test-setup\\.ts$' },
  },
};
