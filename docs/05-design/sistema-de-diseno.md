# Sistema de Diseño y Prototipado UI/UX: Plataforma ERP/POS "Los Quatreros"

> **Fuente oficial:** documento entregado por el responsable del proyecto el 2026-10-29, conservado sin cambios en [`original/sistema-de-diseno-los-quatreros-v1.txt`](original/sistema-de-diseno-los-quatreros-v1.txt).
> **Decisión:** DEC-086. Toda interfaz de Quatreros se diseña **exclusivamente** con este sistema.
> Este archivo transcribe el original a Markdown (partes 1 y 2) y agrega al final dos anexos del equipo: ajustes de accesibilidad y alcance de la especificación de pantallas. Los anexos no cambian el original; si hay diferencia, el original manda salvo en lo que el Anexo A justifica por accesibilidad.

---

## PARTE 1: DESIGN SYSTEM OFICIAL (Tokens & UI Kit)

### 1. Paleta de color (tokens extraídos del isotipo)

A partir de la identidad del logo oficial (personaje embutido a la parrilla, sombrero vaquero, tipografía desgastada y anillo exterior), se define un sistema de color de alto contraste en **modo oscuro por defecto** (Dark Mode Native), ideal para entornos de cocina, operación POS nocturna/continua y uso móvil en exterior.

| Token                            | HEX       | Descripción / uso                                                                                            |
| -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| Primary / Ember Orange           | `#EA580C` | Color dominante (anillo exterior y tono medio del chorizo). Botones primarios, estados activos, selecciones. |
| Primary Hover / Flame Red-Orange | `#C2410C` | Tono tostado/asado. Estados hover/focus en elementos de acción.                                              |
| Accent / Terracotta Gold         | `#F97316` | Acentos de alerta sutil, resaltados y micro-badges.                                                          |
| Background / Char Black          | `#09090B` | Fondo principal profundo estilo carbón (Zinc-950).                                                           |
| Surface Dark / Smoked Charcoal   | `#18181B` | Superficie de cards, bento grids y contenedores elevación L1 (Zinc-900).                                     |
| Surface Border / Grill Gray      | `#27272A` | Bordes sutiles de cards, separadores e inputs (Zinc-800).                                                    |
| Text Primary / Pure Chalk        | `#FFFFFF` | Textos de alto contraste y títulos bold.                                                                     |
| Text Muted / Ash Gray            | `#A1A1AA` | Metadatos, etiquetas secundarias y descripciones.                                                            |
| Semantic Success                 | `#22C55E` | Entregado, lote óptimo, caja cuadrada, cobro recibido.                                                       |
| Semantic Warning                 | `#EAB308` | Vencimiento próximo (FEFO), cupo de crédito al 80 %, stock bajo.                                             |
| Semantic Danger                  | `#EF4444` | Lote vencido, crédito excedido, descuadre de caja, merma crítica.                                            |
| Semantic Info                    | `#3B82F6` | Pedido reasignado, proceso en cocina, sugerencia IA.                                                         |

### 2. Tipografía y estilos de texto

Para compatibilidad con React + Tailwind CSS y legibilidad en pantallas táctiles o móviles de baja resolución:

- **Tipografía principal:** Inter o Plus Jakarta Sans (sans-serif moderna con excelente x-height). _Implementación: Inter._
- **Tipografía numérica (POS y caja):** JetBrains Mono (monoespaciada para alineación perfecta de precios, cantidades y pesos).

| Estilo          | Tamaño / interlineado | Uso                                                  |
| --------------- | --------------------- | ---------------------------------------------------- |
| Display Bold    | 28 px / 32 px         | Indicadores KPI, totales POS, encabezados bento grid |
| Title SemiBold  | 20 px / 24 px         | Títulos de cards, nombres de productos               |
| Body Medium     | 14 px / 20 px         | Texto operativo, inputs, opciones de menú            |
| Caption Regular | 12 px / 16 px         | Metadatos, lotes FEFO, timestamps                    |

### 3. Componentes clave y UI Kit

**A. Botones (`Button.tsx`)**

