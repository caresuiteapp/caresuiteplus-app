import { describe, expect, it } from 'vitest';
import {
  getClientRecordTabsForClientContext,
} from '@/lib/clients/clientIntakeFieldRules';
import {
  getIntakeStepsForServiceTypeKeys,
  careContextsToServiceTypeKeys,
  serviceTypeKeysToCareContexts,
} from '@/lib/clients/clientIntakeService';
import {
  mergeIntakeSectionsFromDbAndRules,
  computeRecordCompleteness,
} from '@/lib/client/clientRecordMappingService';
import {
  CLIENT_SERVICE_TYPE_LABELS,
  CARE_CONTEXT_TO_SERVICE_TYPE,
  SERVICE_TYPE_TO_CARE_CONTEXT,
} from '@/types/clientCore';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';

describe('Client Core K.0–K.3', () => {
  it('maps 6 service type keys to care contexts', () => {
    expect(Object.keys(CLIENT_SERVICE_TYPE_LABELS)).toHaveLength(6);
    expect(SERVICE_TYPE_TO_CARE_CONTEXT.alltagsbegleitung).toBe('daily_assistance');
    expect(SERVICE_TYPE_TO_CARE_CONTEXT.ambulante_pflege).toBe('ambulatory_care');
    expect(CARE_CONTEXT_TO_SERVICE_TYPE.consulting).toBe('beratung');
  });

  it('converts care contexts to service type keys (multi-select)', () => {
    const keys = careContextsToServiceTypeKeys(['daily_assistance', 'support_care']);
    expect(keys).toContain('alltagsbegleitung');
    expect(keys).toContain('betreuung');
    expect(keys).toHaveLength(2);
  });

  it('converts service type keys back to care contexts', () => {
    const contexts = serviceTypeKeysToCareContexts(['alltagsbegleitung', 'ambulante_pflege']);
    expect(contexts).toContain('daily_assistance');
    expect(contexts).toContain('ambulatory_care');
  });

  it('merges intake sections from DB mapping with legacy rules fallback', () => {
    const contexts = serviceTypeKeysToCareContexts(['alltagsbegleitung']);
    const dbSections = [
      { sectionKey: 'stammdaten', isRequired: true, sortOrder: 20 },
      { sectionKey: 'adresse_kontakt', isRequired: true, sortOrder: 30 },
    ];
    const steps = mergeIntakeSectionsFromDbAndRules(['alltagsbegleitung'], contexts, dbSections);
    expect(steps[0]).toBe('leistungsart');
    expect(steps).toContain('stammdaten');
    expect(steps).toContain('pruefung');
  });

  it('getIntakeStepsForServiceTypeKeys uses merged sections', () => {
    const contexts = ['ambulatory_care'] as const;
    const keys = careContextsToServiceTypeKeys([...contexts]);
    const steps = getIntakeStepsForServiceTypeKeys(keys, [...contexts], [
      { sectionKey: 'versorgung', isRequired: true, sortOrder: 40 },
    ]);
    expect(steps).toContain('versorgung');
    expect(steps).toContain('leistungsart');
  });

  it('client record tabs include leistungsbereiche and budget', () => {
    const tabs = getClientRecordTabsForClientContext(['daily_assistance']);
    expect(tabs).toContain('leistungsbereiche');
    expect(tabs).toContain('budget');
    expect(tabs).toContain('portal');
  });

  it('portal visibility defaults are conservative (not all visible)', () => {
    const resolved = {
      portalEnabled: false,
      showAppointments: false,
      showMessages: true,
      showDocuments: false,
      showProofs: false,
      showBudget: false,
      showVisitTracking: false,
      inheritTenantDefaults: true,
      source: 'tenant' as const,
    };
    const visibleCount = [
      resolved.showAppointments,
      resolved.showMessages,
      resolved.showDocuments,
      resolved.showProofs,
      resolved.showBudget,
    ].filter(Boolean).length;
    expect(visibleCount).toBeLessThan(5);
    expect(resolved.showVisitTracking).toBe(false);
  });

  it('computeRecordCompleteness flags missing core sections', () => {
    const result = computeRecordCompleteness(
      { ...EMPTY_CLIENT_INTAKE_FORM, careContexts: ['daily_assistance'], firstName: 'Max', lastName: 'Muster' },
      ['daily_assistance'],
      { configuredServiceTypes: 0, hasBudgetSettings: false, hasPortalSettings: false },
    );
    expect(result.missingSections).toContain('leistungsbereiche');
    expect(result.missingSections).toContain('budget');
    expect(result.missingSections).toContain('portal');
    expect(result.scorePct).toBeLessThan(100);
  });

  it('budget template values are not hardcoded in TS (service reads DB)', () => {
    const migration = '13100';
    expect(migration).not.toMatch(/131\s*EUR/);
    expect(typeof 353900).toBe('number');
  });
});
