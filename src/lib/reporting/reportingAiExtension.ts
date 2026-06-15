import { createAiExtension } from '@/lib/shared/aiExtension';

/** WP517 — AI/OCR/API Reporting */
export function getReportingAiExtension() {
  return createAiExtension(517, 'reporting', ['summarize', 'classify']);
}