- **Primary Action (POS / Confirmar):** fondo `#EA580C`, texto `#FFFFFF`, bordes `rounded-xl`, sombra de brillo de brasa (`shadow-orange-950/50`), alto mínimo de 52 px para interacción táctil rápida sin margen de error.
- **Secondary Action:** fondo `#27272A`, borde 1 px sólido `#3F3F46`, texto `#FFFFFF`.
- **Ghost / Cancel:** borde transparente, texto `#A1A1AA`, hover a `#27272A`.

**B. Cards y contenedores bento (`Card.tsx`)**

- Estructura: `bg-[#18181B] border border-[#27272A] rounded-2xl p-5 shadow-xl transition-all duration-200`.
- Efecto hover: `hover:border-[#EA580C]/50 hover:translate-y-[-2px]`.

**C. Badges de estado (`Badge.tsx`)**

| Estado                     | Clases                                                         |
| -------------------------- | -------------------------------------------------------------- |
| Lote vencido               | `bg-red-500/10 text-red-400 border border-red-500/20`          |
| Lote FEFO próximo          | `bg-yellow-500/10 text-yellow-400 border border-yellow-500/20` |
| Entregado parcial          | `bg-blue-500/10 text-blue-400 border border-blue-500/20`       |
| Paquete abierto (desglose) | `bg-orange-500/10 text-orange-400 border border-orange-500/20` |

**D. Inputs y controles táctiles (`Input.tsx` / `Keypad.tsx`)**

Campos numéricos con teclado gigante integrado (Big Numpad Overlay) para cajeros y personal con guantes o movilidad ágil. Altura mínima de input: 48 px.

---

## PARTE 2: ESPECIFICACIÓN Y FLUJO DE PANTALLAS DEL PROTOTIPO

### Encabezado de la plataforma

```
+---------------------------------------------------------------------------------------+
|                               QUATREROS PLATFORM (HEADER)                             |
|  [Logo Quatreros] [Sede: Bodega Principal v]  [Turno: Abierto]   (🤖 IA Assistant)   |
+---------------------------------------------------------------------------------------+
|  [01. Command Center]  [02. POS/Cocina]  [03. Reparto]  [04. Producción]  [05. IA Log] |
+---------------------------------------------------------------------------------------+
```

### 1. Dashboard principal / Command Center

Enfoque: bento grid interactivo, sin tablas aburridas. Vista ejecutiva en tiempo real del estado de la empresa.

```
+-----------------------------------+-----------------------------------+-----------------------------------+
| 📊 VENTAS DEL DÍA (HOY)           | 🚚 ESTADO DE REPARTO              | 🥩 PRODUCCIÓN & MERMAS           |
| $ 4,850,000 COP                   | [8/12 Entregados] [3 En Ruta]     | 450 Kg Chorizo Santarrosano       |
| (+14% vs ayer) [Gráfica de Área]  | [1 Entrega Parcial / Pendiente]   | Rendimiento Promedio: 96.2%       |
+-----------------------------------+-----------------------------------+-----------------------------------+
| ⚠️ ALERTAS FEFO & SALIDA PREFERENTE (Inventario Prioritario)                                              |
|  - Lote #CH-20261024 (Chorizo Premium) -> Vence en 3 Días (12 Paquetes restantes en Bodega) [Despachar]   |
|  - Lote #RL-20261020 (Rellena Mixta)   -> Vence en 1 Día  (4 Paquetes restantes) [Mover a POS]            |
+-----------------------------------------------------------------------+-----------------------------------+
| 💰 ESTADO DE CAJA POS             | 💳 CRÉDITO & CARTERA              | 🤖 SUGERENCIA DE IA               |
| Caja #1: $ 1,240,000 COP          | 3 Clientes superaron el 80% cupo  | "Sugerencia: Producir 200 paquetes|
| [Efectivo / Nequi / Datafono]     | [Cliente Rest. El Rancho: $1.2M]  | de Chorizo para cubrir viernes"   |
+-----------------------------------+-----------------------------------+-----------------------------------+
```

Micro-interacciones:

- Clic en alerta FEFO abre directo el modal de traslado a POS o descuento de lote.
- Hover sobre barras de rendimiento de producción revela el consumo real vs. receta base.

