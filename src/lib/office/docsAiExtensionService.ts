import { createAiExtension } from '@/lib/shared/aiExtension';
export function getOfficeAiExtension() { return createAiExtension(217, 'office', ['summarize', 'assist']); }
