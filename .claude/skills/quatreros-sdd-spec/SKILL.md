---
name: 'quatreros-sdd-spec'
description: 'Usar al escribir requerimientos (RF, RNF, BR) o la especificación de una funcionalidad vertical de Quatreros bajo Spec-Driven Development.'
---

# Especificaciones SDD en Quatreros

Secuencia: Descubrimiento → Especificación → Diseño técnico → Plan → Tareas → Pruebas → Código. No se escribe código de una funcionalidad sin especificación aprobada.

## Antes de escribir

1. Leer `quatreros-conventions` y el glosario.
2. Ubicar en `docs/00-discovery/traceability-matrix.md` las decisiones de origen y el rango de IDs reservado del módulo.
3. Revisar `open-questions.md`: toda dependencia no resuelta se marca PENDING o BLOCKED, nunca se rellena con supuestos.

## Identificadores

- Usar el rango reservado del módulo (sección 2 de la matriz). No reutilizar IDs eliminados.
- `RF-###` funcional · `RNF-###` no funcional · `BR-###` regla de negocio.

## Plantilla RF

```
### RF-### — <título>
- Módulo:
- Descripción:
- Actor responsable:
- Precondiciones:
- Flujo esperado: (pasos numerados)
- Excepciones: (incluir operación duplicada, permiso insuficiente, sede ajena)
- Reglas relacionadas: BR-###
- Dependencias: RF-### / Q-###
- Prioridad sugerida: Alta | Media | Baja
- Estado: CONFIRMED | PROPOSED | PENDING | BLOCKED
- Fuente: DM §x.y / DEC-###
```

## Plantilla BR

```
### BR-### — <título>
- Enunciado verificable (una sola regla, sin "y/o" ambiguos)
- Ejemplo concreto (datos de entrada → resultado)
- Estado y fuente (DM §, DEC-###)
- Aprobación requerida de: <rol>, si es PROPOSED
```

## Plantilla RNF

Categoría, enunciado, métrica medible, valor propuesto, **estado PENDING hasta aprobación** (no inventar cifras como hechos), fuente.

## Especificación de funcionalidad vertical (`docs/04-specifications/<modulo>/<feature>.md`)

1. Objetivo y alcance (incluye y excluye).
2. RF/BR cubiertos.
3. Modelo de datos afectado (tablas, restricciones, índices).
4. Contrato de API (endpoints, validación, errores, permisos, idempotencia).
5. UI: pantallas y estados (vacío, carga, error, sin permiso).
6. Auditoría y eventos económicos emitidos.
7. Criterios de aceptación en Gherkin (`Dado / Cuando / Entonces`), incluyendo: éxito, error de validación, permiso denegado, sede ajena, operación duplicada, concurrencia cuando aplique.
8. Pruebas: unitarias, integración (con BD real), E2E del flujo principal.
9. Condiciones para comenzar y Definición de Terminado.

## Lista de verificación final

- Cada RF tiene fuente y al menos un BR o justificación.
- Ninguna regla sin origen; las ampliaciones se marcan **[Ampliación]** y PROPOSED.
- Términos coinciden con el glosario.
- Ningún módulo BLOCKED se especifica más allá de lo conceptual.
- La matriz de trazabilidad queda actualizada con los nuevos IDs.
- Preguntas nuevas agregadas a `open-questions.md`, agrupadas y con recomendación.
