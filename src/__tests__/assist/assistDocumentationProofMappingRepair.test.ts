import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('Assist Dokumentation und Leistungsnachweis bleiben getrennt von Hinweisen', () => {
  const saveDocumentation = read(
    'src/features/assistWorkflow/saveVisitDocumentation.ts',
  );
  const finalizeVisit = read('src/features/assistWorkflow/finalizeVisit.ts');
  const deferredFinalize = read(
    'src/features/assistWorkflow/finalizeVisitWithDeferredClientSignature.ts',
  );
  const saveSignature = read(
    'src/features/assistWorkflow/saveClientSignature.ts',
  );
  const proofPdf = read('src/lib/assist/assistProofPdfService.ts');
  const proofEnrichment = read(
    'src/lib/assist/visitProofSnapshotPreviewService.ts',
  );
  const portalBridge = read(
    'src/lib/portal/employeePortalAssignmentBridge.ts',
  );
  const officeEnrichment = read(
    'src/lib/assist/visitDispositionExecutionEnrichment.ts',
  );
  const migration = read(
    'supabase/migrations/0268_repair_assist_documentation_proof_mapping.sql',
  );

  it('does not store employee documentation as an employee hint', () => {
    expect(saveDocumentation).not.toContain(
      'employee_notes: buildDocumentationText(doc)',
    );
    expect(portalBridge).toContain(
      'documentationNotes: visit.documentationNotes ?? null',
    );
    expect(portalBridge).not.toContain(
      'documentationNotes: visit.employeeNotes',
    );
    expect(officeEnrichment).toContain(
      'detail.employeeNotes?.trim() === documentationText.trim()',
    );
  });

  it('passes the real documentation text into both finalize paths', () => {
    expect(finalizeVisit).toContain('ctx.detail.documentationNotes?.trim()');
    expect(deferredFinalize).toContain(
      'ctx.detail.documentationNotes?.trim()',
    );
    expect(saveSignature).toContain(
      'refreshed.data.detail.documentationNotes?.trim()',
    );
    expect(saveSignature).not.toContain("? 'submitted'");
  });

  it('enriches legacy proof snapshots from canonical visit documentation', () => {
    expect(proofPdf).toContain(
      'needsEmployee || needsSignature || needsDocumentation',
    );
    expect(proofEnrichment).toContain("'assist_visit_documentation'");
    expect(proofEnrichment).toContain('buildStructuredDocumentationText');
    expect(proofEnrichment).toContain('assignment.documentation_notes');
  });

  it('repairs only the incident date and preserves unrelated hints', () => {
    expect(migration).toContain("DATE '2026-07-23'");
    expect(migration).toContain("'{documentationNote}'");
    expect(migration).toContain('pdf_storage_path = NULL');
    expect(migration).toContain(
      'btrim(visit.employee_notes) = btrim(source.documentation_text)',
    );
  });
});
