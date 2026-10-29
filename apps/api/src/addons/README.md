# Complementos opcionales

Aquí vivirán `assistant/` (IA) y `telegram/`, junto con `tool-gateway/` (ADR-015).

Reglas (verificadas por `.dependency-cruiser.cjs`):

- Ningún módulo del núcleo (`src/modules/*`) importa nada de esta carpeta.
- Los complementos **no** acceden a la base de datos del núcleo ni a repositorios: solo invocan casos de uso a través del `ToolGateway`, con el contexto del usuario (`channel = assistant | telegram`).
- Se activan con `platform.addon_settings`; apagados, sus rutas responden 404.

Diseño: `docs/02-architecture/ai-architecture.md` y `telegram-architecture.md`. Se construyen después del núcleo, según el roadmap aprobado.
