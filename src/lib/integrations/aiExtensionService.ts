import { createAiExtension } from '@/lib/shared/aiExtension';

/** WP497 — AI/OCR/API (Integrationen) */
export function getIntegrationsAiExtension() {
  return createAiExtension(497, 'integrations', ['classify', 'assist']);
}
