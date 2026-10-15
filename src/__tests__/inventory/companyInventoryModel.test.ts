import { describe, expect, it } from 'vitest';
import type { InventoryAssignment } from '@/types/inventory';
import {
  inventoryItemDraft, inventoryMatches, isAssignmentOpen, isAssignmentOverdue,
  validateInventoryItemDraft,
} from '@/components/company/companyInventoryModel.web';

const assignment = (patch: Partial<InventoryAssignment> = {}): InventoryAssignment => ({
  id: 'assignment-test', tenantId: 'tenant-test', itemId: 'item-test', recipientEmployeeId: 'employee-test',
  status: 'issued', issueCondition: 'good', returnRequired: true,
  issuedAt: '2026-10-01T12:00:00Z', expectedReturnAt: '2026-10-15T23:59:59+02:00',
  createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z', ...patch,
});

describe('company inventory presentation decisions', () => {
  it('keeps losses and disputes open until responsibility has been resolved', () => {
    expect(isAssignmentOpen(assignment({ status: 'lost' }))).toBe(true);
    expect(isAssignmentOpen(assignment({ status: 'disputed' }))).toBe(true);
    expect(isAssignmentOpen(assignment({ status: 'partially_returned' }))).toBe(true);
    expect(isAssignmentOpen(assignment({ status: 'damaged_returned' }))).toBe(false);
    expect(isAssignmentOpen(assignment({ status: 'returned' }))).toBe(false);
    expect(isAssignmentOpen(assignment({ status: 'archived' }))).toBe(false);
  });
  it('allows the whole selected return day and does not flag completed assignments overdue', () => {
    expect(isAssignmentOverdue(assignment(), '2026-10-15')).toBe(false);
    expect(isAssignmentOverdue(assignment(), '2026-10-16')).toBe(true);
    expect(isAssignmentOverdue(assignment({ status: 'returned' }), '2026-10-16')).toBe(false);
    expect(isAssignmentOverdue(assignment({ expectedReturnAt: null }), '2026-10-16')).toBe(false);
  });
  it('shows explicitly overdue data even without a parseable historical deadline', () => {
    expect(isAssignmentOverdue(assignment({ status: 'overdue', expectedReturnAt: null }), '2026-10-15')).toBe(true);
  });
  it('starts with an unassessed condition and requires a truthful status before saving', () => {
    const draft = { ...inventoryItemDraft(), name: 'Telefon', categoryId: 'devices' };
    expect(draft.condition).toBe('unknown');
    expect(validateInventoryItemDraft(draft).condition).toBeTruthy();
    expect(validateInventoryItemDraft({ ...draft, status: 'maintenance' })).toEqual({});
    expect(validateInventoryItemDraft({ ...draft, condition: 'good' })).toEqual({});
  });
  it.each(['unknown', 'damaged', 'unusable', 'lost'] as const)('does not release a %s condition as available', condition => {
    const draft = { ...inventoryItemDraft(), name: 'Gegenstand', categoryId: 'category', condition };
    expect(validateInventoryItemDraft(draft).condition).toBeTruthy();
  });
  it('rejects missing identity and warranty ending before purchase', () => {
    const errors = validateInventoryItemDraft({ ...inventoryItemDraft(), name: ' ', purchaseDate: '2026-10-15', warrantyUntil: '2025-10-15' });
    expect(errors.name).toBeTruthy();
    expect(errors.categoryId).toBeTruthy();
    expect(errors.warrantyUntil).toBeTruthy();
  });
  it('matches every search word across identifiers and labels without exposing object metadata', () => {
    expect(inventoryMatches('  TELEFON  042 ', ['Diensttelefon', 'INV-042', null])).toBe(true);
    expect(inventoryMatches('Telefon 043', ['Diensttelefon', 'INV-042'])).toBe(false);
    expect(inventoryMatches('geheim', ['Diensttelefon', { name: 'geheim' }])).toBe(false);
  });
});
