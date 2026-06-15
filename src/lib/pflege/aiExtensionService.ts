import { createAiExtension } from '@/lib/shared/aiExtension';
export function getPflegeAiExtension() { return createAiExtension(377, 'pflege', ['summarize', 'assist']); }