### 2. Terminal POS y cocina

Enfoque: interfaz híbrida para pantallas táctiles de 15" a 22". División de inventario entre productos listos para venta de mostrador y consumo en cocina de asados.

```
+-------------------------------------------------------------+---------------------------------------------+
| CATÁLOGO DE PRODUCTOS (Grid Táctil 4x3 con imágenes)        | TICKET DE VENTA ACTUAL (Orden #1042)        |
+-------------------------------------------------------------+---------------------------------------------+
| +-------------------+ +-------------------+                 | 1x Picada Quatrera XL       $ 45,000        |
| | [Img Chorizo]     | | [Img Rellena]     |                 | 2x Chorizo Individual       $ 12,000        |
| | Chorizo Porción   | | Rellena Tradic.   |                 | 1x Gaseosa 1.5L             $  7,000        |
| | $ 6,000 (Stock:42)| | $ 5,500 (Stock:18)|                 | ------------------------------------------- |
| +-------------------+ +-------------------+                 | Subtotal:                   $ 64,000        |
| +-------------------+ +-------------------+                 | Impuestos incluidos:        $      0        |
| | [Img Paquete 10u] | | [Img Asado Mix]   |                 | TOTAL A PAGAR:              $ 64,000        |
| | Paq. Chorizo x10  | | Combo Parrillero  |                 +---------------------------------------------+
| | $ 52,000 (Stk:15) | | $ 38,000 (Stk:8)  |                 | MÉTODO DE PAGO MIXTO [POS-01]               |
| +-------------------+ +-------------------+                 | [ $ Efectivo ]   [ 📲 Nequi / PSE ]        |
| ⚡ [BOTÓN: ABRIR PAQUETE EN COSTA] (Desglose 1 Paq -> 10u)   | [ 💳 Débito/Crédito ] [ 🤝 Crédito Cliente] |
+-------------------------------------------------------------+---------------------------------------------+
| 👨‍🍳 MONITOR DE COCINA (Barra Inferior de Estado)            | [ CANCELAR ]   [ 🖨️ COBRAR E IMPRIMIR ]     |
|  - Conteo Inicial/Final de Cocina | Merma Teórica calculada | (Botón Verde Gigante $64,000)                |
+-------------------------------------------------------------+---------------------------------------------+
```

Flujo y UI clave:

- **Desglose rápido:** si un producto individual se agota, el cajero presiona "Abrir paquete"; el sistema descuenta 1 paquete del inventario y suma 10 unidades individuales al POS en un toque.
- **Pago mixto:** modal flotante para ingresar parciales (p. ej. $20,000 efectivo + $44,000 Nequi) con cálculo automático de cambio.

### 3. Portal móvil de distribución (repartidores)

Enfoque: mobile-first (pantalla vertical de smartphone). Operación rápida en calle.

```
+-----------------------------------+
| 🚚 QUATREROS - DISTRIBUCIÓN       |
| Repartidor: Carlos V. | 29 Oct    |
+-----------------------------------+
| RUTAS DEL DÍA (4 Pedidos)         |
+-----------------------------------+
| 🔴 PEDIDO #D-882 (EN RUTA)        |
| Cliente: Restaurante Don Pedro    |
| Dirección: Cl. 15 #4-20           |
| Total: $ 480,000 COP (Contraentrega)|
| Items: 10 Paq. Chorizo, 5 Rellena |
| [ 📞 Llamar ]   [ 📍 Ver Mapa ]   |
| +-------------------------------+ |
| | [ REGISTRAR ENTREGA / COBRO ] | |
| +-------------------------------+ |
+-----------------------------------+
| 🟢 PEDIDO #D-881 (COMPLETADO)     |
| Cliente: Asaderos El Sur - $210k  |
+-----------------------------------+
```

Modal de entrega parcial / devolución (flujo crítico en calle):

