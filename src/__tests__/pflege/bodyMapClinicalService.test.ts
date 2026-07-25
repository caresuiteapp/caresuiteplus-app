import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addBodyMapFindingProgress,
  buildBodyMapClinicalStoragePath,
  createPressureInjuryAssessment,
  fetchBodyMapClinicalRecord,
  uploadBodyMapClinicalPhoto,
} from '@/lib/pflege/bodyMapClinicalService';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Bodymap-Foto, Verlauf und Dekubitus-Assessment', () => {
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
        tissuePercentages: { granulation: 70, fibrin: 30 },
        exudate: { amount: 'mittel', character: 'seroes' },
        pain: { score: 4, scale: 'NRS', duringCare: true },
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
      expect(record.data.history[0]?.eventType).toBe('healing');
    }
  });
});
