import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../../../../config/env.js';
import type { AssistantProvider, ProviderEvent } from '../../application/ports.js';

/**
 * Adaptador real de Anthropic Managed Agents. El SDK solo se importa desde aquí.
 * Las herramientas del agente se declaran en `quatreros-ai/` con `ant apply`; el backend
 * únicamente responde las llamadas `custom` que el agente ya tenga declaradas.
 */
export class AnthropicAssistantProvider implements AssistantProvider {
  private readonly client: Anthropic;
  readonly configured: boolean;

  constructor(private readonly env: Env) {
    this.client = new Anthropic({
      ...(env.ANTHROPIC_API_KEY ? { apiKey: env.ANTHROPIC_API_KEY } : {}),
    });
    this.configured = Boolean(
      env.ANTHROPIC_API_KEY && env.ANTHROPIC_AGENT_ID && env.ANTHROPIC_ENVIRONMENT_ID,
    );
  }

  async createSession(input: {
    ticketId: string;
    userId: string;
    agentVersion?: string | undefined;
  }): Promise<{ sessionId: string }> {
    if (!this.configured || !this.env.ANTHROPIC_AGENT_ID || !this.env.ANTHROPIC_ENVIRONMENT_ID) {
      throw new Error('El asistente no está configurado');
    }
    const session = await this.client.beta.sessions.create({
      agent: {
        type: 'agent',
        id: this.env.ANTHROPIC_AGENT_ID,
        ...(input.agentVersion && Number.isFinite(Number(input.agentVersion))
          ? { version: Number(input.agentVersion) }
          : {}),
      },
      environment_id: this.env.ANTHROPIC_ENVIRONMENT_ID,
      metadata: {
        app: 'quatreros',
        env: this.env.NODE_ENV,
        ticket_id: input.ticketId,
        user_ref: input.userId,
      },
    });
    return { sessionId: session.id };
  }

  async sendUserMessage(sessionId: string, text: string): Promise<void> {
    await this.client.beta.sessions.events.send(sessionId, {
      events: [
        {
          type: 'user.message',
          content: [{ type: 'text', text }],
        },
      ],
    });
  }

  async *stream(sessionId: string): AsyncIterable<ProviderEvent> {
    const stream = await this.client.beta.sessions.events.stream(sessionId);
    for await (const event of stream) {
      yield event as unknown as ProviderEvent;
    }
  }

  async listEvents(sessionId: string): Promise<ProviderEvent[]> {
    const events = await this.client.beta.sessions.events.list(sessionId);
    return events.data as unknown as ProviderEvent[];
  }

  async sendToolResult(
    sessionId: string,
    toolUseId: string,
    content: unknown,
    isError = false,
  ): Promise<void> {
    await this.client.beta.sessions.events.send(sessionId, {
      events: [
        {
          type: 'user.custom_tool_result',
          custom_tool_use_id: toolUseId,
          content: [{ type: 'text', text: JSON.stringify(content) }],
          ...(isError ? { is_error: true } : {}),
        } as never,
      ],
    });
  }

  async archiveSession(sessionId: string): Promise<void> {
    await this.client.beta.sessions.archive(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.beta.sessions.delete(sessionId);
  }
}
