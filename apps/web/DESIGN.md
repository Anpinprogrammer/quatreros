# Sistema visual de Quatreros (base)

Herramienta de trabajo para una fábrica de chorizos y rellenas en Cali: cajeros en tableta junto a la parrilla, repartidores en celular bajo el sol, administración en escritorio. La prioridad es **leer rápido y no equivocarse con cantidades y dinero**.

## Tokens

| Token                | Hex       | Uso                                                                                 |
| -------------------- | --------- | ----------------------------------------------------------------------------------- |
| `ink`                | `#1E2A24` | Texto principal (carbón verdoso, no negro puro)                                     |
| `surface`            | `#F5F7F6` | Fondo de la aplicación (frío y claro: se lee bien en pantallas brillantes y al sol) |
| `panel`              | `#FFFFFF` | Superficies de trabajo                                                              |
| `line`               | `#D5DDD8` | Bordes y separadores                                                                |
| `chimichurri`        | `#2D6A4F` | Acción principal, foco, estado "listo"                                              |
| `chimichurri-strong` | `#1B4332` | Hover/pulsado de la acción principal                                                |
| `brasa`              | `#D99A0B` | Atención: pendiente, bloqueado por decisión, requiere aprobación                    |
| `alerta`             | `#B3261E` | Errores, diferencias de caja, faltantes                                             |

Contraste: `ink` sobre `surface` ≈ 13:1; blanco sobre `chimichurri` ≈ 6,6:1 (AA en texto normal).

## Tipografía

- **Atkinson Hyperlegible Next** (variable, autoalojada con Fontsource — sin peticiones a terceros, compatible con la CSP). Diseñada para distinguir caracteres confundibles (0/O, 1/l/I), clave en cantidades, consecutivos y montos.
- Cifras **tabulares** (`font-variant-numeric: tabular-nums`) en toda cantidad y monto para que las columnas alineen.
- Escala 1,25: 14 · 16 · 20 · 25 · 31 px. Pesos 400 (texto), 600 (énfasis), 700 (montos totales).
- Sin mayúsculas sostenidas en etiquetas; sentence case en todo.

## Estructura por shell

```
ERP (escritorio/tableta)          POS (tableta táctil)              Ruta (celular)
┌────────┬──────────────────┐     ┌──────────────────┬─────────┐    ┌──────────────┐
│ módulos│ área de trabajo  │     │ catálogo táctil  │ ticket  │    │ despacho hoy │
│ por    │                  │     │ (botones ≥ 64px) │ y pagos │    │ pedido 1     │
│ proceso│                  │     │                  │         │    │ pedido 2 ... │
└────────┴──────────────────┘     └──────────────────┴─────────┘    └──────────────┘
```

Contenido alineado a la izquierda; montos alineados a la derecha.

## Principio distintivo

El único elemento "memorable" es honesto: la navegación del ERP muestra **el estado real de cada módulo** (disponible, en construcción o bloqueado por una decisión pendiente con su clave P-xx), en coherencia con el registro de decisiones. Todo lo demás es sobrio.

## Reglas

- Objetivos táctiles ≥ 44 px (≥ 64 px en el catálogo del POS) — RNF-072.
- Foco visible siempre (anillo `chimichurri`, 2 px + separación).
- `prefers-reduced-motion`: sin transiciones.
- Toda cantidad con su unidad o presentación (RNF-075).
- Sin `dangerouslySetInnerHTML` (lint).
