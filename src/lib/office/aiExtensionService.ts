import { createAiExtension } from '@/lib/shared/aiExtension';
export function getOfficeAiExtension() { return createAiExtension(157, 'office', ['summarize', 'assist']); }
