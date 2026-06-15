import { createAiExtension } from '@/lib/shared/aiExtension';

/** WP477 — AI/OCR/API (Plattform) */
export function getPlatformAiExtension() {
  return createAiExtension(477, 'platform', ['ocr', 'summarize', 'classify', 'assist']);
}
