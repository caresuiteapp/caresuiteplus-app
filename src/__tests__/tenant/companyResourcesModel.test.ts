import { describe, expect, it } from 'vitest';
import { allocationsOverlap, annualResourceCost, companyResourceDeadlines, deadlineDays, resourceDraft, resourceMatches, validateResourceDraft, type ResourceDraft } from '@/components/company/companyResourcesModel.web';
import type { CompanyResourcesSnapshot, CompanyVehicle, CompanyVehicleAllocation } from '@/types/tenant/companyResources';
const vehicle = { id: 'car', plate: 'HER-CS 100', status: 'available', huDueOn: '2026-11-01', serviceDueOn: null, leaseEndsOn: null } as CompanyVehicle;
const snapshot = (): CompanyResourcesSnapshot => ({ contracts: [], policies: [], vehicles: [], allocations: [], assetLinks: [], employees: [], employeesVisible: true, entities: [], sites: [], departments: [], inventoryItems: [], logbookVehicles: [], documents: [], audit: [], permissions: [], scopeLimited: false, canManageScopes: true });
describe('company resources view model', () => {
  it('keeps independent return dates unique while opening the correct vehicle file', () => {
    const data = snapshot(); data.vehicles = [vehicle]; data.allocations = [{ id: 'one', vehicleId: 'car', status: 'planned', endsAt: '2026-10-16T12:00:00Z' }, { id: 'two', vehicleId: 'car', status: 'active', endsAt: '2026-10-17T12:00:00Z' }] as CompanyVehicleAllocation[];
    const dates = companyResourceDeadlines(data, new Date('2026-10-15T12:00:00Z'));
    expect(dates.filter(row => row.resourceKind === 'allocation').map(row => row.resourceId)).toEqual(['car', 'car']);
    expect(new Set(dates.map(row => row.id)).size).toBe(3);
  });
  it('removes archived vehicles and returned allocations from pending deadlines', () => {
    const data = snapshot(); data.vehicles = [{ ...vehicle, status: 'archived' }]; data.allocations = [{ id: 'returned', vehicleId: 'car', status: 'returned', endsAt: '2026-10-01T12:00:00Z' }] as CompanyVehicleAllocation[];
    expect(companyResourceDeadlines(data)).toEqual([]);
  });
  it('allows adjacent reservations and blocks overlapping or unbounded allocations', () => {
    expect(allocationsOverlap('2026-10-16T10:00:00Z', '2026-10-16T11:00:00Z', '2026-10-16T11:00:00Z', null)).toBe(false);
    expect(allocationsOverlap('2026-10-16T10:00:00Z', null, '2026-10-17T11:00:00Z', null)).toBe(true);
    expect(allocationsOverlap('2026-10-16T10:00:00Z', '2026-10-16T12:00:00Z', '2026-10-16T11:00:00Z', '2026-10-16T13:00:00Z')).toBe(true);
  });
  it('does not present one-off costs as recurring annual premiums', () => {
    expect(annualResourceCost(10000, 'once')).toBe(0); expect(annualResourceCost(10000, 'monthly')).toBe(120000); expect(annualResourceCost(null, 'yearly')).toBe(0);
  });
  it('rejects calendar overflow, reversed terms and fractions of a cent', () => {
    const draft: ResourceDraft = { ...resourceDraft('insurance'), title: 'Betriebshaftpflicht', insuranceType: 'Haftpflicht', provider: 'Versicherer', policyNumber: '123', startsOn: '2026-10-15', endsOn: '2026-09-15', reviewOn: '2026-02-31', premiumCents: '12,345' };
    expect(validateResourceDraft('insurance', draft)).toHaveProperty('endsOn'); expect(validateResourceDraft('insurance', draft)).toHaveProperty('reviewOn'); expect(validateResourceDraft('insurance', draft)).toHaveProperty('premiumCents');
  });
  it('accepts explicit zero values without inventing coverage or costs', () => {
    const draft: ResourceDraft = { ...resourceDraft('insurance'), title: 'Haftpflicht', insuranceType: 'Betrieb', provider: 'Versicherer', policyNumber: '123', excessCents: '0', premiumCents: '' };
    expect(validateResourceDraft('insurance', draft)).toEqual({}); expect(draft.coverageCents).toBe('');
  });
  it('matches search words across meaningful fields and computes date-only differences', () => {
    expect(resourceMatches('her volks', ['HER-CS 123', 'Volkswagen'])).toBe(true); expect(deadlineDays('2026-10-15', new Date('2026-10-15T23:59:00'))).toBe(0);
  });
});
