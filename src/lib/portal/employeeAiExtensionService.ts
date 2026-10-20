import { createAiExtension } from '@/lib/shared/aiExtension';
export function getPortalAiExtension() { return createAiExtension(337, 'portal', ['summarize', 'assist']); }
