import { saveClientPortalAssistProofSignature as save } from './clientPortalAssistProofSignatureServiceCore';
export type { ClientPortalAssistProofSignResult } from './clientPortalAssistProofSignatureServiceCore';

export function saveClientPortalAssistProofSignature(input: Parameters<typeof save>[0]) {
  return save(input, true);
}

export function retryClientPortalAssistProofDelivery(input: { tenantId: string; clientId: string; proofId: string }) {
  return saveClientPortalAssistProofSignature({ ...input, signerName: '', signatureDataUrl: '' });
}
