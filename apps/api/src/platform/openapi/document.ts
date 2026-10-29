import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { HealthResponse, ProblemDetails, ReadyResponse } from '@quatreros/contracts';

/**
 * Documento OpenAPI 3.1 generado desde los contratos Zod (ADR-006).
 * Cada funcionalidad vertical registra aquí sus rutas: permiso requerido, si exige
 * Idempotency-Key, errores de negocio y el RF que implementa (api-design §8).
 */
export function buildOpenApiDocument(version: string) {
  const registry = new OpenAPIRegistry();
  const problem = {
    description: 'Error (Problem Details)',
    content: { 'application/problem+json': { schema: ProblemDetails } },
  };

  registry.registerPath({
    method: 'get',
    path: '/health',
    summary: 'Vida del servicio',
    tags: ['plataforma'],
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: HealthResponse } } },
      500: problem,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/ready',
    summary: 'Disponibilidad de dependencias (base de datos)',
    tags: ['plataforma'],
    responses: {
      200: { description: 'Listo', content: { 'application/json': { schema: ReadyResponse } } },
      503: { description: 'No listo', content: { 'application/json': { schema: ReadyResponse } } },
    },
  });

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Quatreros API',
      version,
      description: 'API del ERP Quatreros. Errores en formato Problem Details.',
    },
    servers: [{ url: '/' }],
  });
}
