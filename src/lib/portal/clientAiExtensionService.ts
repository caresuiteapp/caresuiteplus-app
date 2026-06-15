import { createAiExtension } from '@/lib/shared/aiExtension';
export function getPortalAiExtension() { return createAiExtension(357, 'portal', ['summarize', 'assist']); }
