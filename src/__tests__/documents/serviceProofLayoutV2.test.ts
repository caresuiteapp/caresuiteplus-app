import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import type { ServiceProofRecord } from '@/types/documents/serviceProof';
import {
  buildServiceProofDocumentHtml,
  mapServiceProofTasks,
} from '@/lib/documents/serviceProofLayoutAdapter';
import {
  createServiceProofDraft,
  patchServiceProofForTest,
  renderServiceProofDocumentHtml,
  resetServiceProofDocumentStore,
} from '@/lib/documents/serviceProofDocumentService';

const TENANT = DEMO_TENANT_ID;

function baseProof(overrides: Partial<ServiceProofRecord> = {}): ServiceProofRecord {
  const draft = createServiceProofDraft({ tenantId: TENANT, proofType: 'einzel_einsatznachweis' });
  return patchServiceProofForTest({
    ...draft,
    proofNumber: 'LN-DM-001',
    previewConfirmed: true,
    clientName: 'Erika Mustermann',
    employeeName: 'Anna Pflege',
    serviceType: 'Hauswirtschaft',
    deploymentDate: '2026-06-15',
    startTime: '09:00',
    endTime: '10:30',
    durationMinutes: 90,
    documentation: 'submitted',
    signatures: {
      clientSigned: true,
      employeeSigned: false,
      clientSignedAt: '2026-06-15T10:35:00.000Z',
      employeeSignedAt: null,
    },
    ...overrides,
  });
}

