import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('Assist signature projection consistency R9', () => {
  const snapshotSource = read(
    'src/lib/assist/resolveAssignmentExecutionSnapshot.ts',
  );
  const signatureWorkflowSource = read(
    'src/features/assistWorkflow/saveClientSignature.ts',
  );

  it('uses valid persisted signatures as canonical evidence in batch list reads', () => {
    expect(snapshotSource).toContain("fromUnknownTable(supabase, 'assist_visit_signatures')");
    expect(snapshotSource).toContain(".eq('is_valid', true)");
    expect(snapshotSource).toContain('validSignatureVisitIds.has(input.visitId)');
  });

  it('updates signature_complete before deferred proof generation', () => {
    const synchronousProjection = signatureWorkflowSource.indexOf(
      'const signatureState = await upsertAssistVisitExecutionState',
    );
    const deferredProof = signatureWorkflowSource.indexOf(
      'scheduleDeferredTask(assistProofProjectionKey(updatedCtx)',
    );

    expect(synchronousProjection).toBeGreaterThan(-1);
    expect(deferredProof).toBeGreaterThan(synchronousProjection);
    expect(signatureWorkflowSource).toContain('signatureComplete: true');
  });
});
