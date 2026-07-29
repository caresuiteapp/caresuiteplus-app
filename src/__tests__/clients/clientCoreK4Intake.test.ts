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

  it('keeps a new intake as lead until all related writes succeed', () => {
    const intake = readFileSync(resolve(ROOT, 'src/lib/clients/clientIntakeService.ts'), 'utf8');
    const repository = readFileSync(
      resolve(ROOT, 'src/lib/clients/repositories/clientIntakeRepository.supabase.ts'),
      'utf8',
    );
    expect(repository).toContain("buildIntakeClientRecord(tenantId, form, actorProfileId, 'lead')");
    expect(repository).toContain('export async function activateClientFromIntake');
    expect(intake).toContain("{ eventMode: 'create' }");
    expect(intake.indexOf('persistClientIntakeDocuments')).toBeLessThan(
      intake.lastIndexOf('activateClientFromIntake'),
    );
    expect(intake.indexOf('syncClientCoreAfterIntake')).toBeLessThan(
      intake.lastIndexOf('activateClientFromIntake'),
    );
  });

  it('uses retry-safe extended writes without blocking on derived care entitlement errors', () => {
    const persistence = readFileSync(
      resolve(ROOT, 'src/lib/clients/clientIntakePersistence.ts'),
      'utf8',
    );
    expect(persistence).toContain("eventMode?: 'create' | 'edit'");
    expect(persistence).toContain(".contains('metadata', { source: 'intake' })");
    expect(persistence).toContain("console.warn('[clientIntakePersistence] care entitlement sync:'");
    expect(persistence).not.toContain('if (!entitlementResult.ok) return entitlementResult');
  });

  it('limits profile section edits to their own persistence domain', () => {
    const modal = readFileSync(
      resolve(ROOT, 'src/components/office/ClientSectionEditModal.tsx'),
      'utf8',
    );
    const intake = readFileSync(resolve(ROOT, 'src/lib/clients/clientIntakeService.ts'), 'utf8');
    expect(modal).toContain('editSections: [section]');
    expect(intake).toContain('sections?: IntakeSectionKey[]');
    expect(intake).toContain("shouldPersist('vertraege_einwilligungen')");
    expect(intake).toContain("{ sections: options?.sections }");
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
