---
name: 'quatreros-decision-log'
description: 'Usar en Quatreros cuando el responsable, el contador u otro interesado responde una pregunta abierta o aprueba/rechaza una propuesta, para registrarlo de forma trazable.'
---

# Registro de decisiones en Quatreros

Archivos involucrados:

- `docs/00-discovery/decision-register.md`
- `docs/00-discovery/open-questions.md`
- `docs/00-discovery/traceability-matrix.md`
- `docs/PROJECT-STATUS.md`

## Pasos

1. **Identificar** la pregunta (`Q-xxx-##`), la clave del DM (`P-##`) o la propuesta (`DEC-P##`) a la que responde la decisión. Si no corresponde a ninguna, crear la pregunta primero.
2. **Verificar autoridad**: reglas de negocio → responsable del proyecto; políticas contables/fiscales → contador; decisiones técnicas reversibles → equipo (sin aprobación). Si quien responde no tiene autoridad, registrar como PROPOSED.
3. **Crear la decisión** con el siguiente `DEC-###` libre en la sección temática correcta, con: dominio, enunciado preciso, fuente (quién y fecha, p. ej. "Contador, 2026-11-05 (Q-CON-04)"), impacto y dependencias.
4. **Actualizar la propuesta de origen**: marcar `✅ APROBADA → DEC-###` o `❌ RECHAZADA (motivo)`. No borrar la fila.
5. **Actualizar `open-questions.md`**: tachar el ID (`~~Q-…~~`) y escribir "✅ Respondida → DEC-###". Si la respuesta abre preguntas nuevas, agregarlas con sufijo (`Q-INF-02b`).
6. **Actualizar contradicciones** (`C-##`) afectadas a "Resuelta por DEC-###".
7. **Actualizar la matriz de trazabilidad**: columna de bloqueos y disponibilidad (✅ / 🟨 / ⛔). Si una decisión desbloquea un módulo, reflejarlo también en la vista por flujo.
8. **Propagar** a requerimientos ya escritos: buscar los RF/BR que citaban la pregunta o la propuesta y cambiar su estado o texto. Listar en la respuesta qué artefactos cambiaron.
9. **Actualizar `PROJECT-STATUS.md`** si cambia la etapa o un bloqueo.

## Reglas

- Nunca registrar una respuesta parcial como decisión completa: separar lo decidido de lo que sigue pendiente.
- Nunca reinterpretar la respuesta para hacerla coincidir con la recomendación del equipo.
- Las respuestas sobre impuestos, facturación o contabilidad requieren al contador como fuente.
- Mantener los cambios mínimos: no reescribir documentos completos para registrar una decisión.
