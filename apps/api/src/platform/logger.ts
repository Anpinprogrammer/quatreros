import { pino, type Logger } from 'pino';

/**
 * Logger estructurado JSON (ADR-019). Redacta credenciales y datos sensibles (RNF-092).
 */
export function createLogger(level: string): Logger {
  return pino({
    level,
    base: { service: 'quatreros-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.newPassword',
        '*.token',
        '*.secret',
        '*.apiKey',
      ],
      censor: '[REDACTADO]',
    },
  });
}

export type { Logger };
