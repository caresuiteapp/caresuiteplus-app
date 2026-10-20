import { createAiExtension } from '@/lib/shared/aiExtension';

/** WP537 — AI/OCR/API (release) */
export function getReleaseAiExtension() {
  return createAiExtension(537, 'release', ['classify', 'summarize']);
}
