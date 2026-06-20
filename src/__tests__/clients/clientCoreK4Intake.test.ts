import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getIntakeStepsForServiceTypeKeys } from '@/lib/clients/clientIntakeService';
import { careContextsToServiceTypeKeys } from '@/lib/client/clientServiceTypeService';

const ROOT = resolve(__dirname, '../../..');

describe('Client Core K.4 — intake mapping smoke', () => {
  it('submitClientIntake calls syncClientCoreAfterIntake', () => {
    const intake = readFileSync(resolve(ROOT, 'src/lib/clients/clientIntakeService.ts'), 'utf8');
    expect(intake).toContain('syncClientCoreAfterIntake');
  });

  it('useClientIntakeWizard loads DB sections via getServiceIntakeSections', () => {
    const hook = readFileSync(resolve(ROOT, 'src/hooks/useClientIntakeWizard.ts'), 'utf8');
    expect(hook).toContain('getServiceIntakeSections');
    expect(hook).toContain('getIntakeStepsForServiceTypeKeys');
  });

  it('dynamic intake steps include versorgung when DB section present', () => {
    const contexts = ['ambulatory_care'] as const;
    const keys = careContextsToServiceTypeKeys([...contexts]);
    const steps = getIntakeStepsForServiceTypeKeys(keys, [...contexts], [
      { sectionKey: 'versorgung', isRequired: true, sortOrder: 40 },
      { sectionKey: 'kostentraeger', isRequired: true, sortOrder: 50 },
    ]);
    expect(steps).toContain('leistungsart');
    expect(steps).toContain('versorgung');
    expect(steps).toContain('pruefung');
  });

  it('clientCoreIntakeSyncService initializes budget and portal without delete', () => {
    const sync = readFileSync(resolve(ROOT, 'src/lib/client/clientCoreIntakeSyncService.ts'), 'utf8');
    expect(sync).toContain('syncClientServiceProfiles');
    expect(sync).toContain('initializeClientBudgetFromDefaults');
    expect(sync).toContain('upsertClientPortalSettings');
    expect(sync).not.toContain('.delete(');
  });
});