describe('serviceProofDocumentService layout v2', () => {
  beforeEach(() => {
    resetServiceProofDocumentStore();
  });

  afterEach(() => {
    resetServiceProofDocumentStore();
  });

  it('all tasks completed — compact box, no task table, no workflow steps', () => {
    const html = buildServiceProofDocumentHtml(
      baseProof({
        taskItems: [
          { title: 'Küche aufräumen', status: 'done' },
          { title: 'Staubsaugen', status: 'done' },
          { title: 'Einsatz antreten', status: 'done' },
        ],
        logoUrl: 'https://example.com/logo.png',
        companyName: 'Pflege Plus GmbH',
      }),
    );

    expect(html).toContain('data-layout-version="v2"');
    expect(html).toContain('Alle geplanten Aufgaben wurden vollständig erledigt.');
    expect(html).not.toContain('Küche aufräumen');
    expect(html).not.toContain('Einsatz antreten');
    expect(html).toContain('https://example.com/logo.png');
  });

  it('deviation with reason — only deviating task listed', () => {
    const html = buildServiceProofDocumentHtml(
      baseProof({
        taskItems: [
          { title: 'Küche aufräumen', status: 'done' },
          {
            title: 'Boden wischen',
            status: 'not_requested',
            notDoneReason: 'Klient:in wünschte stattdessen Unterstützung beim Wäsche sortieren.',
          },
        ],
      }),
    );

    expect(html).toContain('Abweichungen bei Aufgaben');
    expect(html).toContain('Boden wischen');
    expect(html).toContain('Nicht gewünscht');
    expect(html).toContain('Wäsche sortieren');
    expect(html).not.toContain('Küche aufräumen');
  });

  it('not requested without reason — fallback text', () => {
    const html = buildServiceProofDocumentHtml(
      baseProof({
        taskItems: [{ title: 'Boden wischen', status: 'not_requested' }],
      }),
    );

    expect(html).toContain('Nicht gewünscht');
    expect(html).toContain('Keine Begründung dokumentiert.');
  });

  it('filters submitted documentation', () => {
    const html = buildServiceProofDocumentHtml(baseProof({ documentation: 'submitted' }));
    expect(html).not.toContain('submitted');
    expect(html).toContain('Keine zusätzliche Dokumentation erfasst.');
  });

  it('renders footer credit with Software Technologie', () => {
    const html = buildServiceProofDocumentHtml(baseProof());
    expect(html).toContain('Erstellt mit CareSuite+ Software Technologie');
    expect(html).not.toContain('Seite 1 von 1 · Erstellt mit CareSuite+</div>');
  });

  it('renders employee name and avoids em dash placeholder', () => {
    const html = buildServiceProofDocumentHtml(baseProof({ employeeName: 'Anna Pflege' }));
    expect(html).toContain('Mitarbeitende:r</span><span>Anna Pflege</span>');
    expect(html).not.toMatch(/Mitarbeitende:r<\/span><span>—<\/span>/);
  });

  it('uses Nicht dokumentiert when employee name missing', () => {
    const html = buildServiceProofDocumentHtml(baseProof({ employeeName: '' }));
    expect(html).toContain('Mitarbeitende:r</span><span>Nicht dokumentiert</span>');
  });

  it('shows logo img when logoUrl present', () => {
    const html = buildServiceProofDocumentHtml(
      baseProof({
        logoUrl: 'https://example.com/logo.png',
        companyName: 'Pflege Plus GmbH',
      }),
    );
    expect(html).toContain('<img class="proof-logo"');
    expect(html).toContain('https://example.com/logo.png');
  });

  it('renders tenant name fallback when logo missing', () => {
    const html = buildServiceProofDocumentHtml(
      baseProof({ logoUrl: null, companyName: 'Helferhasen+ UG' }),
    );
    expect(html).toContain('proof-logo-fallback');
    expect(html).toContain('Helferhasen+ UG');
    expect(html).not.toContain('<img class="proof-logo"');
  });

  it('renders signature image and metadata', () => {
    const html = buildServiceProofDocumentHtml(
      baseProof({
        clientSignatureImageUrl: 'data:image/png;base64,abc',
      }),
    );
    expect(html).toContain('data:image/png;base64,abc');
    expect(html).toContain('Erika Mustermann');
  });

  it('renderServiceProofDocumentHtml reads from store without mutation', () => {
    const proof = baseProof({
      taskItems: [{ title: 'Bad sichtreinigen', status: 'done' }],
    });
    const before = JSON.stringify(proof);
    const result = renderServiceProofDocumentHtml(TENANT, proof.id);
    expect(JSON.stringify(proof)).toBe(before);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.layoutVersion).toBe('v2');
      expect(result.data.html).toContain('Alle geplanten Aufgaben wurden vollständig erledigt.');
    }
  });

  it('mapServiceProofTasks prefers structured taskItems', () => {
    const tasks = mapServiceProofTasks(
      baseProof({
        tasks: 'Legacy-Text',
        taskItems: [{ title: 'Wäsche sortieren', status: 'partial', completionNote: 'Teilweise erledigt.' }],
      }),
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('Wäsche sortieren');
  });

  it('writes dokumentenmodul audit HTML artifacts', () => {
    const outDir = path.join(process.cwd(), 'docs/audit/leistungsnachweis-v2');
    mkdirSync(outDir, { recursive: true });

    const allDone = buildServiceProofDocumentHtml(
      baseProof({
        taskItems: [
          { title: 'Küche aufräumen', status: 'done' },
          { title: 'Staubsaugen', status: 'done' },
        ],
        logoUrl: 'https://placehold.co/160x56/png?text=Mandant',
        companyName: 'Pflege Plus GmbH',
        documentation: 'Einsatz ohne Besonderheiten.',
        clientSignatureImageUrl: 'data:image/png;base64,abc',
      }),
    );

    const deviation = buildServiceProofDocumentHtml(
      baseProof({
        taskItems: [
          { title: 'Küche aufräumen', status: 'done' },
          {
            title: 'Boden wischen',
            status: 'not_requested',
            notDoneReason: 'Klient:in wünschte Wäsche sortieren.',
          },
        ],
        logoUrl: 'https://placehold.co/160x56/png?text=Mandant',
        documentation: 'Abweichung dokumentiert.',
      }),
    );

    writeFileSync(path.join(outDir, 'dokumentenmodul-alle-aufgaben-erledigt.html'), allDone, 'utf8');
    writeFileSync(path.join(outDir, 'dokumentenmodul-abweichung.html'), deviation, 'utf8');
  });
});
