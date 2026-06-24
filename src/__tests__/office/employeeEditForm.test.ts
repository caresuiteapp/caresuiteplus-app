import { describe, expect, it } from 'vitest';
import {
  buildEmployeeEditUpdatePayload,
  formatEmployeeEditSummary,
  mapEmployeeDetailToEditForm,
} from '@/lib/office/employeeEditFormMappers';
import {
  resolveEmployeeDepartmentLabel,
  resolveEmployeeRoleLabel,
} from '@/lib/office/employeeCatalogLabels';
import type { EmployeeDetail } from '@/types/modules/employeeDetail';

const BASE_EMPLOYEE: EmployeeDetail = {
  id: 'emp-001',
  tenantId: 'tenant-001',
  firstName: 'Mhi Aldeen',
  lastName: 'Al Jlelati',
  jobTitle: 'alltagsbegleiter',
  email: 'mhialdeenaljlelati@gmail.com',
  phone: '01626074009',
  status: 'aktiv',
  updatedAt: '2026-06-01T10:00:00.000Z',
  createdAt: '2026-01-15T08:00:00.000Z',
  department: 'assist_aussendienst',
  startDate: '2026-01-15',
  notes: null,
  avatarUrl: null,
  mobile: '01701234567',
  employmentType: 'part_time',
  weeklyHours: 20,
  street: 'Musterstr.',
  houseNumber: '1',
  postalCode: '44623',
  city: 'Herne',
  hasFirstAidCertificate: false,
  hasDriverLicense: false,
  driverLicenseClass: null,
  hasPoliceClearance: false,
  policeClearanceDate: null,
};

describe('employeeEditFormMappers', () => {
  it('mapEmployeeDetailToEditForm maps catalog keys and extended fields', () => {
    const form = mapEmployeeDetailToEditForm(BASE_EMPLOYEE);

    expect(form.firstName).toBe('Mhi Aldeen');
    expect(form.lastName).toBe('Al Jlelati');
    expect(form.email).toBe('mhialdeenaljlelati@gmail.com');
    expect(form.phone).toBe('01626074009');
    expect(form.mobile).toBe('01701234567');
    expect(form.roleKey).toBe('alltagsbegleiter');
    expect(form.departmentKey).toBe('assist_aussendienst');
    expect(form.status).toBe('aktiv');
    expect(form.entryDate).toBe('2026-01-15');
    expect(form.employmentType).toBe('part_time');
    expect(form.weeklyHours).toBe('20');
  });

  it('buildEmployeeEditUpdatePayload maps live columns and status enum', () => {
    const form = mapEmployeeDetailToEditForm(BASE_EMPLOYEE);
    form.notes = 'Interne Notiz';
    form.hasFirstAidCertificate = true;
    form.hasPoliceClearance = true;
    form.policeClearanceDate = '2026-02-01';

    expect(buildEmployeeEditUpdatePayload(form)).toEqual({
      first_name: 'Mhi Aldeen',
      last_name: 'Al Jlelati',
      email: 'mhialdeenaljlelati@gmail.com',
      phone: '01626074009',
      mobile: '01701234567',
      role_title: 'alltagsbegleiter',
      department: 'assist_aussendienst',
      status: 'active',
      internal_notes: 'Interne Notiz',
      entry_date: '2026-01-15',
      employment_type: 'part_time',
      weekly_hours: 20,
      street: null,
      house_number: null,
      postal_code: null,
      city: null,
      has_first_aid_certificate: true,
      has_driver_license: false,
      driver_license_class: null,
      has_police_clearance: true,
      police_clearance_date: '2026-02-01',
    });
  });

  it('formatEmployeeEditSummary shows German catalog labels instead of raw keys', () => {
    const summary = formatEmployeeEditSummary(mapEmployeeDetailToEditForm(BASE_EMPLOYEE));
    const departmentRow = summary.find((row) => row.label === 'Abteilung');
    const roleRow = summary.find((row) => row.label === 'Rolle');

    expect(departmentRow?.value).toBe('Assist / Außendienst');
    expect(roleRow?.value).toBe('Alltagsbegleiter:in');
    expect(departmentRow?.value).not.toBe('assist_aussendienst');
  });
});

describe('employeeCatalogLabels', () => {
  it('resolveEmployeeDepartmentLabel maps assist_aussendienst to German label', () => {
    expect(resolveEmployeeDepartmentLabel('assist_aussendienst')).toBe('Assist / Außendienst');
    expect(resolveEmployeeDepartmentLabel('assist_aussendienst')).not.toBe('assist_aussendienst');
  });

  it('resolveEmployeeRoleLabel maps alltagsbegleiter to German label', () => {
    expect(resolveEmployeeRoleLabel('alltagsbegleiter')).toBe('Alltagsbegleiter:in');
  });

  it('resolveEmployeeRoleLabel maps buerokraft and geschaeftsfuehrung with umlauts', () => {
    expect(resolveEmployeeRoleLabel('buerokraft')).toBe('Bürokraft');
    expect(resolveEmployeeRoleLabel('geschaeftsfuehrung')).toBe('Geschäftsführung');
    expect(resolveEmployeeRoleLabel('pflegefachkraft')).toBe('Pflegefachkraft');
  });

  it('resolveEmployeeRoleLabel applies umlaut fallback for unknown keys', () => {
    expect(resolveEmployeeRoleLabel('custom_ae_oe_ue')).toBe('Custom_ä_ö_ü');
  });
});
