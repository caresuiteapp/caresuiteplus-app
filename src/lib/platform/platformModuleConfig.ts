/**
 * Platform hub (OCR/KI) live readiness.
 * Azure OCR and OpenAI pipelines remain demo-only until provider wiring is complete.
 */
export function isPlatformLiveReady(): boolean {
  return false;
}

export const PLATFORM_PREPARED_MESSAGE =
  'OCR- und KI-Pipelines sind vorbereitet — Jobs laufen derzeit im Demo-Modus ohne echte Provider-Anbindung.';
