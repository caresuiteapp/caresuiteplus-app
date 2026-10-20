import { jsonResponse } from './http.ts';

type OpenAiErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
  message?: string;
};

export function aiErrorResponse(message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: toGermanAiError(message) }, status);
}

export function toGermanAiError(raw: string): string {
  const text = raw.trim();
  if (!text) {
    return 'Anfrage fehlgeschlagen. Bitte versuche es erneut.';
  }

  const lower = text.toLowerCase();

  if (lower.includes('openai_api_key not configured')) {
    return 'Sprachassistent ist derzeit nicht eingerichtet (Server-Konfiguration). Text-Chat bleibt verfügbar.';
  }
  if (lower.includes('no tenant access') || lower.includes('tenant access')) {
    return 'Kein Zugriff auf den Mandanten für die KI-Funktionen.';
  }
  if (lower.includes('tenant_id is required') || lower.includes('tenant_id and message')) {
    return 'Mandanten-ID fehlt in der Anfrage.';
  }
  if (lower.includes('missing authorization') || lower.includes('not authenticated')) {
    return 'Bitte melde dich erneut an.';
  }
  if (
    lower.includes('invalid api key') ||
    lower.includes('incorrect api key') ||
    lower.includes('invalid_api_key')
  ) {
    return 'OpenAI API-Schlüssel ist ungültig. Bitte Server-Konfiguration prüfen.';
  }
  if (
    lower.includes('insufficient_quota') ||
    lower.includes('exceeded your current quota') ||
    lower.includes('billing')
  ) {
    return 'OpenAI-Kontingent erschöpft. Bitte Abrechnung prüfen.';
  }
  if (lower.includes('model_not_found') || lower.includes('does not exist')) {
    return 'Das Realtime-Sprachmodell ist für diesen API-Schlüssel nicht verfügbar.';
  }
  if (lower.includes('organization must be verified') || lower.includes('access tier')) {
    return 'OpenAI-Organisation muss für Realtime-Sprache freigeschaltet sein.';
  }
  if (lower.includes('invalid schema') || lower.includes('invalid tools')) {
    return 'Tool-Konfiguration für Sprachassistent ungültig. Bitte Administrator informieren.';
  }
  if (
    lower.includes('openai-safety-identifier') ||
    lower.includes('safety-identifier') ||
    lower.includes('safety identifier')
  ) {
    return 'Sprachverbindung konnte nicht vorbereitet werden. Bitte versuche es erneut.';
  }
  if (lower.includes('row-level security') || lower.includes('violates row-level security')) {
    return 'KI-Sitzung konnte nicht gespeichert werden (Berechtigung).';
  }

  if (text.length > 220) {
    return 'Sprachverbindung fehlgeschlagen. Bitte versuche es erneut oder nutze den Text-Chat.';
  }

  return text;
}

export async function readOpenAiError(response: Response): Promise<string> {
  const body = await response.text();

  try {
    const parsed = JSON.parse(body) as OpenAiErrorPayload;
    const message = parsed.error?.message ?? parsed.message ?? body;
    return toGermanAiError(message);
  } catch {
    return toGermanAiError(body);
  }
}
