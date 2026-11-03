import type { SQL } from 'drizzle-orm';
import type { AssistantStreamEvent } from '@quatreros/contracts';

/** Acceso mínimo a PostgreSQL para el complemento, sin importar la infraestructura del núcleo. */
export interface AssistantDb {
  execute(query: SQL): Promise<{ rows: unknown[] }>;
  transaction<T>(fn: (tx: AssistantDb) => Promise<T>): Promise<T>;
}

export interface ProviderEvent {
  id?: string;
  type: string;
  [key: string]: unknown;
}

/** Cliente del agente; el adaptador real vive en infrastructure/anthropic. */
export interface AssistantProvider {
  readonly configured: boolean;
  createSession(input: {
    ticketId: string;
    userId: string;
    agentVersion?: string | undefined;
  }): Promise<{ sessionId: string }>;
  sendUserMessage(sessionId: string, text: string): Promise<void>;
  stream(sessionId: string): AsyncIterable<ProviderEvent>;
  listEvents(sessionId: string): Promise<ProviderEvent[]>;
  sendToolResult(sessionId: string, toolUseId: string, content: unknown, isError?: boolean): Promise<void>;
  archiveSession(sessionId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

export interface TurnHubEvent {
  id: number;
  event: AssistantStreamEvent;
}
