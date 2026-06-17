import { describe, expect, it } from 'vitest';
import {
  buildEmployeeInsertPayload,
  buildEmployeeUpdatePayload,
} from '@/lib/office/employeeSupabasePayload';

const TENANT_ID = '56180c22-b894-4fab-b55e-a563c94dd6e7';

describe('employeeSupabasePayload', () => {
  it('buildEmployeeInsertPayload uses live columns and mapped status', () => {
    const payload = buildEmployeeInsertPayload(TENANT_ID, {
      firstName: 'Mhi Aldeen',
      lastName: 'Al Jlelati',
      jobTitle: 'alltagsbegleiter',
      email: 'mhialdeenaljlelati@gmail.com',
      phone: '01626074009',
      department: 'assist_aussendienst',
      status: 'aktiv',
    });

    expect(payload).toEqual({
      tenant_id: TENANT_ID,
      first_name: 'Mhi Aldeen',
      last_name: 'Al Jlelati',
      role_title: 'alltagsbegleiter',
      email: 'mhialdeenaljlelati@gmail.com',
      phone: '01626074009',
      department: 'assist_aussendienst',
      status: 'active',
      avatar_url: null,
      internal_notes: null,
      entry_date: null,
      employment_type: null,
      weekly_hours: null,
      street: null,
      house_number: null,
      postal_code: null,
      city: null,
      mobile: null,
      has_first_aid_certificate: false,
      has_driver_license: false,
      driver_license_class: null,
      has_police_clearance: false,
      police_clearance_date: null,
    });
    expect(payload).not.toHaveProperty('job_title');
  });

  it('buildEmployeeUpdatePayload maps editable live fields only', () => {
    expect(
      buildEmployeeUpdatePayload({
        firstName: 'Mhi Aldeen',
        lastName: 'Al Jlelati',
        jobTitle: 'pflegefachkraft',
        department: 'assist_aussendienst',
        phone: '01626074009',
        mobile: '01701234567',
        notes: 'Notiz',
        status: 'krank',
        avatarUrl: 'https://cdn.example/avatar.jpg',
        entryDate: '2026-01-15',
        employmentType: 'part_time',
        weeklyHours: 20,
        hasFirstAidCertificate: true,
        hasDriverLicense: true,
        driverLicenseClass: 'B',
        hasPoliceClearance: true,
        policeClearanceDate: '2026-02-01',
      }),
    ).toEqual({
      first_name: 'Mhi Aldeen',
      last_name: 'Al Jlelati',
      role_title: 'pflegefachkraft',
      department: 'assist_aussendienst',
      phone: '01626074009',
      mobile: '01701234567',
      internal_notes: 'Notiz',
      status: 'sick',
      avatar_url: 'https://cdn.example/avatar.jpg',
      entry_date: '2026-01-15',
      employment_type: 'part_time',
      weekly_hours: 20,
      has_first_aid_certificate: true,
      has_driver_license: true,
      driver_license_class: 'B',
      has_police_clearance: true,
      police_clearance_date: '2026-02-01',
    });
  });
});
