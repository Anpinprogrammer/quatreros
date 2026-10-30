# Complementos opcionales

Aquí vivirán `assistant/` (IA), `telegram/` y `tool-gateway/` (ADR-015).

Reglas (verificadas por `.dependency-cruiser.cjs`):

- Ningún módulo del núcleo (`src/modules/*`) importa nada de esta carpeta.
- Los complementos **no** acceden a la base de datos del núcleo ni a repositorios. Solo invocan casos de uso a través del `ToolGateway`, con el contexto del usuario (`channel = assistant | telegram`).
- Se activan con `platform.addon_settings`. Apagados, sus rutas responden 404.

## assistant: Quatreros AI (ADR-023)

El asistente es el agente **Quatreros AI** de Anthropic Managed Agents. Su configuración (prompt, modelo, herramientas y entorno) **no está aquí**: vive en [`/quatreros-ai/`](../../../../quatreros-ai/) y se sincroniza con `ant apply` (ai-architecture §11). Este complemento es el **cliente** del agente:

- abre una sesión por empleado y canal;
- envía los mensajes del empleado;
- resuelve cada `agent.custom_tool_use` contra el `ToolGateway`, con la identidad tomada de la sesión;
- crea propuestas que solo se ejecutan cuando un humano confirma;
- mide el consumo.

El SDK `@anthropic-ai/sdk` solo se usa dentro de `assistant/infrastructure/anthropic/`.

Estructura prevista: `docs/02-architecture/module-boundaries.md` (assistant / telegram).
Diseño completo: `docs/02-architecture/ai-architecture.md` y `telegram-architecture.md`.
Estado: **no implementado**. Se construye en la entrega 8 del roadmap; las herramientas de lectura, a medida que existan sus módulos (ai-architecture §14 y §15).
