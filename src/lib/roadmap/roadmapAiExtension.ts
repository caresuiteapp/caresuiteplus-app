import { createAiExtension } from '@/lib/shared/aiExtension';

/** WP597 — AI/OCR/API (roadmap) */
export function getRoadmapAiExtension() {
  return createAiExtension(597, 'roadmap', ['summarize', 'assist']);
}
