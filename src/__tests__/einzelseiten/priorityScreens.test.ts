import { describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  createBodyMapMarker,
  fetchBodyMapMarkers,
  patchBodyMapMarker,
  removeBodyMapMarker,
} from '@/lib/pflege/bodyMapService';
import {
  createSisFormAssessment,
  fetchSisFormDetail,
  saveSisFormAssessment,
} from '@/lib/pflege/sisFormService';
import {
  generateLegalDocumentFromTemplate,
  signLegalDocument,
  saveLegalDocumentToRecord,
} from '@/lib/clients/legalDocumentWorkflowService';
import { getDemoClientFullDetail } from '@/data/demo/clients';
import {
  fetchExamList,
  fetchLessonList,
} from '@/lib/akademie/akademieDedicatedService';
import {
  createInformationCollection,
  fetchInformationCollections,
} from '@/lib/pflege/informationCollectionService';
import { SIS_TOPIC_FIELDS } from '@/types/modules/sisForm';

describe('Priority Einzelseiten services', () => {
  it('BodyMap markers can be created, updated and removed', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const clientId = 'client-bodymap-test';

    const created = await createBodyMapMarker(
      DEMO_TENANT_ID,
      {
        clientId,
        gender: 'neutral',
        view: 'vorderseite',
        region: 'rumpf',
        markerType: 'wunde',
        xPercent: 50,
        yPercent: 40,
        note: 'Testmarker',
      },
      'nurse',
    );
    expect(created.ok).toBe(true);

    const list = await fetchBodyMapMarkers(DEMO_TENANT_ID, clientId, 'nurse');
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data.length).toBeGreaterThan(0);

    const markerId = list.ok ? list.data[0]!.id : '';
    const patched = await patchBodyMapMarker(
      DEMO_TENANT_ID,
      clientId,
      markerId,
      { note: 'Aktualisiert' },
      'nurse',
    );
    expect(patched.ok).toBe(true);

    const removed = await removeBodyMapMarker(DEMO_TENANT_ID, clientId, markerId, 'nurse');
    expect(removed.ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it('SIS form has six topic fields and risk matrix persistence', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');

    const created = await createSisFormAssessment(
      DEMO_TENANT_ID,
      { clientId: 'client-001', clientName: 'Test Person', assessorName: 'Pflege Demo' },
      'nurse',
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(Object.keys(created.data.topics)).toHaveLength(SIS_TOPIC_FIELDS.length);
    created.data.risks = [
      {
        id: 'risk-test',
        riskType: 'Sturz',
        level: 'hoch',
        measureRef: 'MP-1',
        notes: 'Nachts begleiten',
      },
    ];

    const saved = await saveSisFormAssessment(DEMO_TENANT_ID, created.data, 'nurse');
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.data.overallScore).toBeGreaterThan(0);

    const loaded = await fetchSisFormDetail(DEMO_TENANT_ID, created.data.id, 'nurse');
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.data.risks.length).toBe(1);
    vi.unstubAllEnvs();
  });

  it('legal document workflow generates, signs and saves to record', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const clientId = 'client-001';

    const generated = await generateLegalDocumentFromTemplate(DEMO_TENANT_ID, clientId, 'kundenvertrag');
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    const signed = await signLegalDocument(DEMO_TENANT_ID, clientId, generated.data.id, 'Office Demo');
    expect(signed.ok).toBe(true);

    const saved = await saveLegalDocumentToRecord(DEMO_TENANT_ID, clientId, generated.data.id);
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      const full = getDemoClientFullDetail(clientId);
      expect(full?.documents.some((d) => d.id === generated.data.id && d.title.includes('(in Akte)'))).toBe(true);
      expect(full?.timeline.some((e) => e.metadata?.documentId === generated.data.id)).toBe(true);
    }
    vi.unstubAllEnvs();
  });
});

describe('Bridge route elimination', () => {
  it('no EinzelseitenBridgeRoute remains in app routes', () => {
    const fs = require('node:fs');
    const path = require('node:path');

    function walk(dir: string, hits: string[] = []): string[] {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full, hits);
        else if (name.endsWith('.tsx') && fs.readFileSync(full, 'utf8').includes('EinzelseitenBridgeRoute')) {
          hits.push(full);
        }
      }
      return hits;
    }

    const remaining = walk(path.join(process.cwd(), 'app'));
    expect(remaining).toEqual([]);
  });

  it('no titleOverride aliases remain in app routes', () => {
    const fs = require('node:fs');
    const path = require('node:path');

    function walk(dir: string, hits: string[] = []): string[] {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full, hits);
        else if (name.endsWith('.tsx') && fs.readFileSync(full, 'utf8').includes('titleOverride')) {
          hits.push(full);
        }
      }
      return hits;
    }

    expect(walk(path.join(process.cwd(), 'app'))).toEqual([]);
  });
});

describe('Phase 4 dedicated module services', () => {
  it('akademie dedicated lists return demo data', async () => {
    const lessons = await fetchLessonList(DEMO_TENANT_ID, 'akademie_admin');
    const exams = await fetchExamList(DEMO_TENANT_ID, 'akademie_admin');
    expect(lessons.ok).toBe(true);
    expect(exams.ok).toBe(true);
    if (lessons.ok) expect(lessons.data.length).toBeGreaterThan(0);
    if (exams.ok) expect(exams.data.length).toBeGreaterThan(0);
  });

  it('pflege information collections can be listed and created', async () => {
    const list = await fetchInformationCollections(DEMO_TENANT_ID, 'nurse');
    expect(list.ok).toBe(true);
    const created = await createInformationCollection(
      DEMO_TENANT_ID,
      { clientId: 'client-001', clientName: 'Test Klient', collectionType: 'Erstaufnahme' },
      'nurse',
    );
    expect(created.ok).toBe(true);
  });
});
