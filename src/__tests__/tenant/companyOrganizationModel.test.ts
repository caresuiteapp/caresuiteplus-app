import { describe, expect, it } from 'vitest';
import { organizationDescendants, organizationDraft, organizationMatches, placementPeriod, validateOrganizationDraft } from '@/components/company/companyOrganizationModel.web';
import type { CompanyEmployeePlacement } from '@/types/tenant/companyOrganization';

describe('company organization model', () => {
  it('matches all search terms regardless of order and accents', () => {
    expect(organizationMatches('Muller herne', ['Herne', 'Müller Team'])).toBe(true);
    expect(organizationMatches('Muller Dortmund', ['Herne', 'Müller Team'])).toBe(false);
  });
  it('excludes all descendants from parent choices and terminates on invalid existing cycles', () => {
    const records = [{ id: 'a', parentEntityId: 'c' }, { id: 'b', parentEntityId: 'a' }, { id: 'c', parentEntityId: 'b' }, { id: 'd', parentEntityId: null }];
    expect([...organizationDescendants(records, 'a')].sort()).toEqual(['a', 'b', 'c']);
  });
  it('rejects missing personnel targets, impossible dates and excessive allocation', () => {
    const draft = { ...organizationDraft({ kind: 'placement' }), startsOn: '2026-02-30', endsOn: '2026-01-01', allocationPercent: '101' };
    const errors = validateOrganizationDraft('placement', draft);
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['employeeId', 'siteId', 'startsOn', 'endsOn', 'allocationPercent']));
  });
  it('validates real partner identity and prevents self-relations', () => {
    const draft = organizationDraft({ kind: 'relationship' });
    expect(validateOrganizationDraft('relationship', draft)).toHaveProperty('partnerName');
    expect(validateOrganizationDraft('relationship', { ...draft, entityId: 'one', partnerEntityId: 'one' })).toHaveProperty('partnerEntityId');
    expect(validateOrganizationDraft('relationship', { ...draft, partnerEntityId: 'two', ownershipPercent: '49,5' })).toEqual({});
  });
  it('distinguishes future and completed placements from current ones', () => {
    const placement = { status: 'active', startsOn: '2026-10-01', endsOn: '2026-10-31' } as CompanyEmployeePlacement;
    expect(placementPeriod(placement, '2026-10-15')).toBe('Aktuell');
    expect(placementPeriod(placement, '2026-09-30')).toBe('Geplant');
    expect(placementPeriod(placement, '2026-11-01')).toBe('Beendet');
    expect(placementPeriod({ ...placement, status: 'archived' }, '2026-10-15')).toBe('Archiviert');
  });
});
