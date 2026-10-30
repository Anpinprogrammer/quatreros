# Diseño de la interfaz

**Fuente única:** [`docs/05-design/sistema-de-diseno.md`](../../docs/05-design/sistema-de-diseno.md) — Sistema de Diseño "Los Quatreros" (DEC-086). No se usan colores, tipografías ni componentes fuera de ese sistema.

Reglas de implementación que se mantienen:

- Tokens solo vía Tailwind (`bg-smoke`, `text-ash`, `bg-ember`…); nada de colores sueltos en componentes.
- Componentes base en `src/shared/ui/`; las pantallas no redefinen botones, cards ni badges.
- Montos, cantidades, pesos, códigos y totales en `font-mono` (JetBrains Mono), alineados a la derecha, siempre con unidad o presentación (RNF-075).
- Objetivos táctiles ≥ 44 px; botón primario ≥ 52 px; inputs ≥ 48 px (RNF-072 y UI Kit).
- Foco visible siempre (anillo Ember); `prefers-reduced-motion` sin transiciones ni desplazamientos.
- Accesibilidad AA según el Anexo A del sistema de diseño.
- Sin `dangerouslySetInnerHTML` (lint).
