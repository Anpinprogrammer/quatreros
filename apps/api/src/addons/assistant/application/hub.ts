import type { AssistantStreamEvent } from '@quatreros/contracts';
import type { TurnHubEvent } from './ports.js';

/**
 * Bus en memoria de los eventos de un turno. El texto de la conversación no se persiste;
 * el cliente se reconecta con Last-Event-ID mientras el proceso siga vivo.
 */
export class TurnHub {
  private readonly buffers = new Map<string, TurnHubEvent[]>();
  private readonly listeners = new Map<string, Set<(event: TurnHubEvent) => void>>();
  private sequence = 0;

  publish(ticketId: string, event: AssistantStreamEvent): void {
    const entry = { id: ++this.sequence, event };
    const buffer = this.buffers.get(ticketId) ?? [];
    buffer.push(entry);
    this.buffers.set(ticketId, buffer.slice(-200));
    for (const listener of this.listeners.get(ticketId) ?? []) listener(entry);
  }

  replay(ticketId: string, lastEventId?: number): TurnHubEvent[] {
    const buffer = this.buffers.get(ticketId) ?? [];
    if (!lastEventId) return [...buffer];
    return buffer.filter((entry) => entry.id > lastEventId);
  }

  subscribe(ticketId: string, listener: (event: TurnHubEvent) => void): () => void {
    const set = this.listeners.get(ticketId) ?? new Set();
    set.add(listener);
    this.listeners.set(ticketId, set);
    return () => {
      set.delete(listener);
    };
  }

  clear(ticketId: string): void {
    this.buffers.delete(ticketId);
  }
}
