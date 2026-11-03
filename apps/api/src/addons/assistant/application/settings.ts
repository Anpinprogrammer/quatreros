import type { AssistantSettingsValues } from '@quatreros/contracts';
import type { Env } from '../../../config/env.js';

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettingsValues = {
  sessionBudgetCents: 25,
  dailyCapCents: 300,
  weeklyCapCents: 1000,
  monthlyCapCents: 3000,
  alertPct: [80, 100],
  maxToolCallsPerTurn: 6,
  turnTimeoutSeconds: 60,
  messagesPerTenMinutes: 30,
};

export function resolveSettings(
  env: Env,
  raw: Record<string, unknown> | null | undefined,
): AssistantSettingsValues {
  const value = raw ?? {};
  const number = (key: keyof AssistantSettingsValues, fallback: number): number => {
    const candidate = value[key];
    return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallback;
  };
  return {
    sessionBudgetCents: env.ASSISTANT_SESSION_BUDGET_CENTS,
    dailyCapCents: number('dailyCapCents', DEFAULT_ASSISTANT_SETTINGS.dailyCapCents),
    weeklyCapCents: number('weeklyCapCents', DEFAULT_ASSISTANT_SETTINGS.weeklyCapCents),
    monthlyCapCents: number('monthlyCapCents', DEFAULT_ASSISTANT_SETTINGS.monthlyCapCents),
    alertPct: Array.isArray(value.alertPct)
      ? value.alertPct.filter((item): item is number => typeof item === 'number')
      : DEFAULT_ASSISTANT_SETTINGS.alertPct,
    maxToolCallsPerTurn: number('maxToolCallsPerTurn', DEFAULT_ASSISTANT_SETTINGS.maxToolCallsPerTurn),
    turnTimeoutSeconds: number('turnTimeoutSeconds', DEFAULT_ASSISTANT_SETTINGS.turnTimeoutSeconds),
    messagesPerTenMinutes: number('messagesPerTenMinutes', DEFAULT_ASSISTANT_SETTINGS.messagesPerTenMinutes),
  };
}

export function assistantConfigured(env: Env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY && env.ANTHROPIC_AGENT_ID && env.ANTHROPIC_ENVIRONMENT_ID);
}
