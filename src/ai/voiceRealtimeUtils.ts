import type { AiRealtimeTokenResponse } from './aiToolTypes';

const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';
const VOICE_ERROR_MAX_LENGTH = 220;

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

export function truncateVoiceErrorMessage(message: string, maxLength = VOICE_ERROR_MAX_LENGTH): string {
  const trimmed = message.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function formatVoiceErrorForPanel(error: unknown, step?: string): string {
  const raw = parseVoiceErrorMessage(
    error instanceof Error ? error.message : String(error ?? ''),
  );

  if (/NotAllowedError|Permission denied|permission/i.test(raw)) {
    return 'Mikrofon-Zugriff verweigert. Bitte Berechtigung in den Browser-Einstellungen erlauben.';
  }
  if (/NotFoundError|Requested device not found/i.test(raw)) {
    return 'Kein Mikrofon gefunden. Bitte schließe ein Mikrofon an oder prüfe die Geräteeinstellungen.';
  }
  if (/invalid jwt|jwt expired|invalid token|401|unauthorized/i.test(raw)) {
    return 'Bitte melde dich erneut an, um die Sprachsteuerung zu nutzen.';
  }
  if (/OPENAI_API_KEY not configured|server-konfiguration|OpenAI API-Schlüssel/i.test(raw)) {
    return 'Sprachassistent ist derzeit nicht eingerichtet (Server-Konfiguration). Text-Chat bleibt verfügbar.';
  }
  if (/No tenant access|Kein Zugriff auf den Mandanten|tenant_id/i.test(raw)) {
    return 'Kein Zugriff auf den Mandanten für den Sprachassistenten.';
  }
  if (/Nicht angemeldet|access_token/i.test(raw)) {
    return 'Bitte melde dich erneut an, um die Sprachsteuerung zu nutzen.';
  }
  if (/Realtime client secret fehlt/i.test(raw)) {
    return 'Sprachverbindung konnte nicht vorbereitet werden (Token ohne client_secret).';
  }
  if (/model_not_found|does not exist|nicht verfügbar/i.test(raw)) {
    return 'Das Realtime-Sprachmodell ist derzeit nicht verfügbar. Text-Chat bleibt nutzbar.';
  }
  if (/invalid schema|invalid tools|Tool-Konfiguration/i.test(raw)) {
    return 'Sprachassistent startet im eingeschränkten Modus. Bitte erneut versuchen oder Text-Chat nutzen.';
  }
  if (/Failed to fetch|NetworkError|network|Netzwerkfehler/i.test(raw)) {
    return 'Netzwerkfehler bei der Sprachverbindung. Bitte Internetverbindung prüfen und erneut versuchen.';
  }

  const withoutGenericWrapper = raw.replace(/^WebRTC:\s*/i, '').trim();
  const specific = truncateVoiceErrorMessage(withoutGenericWrapper || raw);

  if (!specific) {
    return step ? `${step}: Unbekannter Fehler` : 'Sprachverbindung fehlgeschlagen.';
  }

  if (/^WebRTC:/i.test(raw)) {
    return truncateVoiceErrorMessage(raw);
  }
  if (/^Token:/i.test(raw)) {
    return truncateVoiceErrorMessage(raw);
  }

  return step ? `${step}: ${specific}` : specific;
}

export async function waitForIceGatheringComplete(
  pc: RTCPeerConnection,
  timeoutMs = 4000,
): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, timeoutMs);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(timeout);
        resolve();
      }
    });
  });
}

export async function exchangeRealtimeCallOffer(
  clientSecret: string,
  offerSdp: string,
): Promise<string> {
  const response = await fetch(getRealtimeCallsUrl(), {
    method: 'POST',
    body: offerSdp,
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      'Content-Type': 'application/sdp',
    },
  });

  const body = await response.text();

  if (!response.ok) {
    const message = parseVoiceErrorMessage(body);
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `WebRTC: Sprachverbindung abgelehnt — Sitzung abgelaufen oder ungültig.${message ? ` (${message})` : ''}`,
      );
    }
    throw new Error(`WebRTC: ${message || `OpenAI Realtime Fehler (${response.status})`}`);
  }

  if (body.trim().startsWith('{')) {
    const message = parseVoiceErrorMessage(body);
    throw new Error(`WebRTC: ${message || 'Ungültige Antwort von OpenAI (JSON statt SDP).'}`);
  }

  return body;
}

export function voiceDebugLog(step: string, detail?: unknown): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  if (detail === undefined) {
    console.log(`[VoiceCore] ${step}`);
    return;
  }

  console.log(`[VoiceCore] ${step}`, detail);
}
