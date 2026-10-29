# Política de secretos

1. **Ningún secreto en el repositorio.** Solo `.env.example` con nombres y descripción. `.env` está en `.gitignore`.
2. **Detección:** gitleaks en CI (bloqueante) y en el hook de pre-commit cuando está instalado.
3. **Dónde viven:** gestor de variables del hosting por ambiente; las contraseñas de desarrollo local solo existen en `infrastructure/docker/initdb/01-roles.sh` y no se usan fuera de la máquina local.
4. **Mínimo privilegio:** credenciales distintas por ambiente y por rol (`quatreros_owner` solo en el paso de migraciones; `quatreros_app` en la aplicación; `quatreros_readonly` para respaldos). Claves de R2 limitadas a su bucket.
5. **Clave de respaldos:** la clave privada `age` se guarda **fuera** del proveedor de hosting (gestor de contraseñas del responsable + copia física segura). Sin ella los respaldos no se pueden leer.
6. **Rotación:** al salir una persona con acceso, ante sospecha de filtración, y al menos una vez al año: `BETTER_AUTH_SECRET` (cierra todas las sesiones), contraseñas de BD, claves de R2, IA y Telegram.
7. **Filtración:** revocar la credencial, rotarla, revisar auditoría y logs del período, y registrar el incidente.
8. **Logs:** pino redacta cabeceras de autenticación, cookies, contraseñas, tokens y claves (RNF-092).
