import { createAiExtension } from '@/lib/shared/aiExtension';
export function getOfficeAiExtension() { return createAiExtension(197, 'office', ['summarize', 'assist']); }
