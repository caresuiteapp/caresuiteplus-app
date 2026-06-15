import { createAiExtension } from '@/lib/shared/aiExtension';
export function getBeratungAiExtension() { return createAiExtension(417, 'beratung', ['summarize', 'assist']); }
