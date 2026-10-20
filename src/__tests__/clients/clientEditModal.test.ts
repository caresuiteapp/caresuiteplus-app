import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computeRecordCompleteness,
  mergeIntakeSectionsFromDbAndRules,
} from '@/lib/client/clientRecordMappingService';
import { getRequiredFieldsForServiceTypes } from '@/lib/clients/clientIntakeService';
import { canClientPortalSeeFeature } from '@/lib/client/clientPortalSettingsService';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';

const ROOT = resolve(__dirname, '../../..');

describe('Client Core K.4 — ClientEditModal & mapping', () => {
  it('ClientEditModal uses clientRecordMappingService completeness', () => {
    const modal = readFileSync(resolve(ROOT, 'src/components/office/ClientEditModal.tsx'), 'utf8');
    expect(modal).toContain('computeRecordCompleteness');
    expect(modal).toContain('getRequiredFieldsForServiceTypes');
    expect(modal).toContain('CareMultiCatalogSelect');
    expect(modal).toContain('submitClientIntakeUpdate');
  });

  it('getRequiredFieldsForServiceTypes delegates to care context rules', () => {
    const fields = getRequiredFieldsForServiceTypes(['alltagsbegleitung']);
    expect(fields).toContain('firstName');
    expect(fields).toContain('careContexts');
  });

  it('mergeIntakeSections keeps leistungsart early and pruefung last', () => {
    const steps = mergeIntakeSectionsFromDbAndRules(
      ['alltagsbegleitung'],
      ['daily_assistance'],
      [{ sectionKey: 'versorgung', isRequired: true, sortOrder: 40 }],
    );
    expect(steps[0]).toBe('leistungsart');
    expect(steps[steps.length - 1]).toBe('pruefung');
    expect(steps).toContain('versorgung');
  });

  it('canClientPortalSeeFeature blocks GPS and respects conservative defaults', () => {
    const settings = {
      portalEnabled: true,
      showAppointments: false,
      showMessages: true,
      showDocuments: false,
      showProofs: false,
      showBudget: false,
      showVisitTracking: false,
      inheritTenantDefaults: true,
      source: 'tenant' as const,
    };
    expect(canClientPortalSeeFeature(settings, 'visit_tracking')).toBe(false);
    expect(canClientPortalSeeFeature(settings, 'messages')).toBe(true);
    expect(canClientPortalSeeFeature(settings, 'proofs')).toBe(false);
  });

  it('computeRecordCompleteness flags core K.4 sections', () => {
    const result = computeRecordCompleteness(
      { ...EMPTY_CLIENT_INTAKE_FORM, careContexts: ['daily_assistance'], firstName: 'A', lastName: 'B' },
      ['daily_assistance'],
      { configuredServiceTypes: 0, hasBudgetSettings: false, hasPortalSettings: false },
    );
    expect(result.missingSections).toEqual(
      expect.arrayContaining(['leistungsbereiche', 'budget', 'portal']),
    );
  });
});
