import { randomUUID } from 'node:crypto';
import type { AssistantProvider, ProviderEvent } from '../../src/addons/assistant/application/ports.js';

type Mode = 'read' | 'write' | 'blocked';

/**
 * Proveedor simulado para pruebas y E2E. No se usa en runtime real.
 * Emite una llamada de herramienta y espera el resultado del backend, como Managed Agents.
 */
export class FakeAssistantProvider implements AssistantProvider {
  readonly configured = true;
  private mode: Mode = 'read';
  private readonly pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();

  setMode(mode: Mode): void {
    this.mode = mode;
  }

  createSession(): Promise<{ sessionId: string }> {
    return Promise.resolve({ sessionId: `sesn_fake_${randomUUID()}` });
  }

  sendUserMessage(): Promise<void> {
    // El mensaje se usa para disparar el guion; no requiere estado adicional.
    return Promise.resolve();
  }

  async *stream(): AsyncIterable<ProviderEvent> {
    const toolId = `sevt_fake_${randomUUID()}`;
    const toolResult = new Promise((resolve, reject) => {
      this.pending.set(toolId, { resolve, reject });
    });
    if (this.mode === 'blocked') {
      yield {
        type: 'agent.custom_tool_use',
        id: toolId,
        name: 'prepare_payment',
        input: { amount: '1000.00' },
      };
    } else if (this.mode === 'write') {
      yield {
        type: 'agent.custom_tool_use',
        id: toolId,
        name: 'prepare_raw_material',
        input: { name: 'Tocino ahumado', unit: 'kg', tracksExpiry: true },
      };
    } else {
      yield {
        type: 'agent.custom_tool_use',
        id: toolId,
        name: 'inventory_get_availability',
        input: { q: 'chorizo' },
      };
    }

    await toolResult;

    yield {
      type: 'agent.message',
      content: [{ type: 'text', text: 'Listo.' }],
    };
    yield {
      type: 'session.usage',
      usage: {
        input_tokens: 120,
        output_tokens: 30,
        list_cost: 5,
        active_seconds: '0.400',
      },
    };
    yield { type: 'session.status_idle', stop_reason: { type: 'end_turn' } };
  }

  sendToolResult(_sessionId: string, toolUseId: string, _content: unknown, isError?: boolean): Promise<void> {
    const pending = this.pending.get(toolUseId);
    if (!pending) return Promise.resolve();
    this.pending.delete(toolUseId);
    if (isError) pending.resolve({ error: true });
    else pending.resolve(true);
    return Promise.resolve();
  }

  listEvents(): Promise<ProviderEvent[]> {
    return Promise.resolve([]);
  }

  archiveSession(): Promise<void> {
    return Promise.resolve();
  }
}
