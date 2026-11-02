# Estructura de la SPA

`apps/web/src` se organiza por **capas de responsabilidad**, no por carpeta de funcionalidad. Cada archivo tiene un solo lugar posible y las dependencias solo apuntan hacia abajo (ADR-024).

```
apps/web/src/
├── main.tsx                 entrada: aplica el tema y monta React
├── app/App.tsx              composición: providers, router y guardas
├── pages/                   una pantalla por archivo, agrupada por módulo
│   ├── acceso/ catalogo/ compras/ erp/ existencias/
│   └── pos/ produccion/ ruta/ usuarios/ ventas/
├── components/              piezas reutilizables
│   ├── ui/                  sistema de diseño (Button, Card, Badge, form…)
│   ├── layout/              cabecera, barra lateral, paleta y asistente
│   ├── auth/                guarda de sesión y mensajes de página completa
│   └── <módulo>/            formularios, tablas y paneles del módulo
├── hooks/                   estado de React (sesión, tema, título de la página)
├── services/                cliente HTTP y consultas/mutaciones por módulo
├── lib/                     funciones puras (permisos, formatos, contraseñas, tema)
└── config/modules.ts        registro de secciones, módulos y permisos de navegación
```

## Qué va en cada capa

| Capa          | Contiene                                                                 | Puede importar                                          |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| `pages/`      | Pantallas montadas por el router y los shells. Componen, no implementan. | `components/`, `hooks/`, `services/`, `lib/`, `config/` |
| `components/` | UI reutilizable; el sistema de diseño vive en `components/ui/`.          | `hooks/`, `services/`, `lib/`, `config/`                |
| `hooks/`      | Hooks de React transversales (sesión, tema, título).                     | `services/`, `lib/`, `config/`                          |
| `services/`   | Cliente HTTP y módulos de datos con TanStack Query por módulo.           | `services/`, `lib/`                                     |
| `lib/`        | Funciones puras sin React ni red: permisos, formatos, contraseñas, tema. | `lib/`                                                  |
| `config/`     | Configuración de producto: secciones, módulos y su estado.               | `lib/`                                                  |

Reglas que verifica `pnpm deps:check` (`apps/web/.dependency-cruiser.cjs`):

1. `components/` no importa `pages/`.
2. `hooks/` no importa `components/` ni `pages/`.
3. `services/` no importa `components/`, `hooks/` ni `pages/`.
4. `lib/` no importa `components/`, `config/`, `hooks/`, `pages/` ni `services/`.
5. `config/` no importa `components/`, `hooks/`, `pages/` ni `services/`.
6. No hay ciclos.

Además:

- **Sin alias ni `index.ts` agregadores.** Las importaciones son relativas y apuntan al archivo real.
- **El sistema de diseño es la única fuente visual** (`components/ui/` y los tokens de `styles.css`). Una pantalla no redefine botones, campos ni tarjetas.
- **La autorización real está en el servidor.** `lib/session.ts` y `components/auth/RequireSession.tsx` solo evitan mostrar pantallas inútiles.
- **Las pruebas viven junto al archivo que prueban** (`*.test.ts` / `*.test.tsx`).

## Cómo agregar una pantalla

1. Si necesita datos nuevos, agrega la consulta o mutación en `services/<módulo>.ts` con las claves de TanStack Query del módulo.
2. Crea la pantalla en `pages/<módulo>/<Pantalla>.tsx` y sus piezas propias en `components/<módulo>/`.
3. Regístrala en el shell correspondiente (`pages/erp/ErpShell.tsx`, `pages/pos/PosShell.tsx` o `pages/ruta/RutaShell.tsx`) y declara el módulo en `config/modules.ts` si aparece en la navegación.
4. Agrégala a `apps/web/e2e/accesibilidad.spec.ts` (WCAG 2.1 AA y captura para revisión visual).
5. Ejecuta `pnpm check` y los E2E que correspondan.
