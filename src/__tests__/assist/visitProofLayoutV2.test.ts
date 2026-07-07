import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import {
  buildVisitProofTasksPresentation,
  filterFachlicheProofTasks,
  isInternalWorkflowProofTask,
  isVisitProofTaskCompleted,
  isVisitProofTaskDeviation,
  normalizeVisitProofTaskStatus,
  resolveVisitProofDocumentationText,
  resolveVisitProofTaskStatusLabel,
} from '@/lib/assist/visitProofTaskPresentation';
import { resolveVisitProofBranding, resolveVisitProofEmployeeName } from '@/lib/assist/visitProofBranding';
import { buildAssistProofPdfPayload } from '@/lib/assist/assistProofPdfPayload';

function sampleProof(overrides: Partial<AssistVisitProofRow> = {}): AssistVisitProofRow {
  return {
    id: 'proof-abc-12345678',
    tenantId: 'tenant-1',
    visitId: 'visit-1',
    signatureId: 'sig-1',
    proofNumber: 'LN-TEST',
    status: 'approved',
    storagePath: null,
    payloadSnapshot: {
      clientName: 'Erika Mustermann',
      employeeName: 'Anna Pflege',
      serviceName: 'Hauswirtschaft',
      location: 'Musterweg 1',
      plannedStartAt: '2026-06-15T08:00:00.000Z',
      plannedEndAt: '2026-06-15T09:00:00.000Z',
      visitTimes: {
        driveSeconds: 600,
        serviceSeconds: 2700,
        serviceStartedAt: '2026-06-15T08:15:00.000Z',
        serviceEndedAt: '2026-06-15T09:00:00.000Z',
      },
      signature: {
        signerName: 'Erika Mustermann',
        signedAt: '2026-06-15T09:05:00.000Z',
        signerRole: 'client',
      },
    },
    payloadHash: null,
    generatedAt: '2026-06-15T09:10:00.000Z',
    generatedBy: null,
    approvedAt: null,
    approvedBy: null,
    billingReleased: false,
    portalVisible: true,
    releasedToPortalAt: null,
    portalReleaseStatus: 'none',
    approvalNote: null,
    rejectionReason: null,
    pdfStoragePath: 'tenant/t1/old.pdf',
    pdfHash: 'old-hash',
    createdAt: '2026-06-15T09:10:00.000Z',
    updatedAt: '2026-06-15T09:10:00.000Z',
    ...overrides,
  };
}

describe('visitProofTaskPresentation', () => {
  it('normalizes completed statuses', () => {
    expect(isVisitProofTaskCompleted('done')).toBe(true);
    expect(isVisitProofTaskCompleted('erledigt')).toBe(true);
    expect(isVisitProofTaskCompleted('not_requested')).toBe(false);
  });

  it('detects deviation statuses in German and English', () => {
    expect(isVisitProofTaskDeviation('not_requested')).toBe(true);
    expect(isVisitProofTaskDeviation('partial')).toBe(true);
    expect(isVisitProofTaskDeviation('done')).toBe(false);
  });

  it('maps not_requested to Nicht gewünscht', () => {
    expect(resolveVisitProofTaskStatusLabel('not_requested')).toBe('Nicht gewünscht');
  });

  it('filters internal workflow tasks by title', () => {
    expect(isInternalWorkflowProofTask({ title: 'Einsatz antreten' })).toBe(true);
    expect(isInternalWorkflowProofTask({ title: 'Küche aufräumen' })).toBe(false);
  });

  it('shows compact message when all fachliche tasks completed', () => {
    const presentation = buildVisitProofTasksPresentation([
      { title: 'Küche aufräumen', status: 'done' },
      { title: 'Staubsaugen', status: 'done' },
      { title: 'Einsatz antreten', status: 'done' },
    ]);
    expect(presentation.allCompleted).toBe(true);
    expect(presentation.deviations).toHaveLength(0);
    expect(filterFachlicheProofTasks([
      { title: 'Einsatz antreten', status: 'done' },
      { title: 'Küche aufräumen', status: 'done' },
    ])).toHaveLength(1);
  });

  it('lists only deviating tasks with reason fallback', () => {
    const presentation = buildVisitProofTasksPresentation([
      { title: 'Küche aufräumen', status: 'done' },
      { title: 'Boden wischen', status: 'not_requested' },
    ]);
    expect(presentation.hasDeviations).toBe(true);
    expect(presentation.deviations).toHaveLength(1);
    expect(presentation.deviations[0]?.statusLabel).toBe('Nicht gewünscht');
    expect(presentation.deviations[0]?.reason).toBe('Keine Begründung dokumentiert.');
  });

  it('shows partial task with note', () => {
    const presentation = buildVisitProofTasksPresentation([
      {
        title: 'Wäsche sortieren',
        status: 'partial',
        completionNote: 'Nur teilweise möglich wegen Zeit.',
      },
    ]);
    expect(presentation.deviations[0]?.statusLabel).toBe('Teilweise erledigt');
    expect(presentation.deviations[0]?.reason).toContain('teilweise');
  });

  it('filters submitted from documentation', () => {
    expect(resolveVisitProofDocumentationText({ documentation: 'submitted' })).toBe(
      'Keine zusätzliche Dokumentation erfasst.',
    );
    expect(
      resolveVisitProofDocumentationText({ documentationNote: 'Klient:in war wach und aktiv.' }),
    ).toBe('Klient:in war wach und aktiv.');
  });

  it('warns on unknown status token', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveVisitProofTaskStatusLabel('xyz_unknown_status')).toBe('Unklar dokumentiert');
    expect(normalizeVisitProofTaskStatus(' Teilweise erledigt ')).toBe('teilweise_erledigt');
    warn.mockRestore();
  });
});

