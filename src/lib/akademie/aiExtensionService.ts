import { createAiExtension } from '@/lib/shared/aiExtension';
export function getAkademieAiExtension() { return createAiExtension(437, 'akademie', ['summarize', 'assist']); }
