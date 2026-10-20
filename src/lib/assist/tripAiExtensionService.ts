import { createAiExtension } from '@/lib/shared/aiExtension';
export function getAssistAiExtension() { return createAiExtension(317, 'assist', ['summarize', 'assist']); }