describe('buildAssistProofPdfPayload layout v2', () => {
  it('renders all-completed compact tasks section without task table rows', () => {
    const payload = buildAssistProofPdfPayload(sampleProof(), {
      tasks: [
        { id: '1', title: 'Küche aufräumen', status: 'done', statusLabel: 'Erledigt' },
        { id: '2', title: 'Staubsaugen', status: 'done', statusLabel: 'Erledigt' },
      ],
      tenantLogoUrl: 'https://example.com/logo.png',
      tenantName: 'Pflege Plus GmbH',
    });

    expect(payload.layoutVersion).toBe('v2');
    expect(payload.html).toContain('data-layout-version="v2"');
    expect(payload.html).toContain('Alle geplanten Aufgaben wurden vollständig erledigt.');
    expect(payload.html).not.toContain('Küche aufräumen');
    expect(payload.html).not.toContain('Einsatz antreten');
    expect(payload.html).toContain('https://example.com/logo.png');
    expect(payload.html).not.toContain('submitted');
  });

  it('renders deviation section only for non-completed tasks', () => {
    const payload = buildAssistProofPdfPayload(sampleProof(), {
      tasks: [
        { id: '1', title: 'Küche aufräumen', status: 'done', statusLabel: 'Erledigt' },
        {
          id: '2',
          title: 'Boden wischen',
          status: 'not_requested',
          statusLabel: 'Nicht gewünscht',
          notDoneReason: 'Klient:in wünschte Wäsche sortieren.',
        },
      ],
    });

    expect(payload.html).toContain('Abweichungen bei Aufgaben');
    expect(payload.html).toContain('Boden wischen');
    expect(payload.html).toContain('Nicht gewünscht');
    expect(payload.html).toContain('Wäsche sortieren');
    expect(payload.html).not.toContain('Küche aufräumen');
  });

  it('renders footer credit with Software Technologie', () => {
    const payload = buildAssistProofPdfPayload(sampleProof(), {
      tenantName: 'Pflege Plus GmbH',
    });
    expect(payload.html).toContain('Erstellt mit CareSuite+ Software Technologie');
    expect(payload.html).not.toContain('Seite 1 von 1 · Erstellt mit CareSuite+</div>');
  });

  it('renders employee name in Stammdaten and not em dash placeholder', () => {
    const payload = buildAssistProofPdfPayload(sampleProof(), {
      employeeName: 'Max Mustermann',
    });
    expect(payload.html).toContain('Mitarbeitende:r</span><span>Max Mustermann</span>');
    expect(payload.html).not.toMatch(/Mitarbeitende:r<\/span><span>—<\/span>/);
  });

  it('uses Nicht dokumentiert when employee name is truly unknown', () => {
    const payload = buildAssistProofPdfPayload(
      sampleProof({
        payloadSnapshot: {
          ...sampleProof().payloadSnapshot,
          employeeName: undefined,
        },
      }),
    );
    expect(payload.html).toContain('Mitarbeitende:r</span><span>Nicht dokumentiert</span>');
  });

  it('shows logo img and hides tenant name header when logo present', () => {
    const payload = buildAssistProofPdfPayload(sampleProof(), {
      tenantLogoUrl: 'https://example.com/logo.png',
      tenantName: 'Pflege Plus GmbH',
      tenantLegalName: 'Pflege Plus GmbH',
    });
    expect(payload.html).toContain('<img class="proof-logo"');
    expect(payload.html).toContain('https://example.com/logo.png');
    expect(payload.html).not.toContain('proof-logo-fallback">Pflege Plus GmbH');
  });

  it('uses tenant name fallback when logo missing', () => {
    const payload = buildAssistProofPdfPayload(sampleProof(), {
      tenantName: 'Helferhasen+ UG',
      tenantLegalName: 'Helferhasen+ UG',
    });
    expect(payload.html).toContain('proof-logo-fallback');
    expect(payload.html).toContain('Helferhasen+ UG');
    expect(payload.html).not.toContain('<img class="proof-logo"');
  });

  it('preserves signature block and does not expose GPS', () => {
    const payload = buildAssistProofPdfPayload(
      sampleProof({
        payloadSnapshot: {
          ...sampleProof().payloadSnapshot,
          latitude: 51.1,
          documentation: 'submitted',
        },
      }),
      { signatureImageUrl: 'data:image/png;base64,abc' },
    );
    expect(payload.html).toContain('data:image/png;base64,abc');
    expect(payload.html).toContain('Erika Mustermann');
    expect(payload.html).toContain('Keine zusätzliche Dokumentation erfasst.');
    expect(payload.html).not.toContain('51.1');
    expect(payload.html).not.toContain('submitted');
  });

  it('renders existing proof from snapshot without mutating source', () => {
    const proof = sampleProof({
      payloadSnapshot: {
        clientName: 'Bestands-Klient',
        tasks: [{ title: 'Bad sichtreinigen', status: 'done' }],
        documentationNote: 'Alles ok.',
      },
    });
    const before = JSON.stringify(proof.payloadSnapshot);
    buildAssistProofPdfPayload(proof);
    expect(JSON.stringify(proof.payloadSnapshot)).toBe(before);
  });
});

