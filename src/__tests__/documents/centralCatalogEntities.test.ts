import { describe, expect, it } from 'vitest';
import { centralCatalogClientOptions, centralCatalogEmployeeOptions, groupCentralCatalogEntities } from '@/lib/documents/centralCatalogEntities';
import type { ClientListItem } from '@/types/modules/office';
import type { EmployeeListItem } from '@/types/modules/employeeList';

describe('catalogue record identity', () => {
  it('lists each normalized name once and retains every distinct record ID', () => {
    const groups = groupCentralCatalogEntities([
      { id: 'a', label: 'Iris Jäger', detail: 'Aktive Akte' },
      { id: 'b', label: ' iris  ja\u0308ger ', detail: 'Aufnahmeentwurf' },
      { id: 'a', label: 'Iris Jäger', detail: 'Aktive Akte' },
      { id: 'c', label: 'Ben Beispiel' },
    ]);
    expect(groups.map((group) => group.label)).toEqual(['Ben Beispiel', 'Iris Jäger']);
    expect(groups[1].records.map((record) => record.id)).toEqual(['a', 'b']);
  });

  it('distinguishes separate records even when status and abbreviated IDs match', () => {
    const records = groupCentralCatalogEntities([
      { id: 'aaaaaaaa-1', label: 'Mara Muster', detail: 'Aufnahmeentwurf' },
      { id: 'aaaaaaaa-2', label: 'Mara Muster', detail: 'Aufnahmeentwurf' },
    ])[0].records;
    expect(new Set(records.map((record) => record.detail)).size).toBe(2);
    expect(records.map((record) => record.id)).toEqual(['aaaaaaaa-1', 'aaaaaaaa-2']);
  });

  it('uses saved identifying details for client and employee records', () => {
    const client = centralCatalogClientOptions([{ id: 'c', firstName: ' Rainer ', lastName: '—', status: 'entwurf', dateOfBirth: '1950-01-02', zip: '10115', city: 'Berlin' } as ClientListItem])[0];
    expect(client.label).toBe('Rainer');
    expect(client.detail).toBe('Aufnahmeentwurf · Geb. 02.01.1950 · 10115 Berlin');
    const employee = centralCatalogEmployeeOptions([{ id: 'e', firstName: 'Anna', lastName: 'Fachkraft', status: 'aktiv', jobTitle: 'Pflegefachkraft', department: 'Nord' } as EmployeeListItem])[0];
    expect(employee.detail).toBe('Aktive Akte · Pflegefachkraft · Nord');
  });
});
