import { createAiExtension } from '@/lib/shared/aiExtension';

/** WP577 — AI/OCR/API (qa) */
export function getQaAiExtension() {
  return createAiExtension(577, 'qa', ['assist', 'classify']);
}
