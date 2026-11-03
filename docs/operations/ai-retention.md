# Retención de sesiones del asistente (Q-IA-05 / DEC-108)

El asistente no usa Zero Data Retention. Para limitar la permanencia del historial en Anthropic:

| Momento                  | Acción                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| 24 h sin actividad       | Se archiva la sesión en Anthropic y el ticket pasa a `archived`.                                         |
| 30 días desde el archivo | Se elimina la sesión en Anthropic. El ticket queda `terminated` sin `anthropic_session_id`.              |
| Siempre                  | Se conservan en PostgreSQL la petición inicial, el resumen, las herramientas, el resultado y el consumo. |

El ticket y las métricas locales no se borran con este proceso.

## Ejecución

El proceso es idempotente y puede ejecutarse con cron o el programador del hosting:

```bash
# Desarrollo
pnpm --filter @quatreros/api assistant:retention

# Producción, con la imagen compilada
pnpm --filter @quatreros/api assistant:retention:prod
```

Ejemplo de cron diario a las 03:00:

```cron
0 3 * * * cd /ruta/a/quatreros && pnpm --filter @quatreros/api assistant:retention:prod >> /var/log/quatreros/assistant-retention.log 2>&1
```

La salida es un JSON con `archived`, `deleted` y `errors`. Si hay errores, el comando termina con código 1 para que el cron o el hosting avise.

## Requisitos

- `ANTHROPIC_API_KEY` válida para el mismo espacio de trabajo del agente.
- La base de datos del entorno.
- El proceso no necesita que el complemento esté activo: la retención debe correr también cuando el asistente está apagado.
