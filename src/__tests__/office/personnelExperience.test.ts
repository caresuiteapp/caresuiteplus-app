import { describe, expect, it } from 'vitest';
import { selectPersonnel, employeeStatusLabel, personnelDate } from '@/lib/office/personnelExperience.web';
import type { EmployeeListItem } from '@/types/modules/employeeList';
const people: EmployeeListItem[] = [
  { id: 'b', tenantId: 't', firstName: 'Mara', lastName: 'Sommer', jobTitle: 'pflegefachkraft', department: 'pflege', email: 'mara@example.invalid', phone: '+49 123 456', status: 'aktiv', updatedAt: '2026-10-15' },
  { id: 'a', tenantId: 't', firstName: 'Özlem', lastName: 'Aydin', jobTitle: 'verwaltung', department: 'verwaltung', email: 'ozlem@example.invalid', phone: null, status: 'entwurf', updatedAt: '2026-10-15' },
  { id: 'c', tenantId: 't', firstName: 'Leon', lastName: 'Seidel', jobTitle: 'pflegefachkraft', department: 'pflege', email: 'leon@example.invalid', phone: null, status: 'archiviert', updatedAt: '2026-10-15' },
];
describe('personnel list selection', () => {
  it('combines name and department terms, ignoring accents', () => {
    expect(selectPersonnel(people, 'ozlem verwaltung', 'all', 'all', 'name_asc').map(item => item.id)).toEqual(['a']);
    expect(selectPersonnel(people, 'Mara Pflege', 'aktiv', 'pflege', 'name_asc').map(item => item.id)).toEqual(['b']);
  });
  it('keeps archived employees reachable and does not reorder the source', () => {
    expect(selectPersonnel(people, '', 'archiviert', 'all', 'name_asc').map(item => item.id)).toEqual(['c']);
    expect(selectPersonnel(people, '', 'all', 'pflege', 'name_desc').map(item => item.id)).toEqual(['b', 'c']);
    expect(people.map(item => item.id)).toEqual(['b', 'a', 'c']);
  });
  it('uses readable labels and never renders Invalid Date', () => {
    expect(employeeStatusLabel('in_bearbeitung')).toBe('In Bearbeitung');
    expect(employeeStatusLabel('krank')).toBe('Krankgemeldet');
    expect(employeeStatusLabel('urlaub')).toBe('Im Urlaub');
    expect(personnelDate('invalid')).toBe('Nicht hinterlegt');
  });
});
