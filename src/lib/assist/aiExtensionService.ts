import { createAiExtension } from '@/lib/shared/aiExtension';
export function getAssistAiExtension() { return createAiExtension(257, 'assist', ['summarize', 'assist']); }
