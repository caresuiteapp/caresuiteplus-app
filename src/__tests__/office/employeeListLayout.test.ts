import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getEmployeeInitials } from '@/lib/office/employeeAvatarDisplay';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Employee avatar display', () => {
  it('getEmployeeInitials liefert Initialen aus Vor- und Nachname', () => {
    expect(getEmployeeInitials('Thomas', 'Keller')).toBe('TK');
    expect(getEmployeeInitials('Anna', 'Krüger')).toBe('AK');
  });

  it('getEmployeeInitials fällt auf ? zurück wenn Namen fehlen', () => {
    expect(getEmployeeInitials('', '')).toBe('?');
    expect(getEmployeeInitials('  ', '  ')).toBe('?');
  });

  it('EmployeeListAvatar nutzt PremiumAvatar und avatarUrl', () => {
    const source = readSrc('src/components/office/EmployeeListAvatar.tsx');
    expect(source).toContain('PremiumAvatar');
    expect(source).toContain('avatarUrl');
    expect(source).toContain('getEmployeeInitials');
  });
});

describe('EmployeesListView Filter-Dropdowns', () => {
  it('nutzt ListFilterSelect für Status und Sortierung', () => {
    const source = readSrc('src/components/office/EmployeesListView.tsx');
    expect(source).toContain('ListFilterSelect');
    expect(source).toContain('label="Status"');
    expect(source).toContain('label="Sortierung"');
    expect(source).toContain('setStatusFilter');
    expect(source).toContain('setSortKey');
    expect(source).not.toContain('FilterChipGroup');
  });
});
