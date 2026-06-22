import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getDemoVitalReadings } from '@/data/demo/vitalReadings';
import { getDemoMedicationListItems } from '@/data/demo/medications';
import { getDemoWoundDocumentations } from '@/data/demo/woundDocumentations';
import { getDemoCareRecordListItems } from '@/data/demo/careRecords';
import { getDemoShiftScheduleListItems } from '@/lib/pflege/shiftScheduleDemo';
import { getDemoSisAssessments } from '@/data/demo/sisAssessments';
import {
  ALLOWED_PREPARED_ONLY_KEYS,
  isPreparedOnlyStatus,
  resolveDemoOrLiveStatus,
  resolveExternalProviderStatus,
} from '@/lib/status/featureStatus';
import {
  isMedicationLiveReady,
  isMedicationEmpReady,
  isShiftScheduleLiveReady,
  isVitalWriteReady,
  isWoundDocumentationLiveReady,
  isWoundBodyMapReady,
} from '@/lib/pflege/pflegeModuleConfig';
import {
  isAssistExtensionLiveReady,
} from '@/lib/assist/assistModuleConfig';
import {
  isBeratungExtensionLiveReady,
} from '@/lib/beratung/beratungModuleConfig';
import {
  isStationaerExtensionLiveReady,
} from '@/lib/stationaer/stationaerModuleConfig';
import {
  isAkademieExtensionLiveReady,
} from '@/lib/akademie/akademieModuleConfig';
import { createVitalReading, fetchMedicationList } from '@/lib/pflege';
import { fetchShiftScheduleList } from '@/lib/pflege/shiftScheduleService';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Prepared-only elimination sprint', () => {
  it('featureStatus model exports labels and allowed external keys', () => {
    expect(isPreparedOnlyStatus('available_demo')).toBe(false);
    expect(isPreparedOnlyStatus('requires_external_provider')).toBe(true);
    expect(ALLOWED_PREPARED_ONLY_KEYS).toContain('emp');
    expect(ALLOWED_PREPARED_ONLY_KEYS).toContain('ti');
    expect(resolveDemoOrLiveStatus(false)).toBe('available_demo');
    expect(resolveExternalProviderStatus()).toBe('requires_external_provider');
  });

  it('Pflege demo data meets sprint minimums', () => {
    expect(getDemoVitalReadings().length).toBeGreaterThanOrEqual(30);
    expect(getDemoMedicationListItems().length).toBeGreaterThanOrEqual(12);
    expect(getDemoWoundDocumentations().length).toBeGreaterThanOrEqual(10);
    expect(getDemoCareRecordListItems().length).toBeGreaterThanOrEqual(25);
    expect(getDemoShiftScheduleListItems().length).toBeGreaterThanOrEqual(100);
    expect(getDemoSisAssessments().length).toBeGreaterThanOrEqual(10);
  });

  it('core Pflege modules are demo-functional (not preparedOnly)', () => {
    expect(isMedicationLiveReady()).toBe(true);
    expect(isWoundDocumentationLiveReady()).toBe(true);
    expect(isShiftScheduleLiveReady()).toBe(true);
    expect(isAssistExtensionLiveReady()).toBe(true);
    expect(isBeratungExtensionLiveReady()).toBe(true);
    expect(isStationaerExtensionLiveReady()).toBe(true);
    expect(isAkademieExtensionLiveReady()).toBe(true);
  });

  it('BodyMap is demo-functional when demo mode active', () => {
    expect(isWoundBodyMapReady()).toBe(true);
  });

  it('external-provider gates remain honestly blocked for eMP only', () => {
    expect(isMedicationEmpReady()).toBe(false);
  });

  it('Pflege CRUD services return demo data', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');

    const meds = await fetchMedicationList(DEMO_TENANT_ID, 'nurse');
    expect(meds.ok).toBe(true);
    if (meds.ok) expect(meds.data.length).toBeGreaterThanOrEqual(12);

    const shifts = await fetchShiftScheduleList(DEMO_TENANT_ID, 'nurse');
    expect(shifts.ok).toBe(true);
    if (shifts.ok) expect(shifts.data.length).toBeGreaterThanOrEqual(100);

    const vitalWrite = await createVitalReading(
      DEMO_TENANT_ID,
      { clientId: 'client-001', type: 'pulse', value: '70' },
      'nurse',
    );
    expect(vitalWrite.ok).toBe(true);
    expect(isVitalWriteReady()).toBe(true);

    vi.unstubAllEnvs();
  });

  it('prepared-only audit script and migration exist', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'scripts/prepared-only-audit.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'supabase/migrations/0040_prepared_only_elimination.sql'))).toBe(true);
    const pkg = JSON.parse(readSrc('package.json'));
    expect(pkg.scripts['prepared-only:audit']).toBe('node scripts/prepared-only-audit.mjs');
  });

  it('PflegeIndexScreen tiles no longer force preparedOnly on core modules', () => {
    const screen = readSrc('src/screens/pflege/PflegeIndexScreen.tsx');
    expect(screen).toContain('isMedicationLiveReady');
    expect(screen).not.toContain('preparedOnly={true}');
  });
});