```
+---------------------------------------------------+
| 📦 REGISTRO DE ENTREGA - PEDIDO #D-882            |
+---------------------------------------------------+
| Item: Paquete Chorizo x10                         |
| Solicitado: 10 Paquetes                           |
| Recibido:   [  8  ] (-2 rechazados por empaque)   |
|                                                   |
| Motivo Devolución: [ Empaque dañado / Rotura v ]  |
| Destino Devolución: [ Inspección en Bodega   v ]  |
|                                                   |
| Recaudo Reajustado: $ 384,000 COP                 |
| Método de Cobro: [ Efectivo / Nequi / Crédito ]   |
|                                                   |
| [ 📷 Tomar Foto Evidencia ]                       |
| [ 🖊️ Firma Digital del Cliente ]                 |
|                                                   |
| [ CONFIRMAR ENTREGA PARCIAL ]                     |
+---------------------------------------------------+
```

### 4. Módulo de producción e inventarios

Enfoque: trazabilidad visual de lotes, recetas base y control FEFO.

```
+---------------------------------------------------------------------------------------+
| 🥩 ORDEN DE PRODUCCIÓN #OP-504 | Estado: En Proceso                                   |
+---------------------------------------------------------------------------------------+
| Producto a Fabricar: Chorizo Santarrosano (Lote objetivo: 500 Kg)                     |
| Fecha de Fabricación: 29/10/2026 | Vencimiento Estimado: 29/11/2026 (FEFO Auto-generated)|
+---------------------------------------------------------------------------------------+
| RECETA BASE & CONSUMO DE MATERIA PRIMA (Salida por Lote Insumos FEFO)                  |
|  - Carne de Cerdo Magra:  300 Kg  -> Lote Insumo #MP-882 (Vence 05/11)  [OK]          |
|  - Tocino / Grasa:        150 Kg  -> Lote Insumo #MP-790 (Vence 02/11)  [OK]          |
|  - Mix de Especias/Tripa:  50 Kg  -> Lote Insumo #MP-901 (Vence 15/12)  [OK]          |
+---------------------------------------------------------------------------------------+
| 📈 METRICAS DE RENDIMIENTO DE BATCH                                                   |
| Peso Teórico Esperado: 500.0 Kg                                                       |
| Peso Real Ingresado:   488.5 Kg  | Merma de Proceso: 11.5 Kg (2.3%) [Dentro de Tolerancia]|
+---------------------------------------------------------------------------------------+
| [ 🔄 AJUSTAR RECETA ]                        [ 🏭 FINALIZAR BATCH Y GENERAR LOTE ]   |
+---------------------------------------------------------------------------------------+
```

### 5. Asistente de IA (drawer / widget flotante)

Enfoque: interfaz conversacional limpia con política estricta de human-in-the-loop y confirmación explícita de escritura.

```
+-----------------------------------------------------------------------+
| 🤖 ASISTENTE QUATREROS (AI Drawer)                                [X] |
+-----------------------------------------------------------------------+
| 👤 Usuario: "Registra una compra de 100kg de carne de cerdo a         |
|             Distribuidora Cárnica del Valle por $1.500.000"           |
|                                                                       |
| 🤖 IA: "Entendido. He procesado la solicitud. Revisa el borrador      |
|        a continuación para autorizar la orden de compra."             |
|                                                                       |
| +-------------------------------------------------------------------+ |
| | ⚠️ REQUERE CONFIRMACIÓN DE ESCRITURA EN SISTEMA                   | |
| |                                                                   | |
| | • Tipo de Operación: Registro de Compra / Entrada de Materia Prima| |
| | • Proveedor: Distribuidora Cárnica del Valle                      | |
| | • Ítem: Carne de Cerdo Magra (100 Kg)                             | |
| | • Valor Total: $ 1,500,000 COP ($15,000 / Kg)                     | |
| | • Asignación: Bodega Principal                                    | |
| | • Consecuencia: Se generará cuenta por pagar y entrada de inventario| |
| |                                                                   | |
| | [ ❌ CANCELAR / DESCARTAR ]    [ 🚀 CONFIRMAR Y GUARDAR DATO ]    | |
| +-------------------------------------------------------------------+ |
+-----------------------------------------------------------------------+
```

Micro-interacción: el botón "Confirmar y guardar dato" ejecuta la mutación en el backend (Express/PostgreSQL) y muestra un toast flotante en verde: "✅ Compra #C-302 creada con éxito".

