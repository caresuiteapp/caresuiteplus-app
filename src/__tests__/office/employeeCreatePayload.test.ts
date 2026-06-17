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
      status: 'active',
      avatar_url: null,
    });
    expect(payload).not.toHaveProperty('job_title');
    expect(payload).not.toHaveProperty('department');
  });

  it('buildEmployeeUpdatePayload maps editable live fields only', () => {
    expect(
      buildEmployeeUpdatePayload({
        jobTitle: 'pflegefachkraft',
        phone: '01626074009',
        notes: 'Notiz',
        status: 'krank',
        avatarUrl: 'https://cdn.example/avatar.jpg',
      }),
    ).toEqual({
      role_title: 'pflegefachkraft',
      phone: '01626074009',
      internal_notes: 'Notiz',
      status: 'sick',
      avatar_url: 'https://cdn.example/avatar.jpg',
    });
  });
});
