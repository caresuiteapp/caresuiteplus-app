import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function sampleProof(overrides: Partial<AssistVisitProofRow> = {}): AssistVisitProofRow {
  return {
    id: 'proof-enrich-1',
    tenantId: 'tenant-1',
    visitId: 'visit-1',
    signatureId: null,
    proofNumber: 'LN-ENRICH',
    status: 'approved',
    storagePath: null,
    payloadSnapshot: {
      clientName: 'Erika Mustermann',
      serviceName: 'Hauswirtschaft',
      location: 'Musterweg 1',
      plannedStartAt: '2026-06-15T08:00:00.000Z',
      plannedEndAt: '2026-06-15T09:00:00.000Z',
    },
    payloadHash: null,
    generatedAt: '2026-06-15T09:10:00.000Z',
    generatedBy: null,
    approvedAt: null,
    approvedBy: null,
    billingReleased: false,
    portalVisible: true,
    releasedToPortalAt: null,
    portalReleaseStatus: 'released',
    approvalNote: null,
    rejectionReason: null,
    pdfStoragePath: 'tenant/t1/proof.pdf',
    pdfHash: null,
    createdAt: '2026-06-15T09:10:00.000Z',
    updatedAt: '2026-06-15T09:10:00.000Z',
    ...overrides,
  };
}

const mockEnrichVisitProofForPreview = vi.fn();
const mockLoadVisitProofBrandingForTenant = vi.fn();

vi.mock('@/lib/assist/visitProofSnapshotPreviewService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/assist/visitProofSnapshotPreviewService')>();
  return {
    ...actual,
    enrichVisitProofForPreview: (...args: unknown[]) => mockEnrichVisitProofForPreview(...args),
  };
});

vi.mock('@/lib/assist/visitProofBranding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/assist/visitProofBranding')>();
  return {
    ...actual,
    loadVisitProofBrandingForTenant: (...args: unknown[]) => mockLoadVisitProofBrandingForTenant(...args),
  };
});

import { buildAssistProofPdfPayload } from '@/lib/assist/assistProofPdfPayload';
import { buildEnrichedAssistProofPdfPayload } from '@/lib/assist/assistProofPdfService';

describe('buildEnrichedAssistProofPdfPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnrichVisitProofForPreview.mockResolvedValue({
      ok: true,
      data: {
        employeeName: 'Kevin Reinhardt',
        tenantLogoUrl: 'https://cdn.example/logo.png',
        tenantName: 'Pflege Plus GmbH',
        tenantLegalName: 'Pflege Plus GmbH',
      },
    });
    mockLoadVisitProofBrandingForTenant.mockResolvedValue({
      logoUrl: 'https://cdn.example/logo.png',
      tenantName: 'Pflege Plus GmbH',
      legalName: 'Pflege Plus GmbH',
      addressLine: 'Hauptstraße 1, 44623 Herne',
      ikNumber: '123456789',
      taxId: null,
    });
  });

  it('backfills employee from DB when snapshot has no employeeName', async () => {
    const payload = await buildEnrichedAssistProofPdfPayload('tenant-1', sampleProof());

    expect(mockEnrichVisitProofForPreview).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ id: 'proof-enrich-1' }));
    expect(payload.html).toContain('Kevin Reinhardt');
    expect(payload.html).not.toContain('Nicht dokumentiert');
    expect(payload.html).not.toMatch(/Mitarbeitende:r<\/span><span>—<\/span>/);
  });

  it('backfills tenant logo from tenant branding when employee known but logo missing', async () => {
    const payload = await buildEnrichedAssistProofPdfPayload('tenant-1', sampleProof(), {
      employeeName: 'Anna Pflege',
    });

    expect(mockEnrichVisitProofForPreview).not.toHaveBeenCalled();
    expect(mockLoadVisitProofBrandingForTenant).toHaveBeenCalledWith('tenant-1');
    expect(payload.html).toContain('https://cdn.example/logo.png');
    expect(payload.html).toContain('<img class="proof-logo"');
    expect(payload.html).not.toContain('proof-logo-fallback">CareSuite+ Mandant');
  });

  it('uses real tenant name instead of CareSuite+ Mandant when logo missing', async () => {
    mockLoadVisitProofBrandingForTenant.mockResolvedValue({
      logoUrl: null,
      tenantName: 'Helferhasen+ UG',
      legalName: 'Helferhasen+ UG',
      addressLine: null,
      ikNumber: null,
      taxId: null,
    });

    const payload = await buildEnrichedAssistProofPdfPayload('tenant-1', sampleProof(), {
      employeeName: 'Anna Pflege',
    });

    expect(payload.html).toContain('proof-logo-fallback');
    expect(payload.html).toContain('Helferhasen+ UG');
    expect(payload.html).not.toContain('proof-logo-fallback">CareSuite+ Mandant');
  });

  it('keeps footer credit after enrichment', async () => {
    const payload = await buildEnrichedAssistProofPdfPayload('tenant-1', sampleProof());
    expect(payload.html).toContain('Erstellt mit CareSuite+ Software Technologie');
  });
});

describe('buildAssistProofPdfPayload pure snapshot path', () => {
  it('renders from pre-enriched caller data without requiring DB fields in snapshot', () => {
    const payload = buildAssistProofPdfPayload(sampleProof(), {
      employeeName: 'Anna Pflege',
      tenantLogoUrl: 'https://example.com/logo.png',
      tenantName: 'Pflege Plus GmbH',
    });

    expect(payload.html).toContain('Anna Pflege');
    expect(payload.html).toContain('https://example.com/logo.png');
    expect(payload.html).toContain('Erstellt mit CareSuite+ Software Technologie');
    expect(payload.layoutVersion).toBe('v2');
  });
});

describe('runtime wiring enrichment gate', () => {
  it('portal document detail uses buildEnrichedAssistProofPdfPayload', () => {
    const portal = readSrc('src/lib/portal/assist/portalAssistVisitProofService.ts');
    expect(portal).toContain('buildEnrichedAssistProofPdfPayload');
    expect(portal).not.toContain('buildAssistProofPdfPayload(fullProof)');
  });

  it('assist PDF service routes runtime renders through buildEnrichedAssistProofPdfPayload', () => {
    const service = readSrc('src/lib/assist/assistProofPdfService.ts');
    expect(service).toContain('export async function buildEnrichedAssistProofPdfPayload');
    expect(service).toContain('await buildEnrichedAssistProofPdfPayload(proof.tenantId, proof, enrichment)');
    expect(service).toContain('await buildEnrichedAssistProofPdfPayload(tenantId, proof, enrichment)');
  });
});
