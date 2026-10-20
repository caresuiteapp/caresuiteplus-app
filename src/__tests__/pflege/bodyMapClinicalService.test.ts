import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BODY_MAP_CLINICAL_MEDIA_MAX_BYTES,
  addBodyMapFindingProgress,
  buildBodyMapClinicalStoragePath,
  createPressureInjuryAssessment,
  fetchBodyMapClinicalRecord,
  uploadBodyMapClinicalPhoto,
  validateBodyMapClinicalMediaUpload,
  validatePressureInjuryAssessment,
} from '@/lib/pflege/bodyMapClinicalService';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Bodymap-Foto, Verlauf und Dekubitus-Assessment', () => {
  it('validiert klinische Bilddateien vor dem Upload', () => {
    expect(
      validateBodyMapClinicalMediaUpload({
        fileName: 'verlauf.jpg',
        mimeType: 'image/jpeg',
        bytes: new Uint8Array([1, 2, 3]),
      }),
    ).toBeNull();
    expect(
      validateBodyMapClinicalMediaUpload({
        fileName: 'verlauf.pdf',
        mimeType: 'application/pdf',
        bytes: new Uint8Array([1]),
      }),
    ).toContain('JPEG');
    expect(
      validateBodyMapClinicalMediaUpload({
        fileName: 'zu-gross.jpg',
        mimeType: 'image/jpeg',
        bytes: { byteLength: BODY_MAP_CLINICAL_MEDIA_MAX_BYTES + 1 } as Uint8Array,
      }),
    ).toContain('25 MB');
  });

  it('baut einen mandanten- und klientenisolierten Medienpfad', () => {
    expect(
      buildBodyMapClinicalStoragePath(
        'tenant-1',
        'client-1',
        'marker-1',
        'media-1',
        'Foto Juli 2026.JPG',
      ),
    ).toBe('tenant/tenant-1/clients/client-1/bodymap/marker-1/media-1.jpg');
    expect(
      buildBodyMapClinicalStoragePath(
        'tenant-1',
        'resident-1',
        'marker-1',
        'media-1',
        'Foto.jpg',
        'resident',
      ),
    ).toBe(
      'tenant/tenant-1/subjects/resident/resident-1/bodymap/marker-1/media-1.jpg',
    );
  });

  it('speichert im Demo-Modus Foto, Assessment und Verlauf gemeinsam', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const scope = {
      tenantId: 'tenant-demo',
      clientId: 'client-demo',
      markerId: 'marker-demo',
    };

    const photo = await uploadBodyMapClinicalPhoto({
      ...scope,
      fileName: 'initial.jpg',
      mimeType: 'image/jpeg',
      bytes: new Uint8Array([1, 2, 3]),
      capturePhase: 'initial',
      measurementReferencePresent: true,
      note: 'Ausgangsfoto',
    });
    expect(photo.ok).toBe(true);

    const assessment = await createPressureInjuryAssessment(
      scope.tenantId,
      scope.clientId,
      scope.markerId,
      {
        classification: 'kategorie_2',
        presentOnAdmission: false,
        deviceRelated: false,
        lengthCm: 2.4,
        widthCm: 1.2,
        depthCm: 0.3,
        underminingClockFrom: 3,
        underminingClockTo: 6,
        underminingMaxDepthCm: 1.1,
        tunnelingPresent: true,
        tissuePercentages: { granulation: 70, fibrin: 30 },
        exudate: { amount: 'mittel', character: 'seroes' },
        pain: { score: 4, scale: 'NRS', duringCare: true },
        woundEdge: { mazeriert: false },
        surroundingSkin: { roetung: true },
        infectionSigns: { roetung: true },
        escalationFlags: ['neu_ab_kategorie_2'],
        treatmentPlan: { dressing: 'Schaumverband' },
        pressureReliefPlan: { positioning: '30-Grad-Lagerung', interval: '2 h' },
      },
    );
    expect(assessment.ok).toBe(true);

    const progress = await addBodyMapFindingProgress({
      ...scope,
      status: 'heilend',
      note: 'Wundfläche kleiner.',
    });
    expect(progress.ok).toBe(true);
    const closure = await addBodyMapFindingProgress({
      ...scope,
      status: 'geschlossen',
      note: 'Wunde vollständig epithelialisiert.',
    });
    expect(closure.ok).toBe(true);

    const record = await fetchBodyMapClinicalRecord(
      scope.tenantId,
      scope.clientId,
      scope.markerId,
    );
    expect(record.ok).toBe(true);
    if (record.ok) {
      expect(record.data.media).toHaveLength(1);
      expect(record.data.media[0]?.measurementReferencePresent).toBe(true);
      expect(record.data.pressureAssessments).toHaveLength(1);
      expect(record.data.pressureAssessments[0]?.lengthCm).toBe(2.4);
      expect(record.data.pressureAssessments[0]?.underminingClockFrom).toBe(3);
      expect(record.data.pressureAssessments[0]?.underminingMaxDepthCm).toBe(1.1);
      expect(record.data.pressureAssessments[0]?.tunnelingPresent).toBe(true);
      expect(record.data.pressureAssessments[0]?.surroundingSkin).toEqual({ roetung: true });
      expect(record.data.history[0]?.eventType).toBe('closed');
      expect(record.data.history[1]?.eventType).toBe('healing');
    }
  });

  it('erzeugt im Live-Abruf getrennte kurzlebige Vorschau- und Download-URLs', () => {
    const service = readFileSync(
      resolve(process.cwd(), 'src/lib/pflege/bodyMapClinicalService.ts'),
      'utf8',
    );
    const screen = readFileSync(
      resolve(process.cwd(), 'src/screens/pflege/BodyMapScreen.tsx'),
      'utf8',
    );

    expect(service).toContain('createSignedUrl(media.storagePath, 3600)');
    expect(service).toContain('download: media.originalFileName ?? true');
    expect(service).toContain('downloadUrl: downloadResult.data?.signedUrl ?? null');
    expect(screen).toContain('title="Vorschau"');
    expect(screen).toContain('title="Download"');
  });

  it('weist klinisch ungültige Dekubituswerte in der Service-Schicht zurück', () => {
    expect(
      validatePressureInjuryAssessment({
        classification: 'kategorie_3',
        deviceRelated: false,
        tunnelingPresent: false,
        underminingClockFrom: 13,
        tissuePercentages: { granulation: 70, fibrin: 40 },
        exudate: {},
        pain: { score: 11, scale: 'NRS' },
        woundEdge: {},
        surroundingSkin: {},
        infectionSigns: {},
        escalationFlags: [],
        treatmentPlan: {},
        pressureReliefPlan: {},
      }),
    ).toContain('Schmerzwert');

    expect(
      validatePressureInjuryAssessment({
        classification: 'kategorie_3',
        deviceRelated: false,
        tunnelingPresent: false,
        underminingClockFrom: 13,
        tissuePercentages: { granulation: 60, fibrin: 40 },
        exudate: {},
        pain: { score: 4, scale: 'NRS' },
        woundEdge: {},
        surroundingSkin: {},
        infectionSigns: {},
        escalationFlags: [],
        treatmentPlan: {},
        pressureReliefPlan: {},
      }),
    ).toContain('1 bis 12');

    expect(
      validatePressureInjuryAssessment({
        classification: 'medizinproduktbezogen',
        deviceRelated: true,
        medicalDevice: '',
        tunnelingPresent: false,
        tissuePercentages: {},
        exudate: {},
        pain: {},
        woundEdge: {},
        surroundingSkin: {},
        infectionSigns: {},
        escalationFlags: [],
        treatmentPlan: {},
        pressureReliefPlan: {},
      }),
    ).toContain('Medizinprodukt');
  });

  it('verlangt für jeden Statuswechsel eine Verlaufsnotiz', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const result = await addBodyMapFindingProgress({
      tenantId: 'tenant-demo',
      clientId: 'client-demo',
      markerId: 'marker-demo',
      status: 'geschlossen',
      note: '   ',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Verlaufskontrolle');
  });
});
