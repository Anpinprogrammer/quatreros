# Roadmap del prototipo

> Etapa G · v1.0 · 2026-10-29 · Autorizado por el responsable (DEC-083).
> Objetivo: un prototipo **demostrable** del recorrido completo del negocio, con datos ficticios, construido con la misma calidad y arquitectura del producto final (no es desechable).
> Reglas: una entrega vertical a la vez (especificación → backend → frontend → pruebas); cada entrega es mostrable al terminar; las reglas `PROVISIONAL` (DEC-083) quedan configurables y señaladas.

## Entregas

| #   | Entrega                              | Qué se podrá mostrar                                                                                                                              | RF principales                         | Depende de                | Estado                                    |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------- | ----------------------------------------- |
| 1   | **Ingreso, usuarios, roles y sedes** | Iniciar sesión con usuarios demo por rol; cada rol entra a su pantalla; MFA en roles sensibles; el administrador ve y crea usuarios               | RF-001, RF-003, RF-004, RF-005         | —                         | **Terminada** ✅                          |
| 2   | Catálogo e inventario                | Productos en unidad y paquete, materias primas, precios; existencias por lote y vencimiento; FEFO; traslado bodega → punto de venta; trazabilidad | RF-030–033, RF-110–114, RF-117, RF-118 | 1                         | **Siguiente** (plan en `docs/HANDOFF.md`) |
| 3   | Compras y recepción                  | Compra a proveedor y recepción que crea lotes de materia prima                                                                                    | RF-050–052                             | 2                         | Pendiente                                 |
| 4   | Producción                           | Orden de producción, consumo real por lote, lote terminado con rendimiento                                                                        | RF-080–083                             | 2, 3                      | Pendiente                                 |
| 5   | Pedidos y reparto                    | Cliente con crédito, pedido, despacho, entrega parcial y cobro desde el celular del repartidor                                                    | RF-150–152, RF-180–185, RF-260–261     | 2                         | Pendiente                                 |
| 6   | Caja (POS)                           | Abrir turno, vender fabricados y platos, pago mixto, cierre con arqueo y revisión de diferencias                                                  | RF-220–224                             | 2                         | Pendiente                                 |
| 7   | Cartera, recaudos y tablero          | Cartera por antigüedad, abonos, conciliación de recaudos, resumen del día, hechos económicos                                                      | RF-262–266, RF-303                     | 5, 6                      | Pendiente                                 |
| 8   | Asistente de IA (demo)               | Preguntas en lenguaje natural y un registro con resumen y confirmación                                                                            | RF-340–345                             | 2–7 + proveedor (DEC-085) | Pendiente                                 |
| —   | Publicación en línea                 | Enlace para compartir la demo                                                                                                                     | —                                      | Hosting (Q-C-01, DEC-084) | Pendiente                                 |

## Fuera del prototipo

Contabilización automática, impuestos y factura electrónica (P-01..P-04, contador) · apertura de paquetes (P-06) · liquidación de repartidores (P-08) · descuentos, anulaciones y reembolsos (P-09) · clasificación de mermas de cocina (P-07) · vencidos y retiros (P-05) · Telegram · carga inicial real y piloto. Las funciones bloqueadas se muestran como "pendiente de decisión".

## Definición de terminado (cada entrega)

- Especificación en `docs/04-specifications/` con criterios de aceptación.
- Backend con permisos, sede, auditoría e idempotencia donde aplique; migración revisada.
- Frontend usable en el dispositivo de su rol (escritorio, tableta o celular).
- Pruebas: unitarias, integración con PostgreSQL real (éxito, validación, permiso, sede ajena, duplicado) y E2E del flujo principal.
- CI en verde en GitHub; `PROJECT-STATUS.md` y matriz de trazabilidad actualizados.

## Antes del piloto (no antes)

Confirmar o cambiar las decisiones `PROVISIONAL` (Q-B-01..09), contratar el hosting, respuestas del contador y criterios de éxito del piloto (P-16).
