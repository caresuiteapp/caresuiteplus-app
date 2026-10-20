import { createAiExtension } from '@/lib/shared/aiExtension';
export function getAssistAiExtension() { return createAiExtension(297, 'assist', ['summarize', 'assist']); }
