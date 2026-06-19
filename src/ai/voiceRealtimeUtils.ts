import type { AiRealtimeTokenResponse } from './aiToolTypes';

const REALTIME_MODEL = 'gpt-realtime';
const REALTIME_CALLS_URL = `https://api.openai.com/v1/realtime/calls?model=${REALTIME_MODEL}`;

export function extractRealtimeClientSecret(
  payload: AiRealtimeTokenResponse,
): string | null {
  const nested = payload.realtime;
  if (!nested || typeof nested !== 'object') {
    return null;
  }

  const record = nested as Record<string, unknown>;
  const directValue = record.value;
  if (typeof directValue === 'string' && directValue.trim()) {
    return directValue.trim();
  }

  const clientSecret = record.client_secret;
  if (clientSecret && typeof clientSecret === 'object') {
    const secretValue = (clientSecret as { value?: unknown }).value;
    if (typeof secretValue === 'string' && secretValue.trim()) {
      return secretValue.trim();
    }
  }

  return null;
}

export function getRealtimeCallsUrl(): string {
  return REALTIME_CALLS_URL;
}

export function parseVoiceErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: { message?: string };
        message?: string;
      };
      const nested = parsed.error?.message ?? parsed.message;
      if (typeof nested === 'string' && nested.trim()) {
        return nested.trim();
      }
    } catch {
      // keep raw string
    }
  }

  return trimmed;
}
