import { createAiExtension } from '@/lib/shared/aiExtension';
export function getOfficeAiExtension() { return createAiExtension(177, 'office', ['summarize', 'assist']); }