---

## Anexo A (equipo) — Ajustes de accesibilidad WCAG 2.1 AA

Medidos con la fórmula de contraste de WCAG sobre los tokens oficiales. Solo se ajusta lo que no alcanza AA; el resto se usa tal cual.

| Elemento                              | Original                  | Contraste | Ajuste aplicado                                                                                                             | Resultado |
| ------------------------------------- | ------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- | --------- |
| Texto del botón primario              | blanco sobre `#EA580C`    | 3,56:1    | Colores sin cambio; la etiqueta del botón primario es **texto grande** (≥ 18,66 px en negrita), para el que AA exige 3:1    | Cumple    |
| Borde de inputs (identifica el campo) | `#27272A` sobre `#18181B` | 1,19:1    | Inputs, selects y checkboxes usan **`#71717A` (Zinc-500)** como borde. Cards y separadores conservan `#27272A` (decorativo) | 3,67:1    |
| Tamaño de texto en inputs (celular)   | 14 px                     | —         | 16 px en pantallas < 640 px (iOS amplía la página al enfocar campos de menos de 16 px); 14 px desde 640 px                  | —         |
| Desplazamiento en hover de cards      | `translate-y-[-2px]`      | —         | Se desactiva con `prefers-reduced-motion`                                                                                   | —         |
| Foco de teclado                       | (no especificado)         | 5,59:1    | Anillo de 2 px en Ember Orange con separación                                                                               | Cumple    |

Pares que cumplen sin ajuste (≥ 4,5:1): blanco sobre fondo 19,9; Ash Gray sobre fondo 7,8 / sobre card 6,9 / sobre `#27272A` 5,8; Ember como texto sobre fondo 5,6 / sobre card 5,0; Danger 4,7; Info 4,8; Success 7,8; Warning 9,2; los cuatro badges entre 5,8 y 9,6.

## Anexo B (equipo) — Alcance de la especificación de pantallas (Parte 2)

La Parte 2 define **cómo se ven y se recorren** las pantallas. Las reglas de negocio siguen saliendo de los requerimientos y del registro de decisiones (regla del Prompt Maestro: no inventar reglas). Por eso:

- Los **datos de ejemplo** de los bocetos (montos, lotes, clientes, porcentajes) son ilustrativos; el prototipo muestra datos de la semilla demo cuando el módulo exista, y estados vacíos honestos antes.
- Elementos que dependen de decisiones abiertas se construyen cuando se resuelvan: **Abrir paquete / desglose 1→10** (P-06), **impuestos en el ticket** (P-01..P-04, contador), **escrituras de la IA** (P-10, DEC-085), **liquidación del repartidor** (P-08). Hasta entonces aparecen como "Espera decisión".
- **Encabezado:** el selector de sede aparece cuando haya una función que dependa de la sede activa (entrega 2); "Turno" aparece en Caja con la entrega 6; el botón del asistente de IA con la entrega 8.
- **Pestañas del ERP:** se conservan las pestañas de la Parte 2 y se agregan las áreas confirmadas en requerimientos que no figuran en el boceto (Compras, Cartera y contabilidad, Administración), para que todo módulo tenga un lugar.
- **Logo:** pendiente de recibir el archivo del isotipo; mientras tanto se usa el nombre "Quatreros" como logotipo de texto.

## Anexo C (equipo) — Implementación

- Tokens en `apps/web/src/styles.css` (`@theme` de Tailwind 4): `ember`, `ember-hover`, `terracotta`, `char`, `smoke`, `grill`, `grill-strong` (`#3F3F46`), `control` (`#71717A`, Anexo A), `chalk`, `ash`, `success`, `warning`, `danger`, `info`.
- Fuentes autoalojadas con Fontsource (compatibles con la CSP, sin peticiones a terceros): `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`.
- Componentes en `apps/web/src/shared/ui/`: `Button` (primary/secondary/ghost/danger), `Card`, `Badge`, `TextField`, `PasswordField`, `CheckboxGroup`, `Alert`.
- Montos, cantidades, códigos y totales en JetBrains Mono (`font-mono`), alineados a la derecha.
