import { buildOpenApiDocument } from '../src/platform/openapi/document.js';

process.stdout.write(
  `${JSON.stringify(buildOpenApiDocument(process.env.APP_VERSION ?? '0.1.0'), null, 2)}\n`,
);
