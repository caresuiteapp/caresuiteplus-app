import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SignatureWriteExpectation } from '@/features/assistWorkflow/workflowWriteExpectation';
import { withWorkflowTimeout } from '@/features/assistWorkflow/internal/withWorkflowTimeout';

const key = (scope: string) => `employee-visit-signature-write-version:${scope}`;
function parse(value: string | null, scope: string): SignatureWriteExpectation | null {
  if (!value) return null;
  const stored = JSON.parse(value) as { scope?: string; signature?: SignatureWriteExpectation };
  const signature = stored.signature;
  if (stored.scope !== scope || !signature || !['payloadHash', 'signatureHash', 'signerName', 'signerRole']
      .every((field) => typeof signature[field as keyof SignatureWriteExpectation] === 'string'
        && signature[field as keyof SignatureWriteExpectation].trim().length > 0)) return null;
  return signature;
}

/** Persist hashes and signer metadata before sending a write; never store image bytes. */
export async function storeVisitSignatureWriteVersion(scope: string, signature: SignatureWriteExpectation): Promise<void> {
  const value = JSON.stringify({ scope, signature });
  try { globalThis.sessionStorage?.setItem(key(scope), value); } catch { /* device storage below remains available */ }
  await withWorkflowTimeout(AsyncStorage.setItem(key(scope), value), 2_000, 'signatureWriteVersionSave');
}

export async function loadVisitSignatureWriteVersion(scope: string): Promise<SignatureWriteExpectation | null> {
  try {
    const memory = parse(globalThis.sessionStorage?.getItem(key(scope)) ?? null, scope);
    if (memory) return memory;
  } catch { /* Native AsyncStorage/read retry below */ }
  return parse(await withWorkflowTimeout(AsyncStorage.getItem(key(scope)), 2_000, 'signatureWriteVersionRead'), scope);
}
