import { createAiExtension } from '@/lib/shared/aiExtension';
export function getOfficeAiExtension() { return createAiExtension(237, 'office', ['summarize', 'assist']); }