describe('resolveVisitProofBranding', () => {
  it('prefers tenant logo_url chain from snapshot', () => {
    const branding = resolveVisitProofBranding(
      { logo_url: 'https://cdn/logo.png', tenantName: 'Demo' },
      {},
    );
    expect(branding.logoUrl).toBe('https://cdn/logo.png');
    expect(branding.tenantName).toBe('Demo');
  });

  it('reads nested tenant_branding.logo_url', () => {
    const branding = resolveVisitProofBranding(
      { tenant_branding: { logo_url: 'https://cdn/nested.png' }, tenantName: 'Demo' },
      {},
    );
    expect(branding.logoUrl).toBe('https://cdn/nested.png');
  });
});

describe('resolveVisitProofEmployeeName', () => {
  it('prefers enrichment then snapshot then nested employee object', () => {
    expect(resolveVisitProofEmployeeName({ employeeName: 'Snapshot Name' }, { employeeName: 'Enriched' })).toBe(
      'Enriched',
    );
    expect(
      resolveVisitProofEmployeeName({
        employee: { first_name: 'Max', last_name: 'Mustermann' },
      }),
    ).toBe('Max Mustermann');
    expect(resolveVisitProofEmployeeName({})).toBe('Nicht dokumentiert');
  });
});

describe('audit artifacts', () => {
  it('writes sample HTML proofs for visual acceptance', () => {
    const outDir = path.join(process.cwd(), 'docs/audit/leistungsnachweis-v2');
    mkdirSync(outDir, { recursive: true });

    const allDone = buildAssistProofPdfPayload(sampleProof(), {
      tasks: [
        { id: '1', title: 'Küche aufräumen', status: 'done', statusLabel: 'Erledigt' },
        { id: '2', title: 'Staubsaugen', status: 'done', statusLabel: 'Erledigt' },
        { id: 'w1', title: 'Einsatz antreten', status: 'done', statusLabel: 'Erledigt' },
      ],
      tenantLogoUrl: 'https://placehold.co/160x56/png?text=Mandant',
      tenantName: 'Pflege Plus GmbH',
      tenantLegalName: 'Pflege Plus GmbH',
      tenantAddressLine: 'Hauptstraße 1, 44623 Herne',
      tenantIkNumber: '123456789',
    });

    const deviation = buildAssistProofPdfPayload(sampleProof(), {
      tasks: [
        { id: '1', title: 'Küche aufräumen', status: 'done', statusLabel: 'Erledigt' },
        {
          id: '2',
          title: 'Boden wischen',
          status: 'not_requested',
          statusLabel: 'Nicht gewünscht',
          notDoneReason: 'Klient:in wünschte stattdessen Unterstützung beim Wäsche sortieren.',
        },
      ],
      tenantLogoUrl: 'https://placehold.co/160x56/png?text=Mandant',
      tenantName: 'Pflege Plus GmbH',
      documentationNote: 'Einsatz ruhig verlaufen.',
    });

    writeFileSync(path.join(outDir, 'beispiel-alle-aufgaben-erledigt.html'), allDone.html, 'utf8');
    writeFileSync(path.join(outDir, 'beispiel-abweichung.html'), deviation.html, 'utf8');
  });
});
