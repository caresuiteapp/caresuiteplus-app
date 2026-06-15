import { createAiExtension } from '@/lib/shared/aiExtension';
export function getBusinessAiExtension() { return createAiExtension(137, 'business', ['summarize', 'assist']); }
