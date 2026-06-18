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

describe('EmployeesListView Filter-Chips', () => {
  it('nutzt EmployeesFilterToolbar mit FilterChipGroup für Status und Sortierung', () => {
    const source = readSrc('src/components/office/EmployeesListView.tsx');
    const filters = readSrc('src/components/office/EmployeesFilterToolbar.tsx');
    expect(source).toContain('EmployeesFilterToolbar');
    expect(filters).toContain('FilterChipGroup');
    expect(filters).toContain('>Status</Text>');
    expect(source).toContain('setStatusFilter');
    expect(source).toContain('setSortKey');
    expect(source).not.toContain('ListFilterSelect');
  });
});
