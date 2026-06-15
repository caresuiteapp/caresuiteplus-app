import { createAiExtension } from '@/lib/shared/aiExtension';

/** WP557 — AI/OCR/API (security) */
export function getSecurityAiExtension() {
  return createAiExtension(557, 'security', ['classify', 'ocr']);
}
