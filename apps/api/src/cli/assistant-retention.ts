import { AssistantRetentionService } from '../addons/assistant/application/retention.js';
import { AnthropicAssistantProvider } from '../addons/assistant/infrastructure/anthropic/client.js';
import { loadEnv } from '../config/env.js';
import { createDb } from '../platform/db/client.js';

/**
 * Retención de sesiones de Anthropic (Q-IA-05 / DEC-108).
 * Ejecutar desde cron: pnpm assistant:retention
 */
const env = loadEnv();
const handle = createDb(env.DATABASE_URL, env.DATABASE_SSL);
const provider = new AnthropicAssistantProvider(env);
const service = new AssistantRetentionService(handle.db, provider);

try {
  const result = await service.run();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.errors.length > 0) process.exitCode = 1;
} finally {
  await handle.close();
}
