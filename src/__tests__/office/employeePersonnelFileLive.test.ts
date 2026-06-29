import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildEmployeePersonnelFileFromLiveRows,
  buildMasterDataLiveUpdatePayload,
  buildQualificationsFromEmployeeRow,
} from '@/lib/office/employeePersonnelFileMapper';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const BASE_ROW = {
  id: '1bf39e72-8ae1-480e-9dfb-bcb5aa7b6a4f',
  tenant_id: '56180c22-b894-4fab-b55e-a563c94dd6e7',
  first_name: 'Mhi Aldeen',
  last_name: 'Al Jlelati',
  role_title: 'Alltagsbegleiter:in',
  email: 'mhialdeenaljlelati@gmail.com',
  phone: '01626074009',
  status: 'active',
  portal_enabled: true,
  has_police_clearance: false,
  has_first_aid_certificate: false,
  created_at: '2026-06-17T10:00:00.000Z',
  updated_at: '2026-06-17T10:00:00.000Z',
};

describe('employeePersonnelFileLive mapper', () => {
  it('loader fällt auf Detail-Select zurück (wie fetchEmployeeDetail)', () => {
    const loaderSource = readSrc('src/lib/office/employeePersonnelFileLiveLoader.ts');
    const detailSource = readSrc('src/lib/office/employeeDetailMapper.ts');
    expect(loaderSource).toContain('EMPLOYEE_DETAIL_SELECT_COLUMNS');
    expect(loaderSource).toContain('EMPLOYEE_BASE_SELECT_COLUMNS');
    expect(loaderSource).not.toContain('job_title, department, start_date, notes');
    expect(loaderSource).toContain('internal_notes');
    expect(loaderSource).not.toContain("'notes'");
    expect(detailSource).toContain('date_of_birth');
    expect(loaderSource).toContain('loadEmployeeWorkMaterials');
    expect(loaderSource).toContain('loadEmployeeAuditEventsFromDb');
    expect(loaderSource).toContain('loadEmployeeHomeOfficeOverride');
  });

  it('maps live employee row to personnel file', () => {
    const file = buildEmployeePersonnelFileFromLiveRows({
      employee: { ...BASE_ROW, date_of_birth: '1985-06-12' },
    });

    expect(file.employeeId).toBe(BASE_ROW.id);
    expect(file.tenantId).toBe(BASE_ROW.tenant_id);
    expect(file.masterData.firstName).toBe('Mhi Aldeen');
    expect(file.masterData.lastName).toBe('Al Jlelati');
    expect(file.masterData.dateOfBirth).toBe('1985-06-12');
    expect(file.masterData.roleTitle).toBe('Alltagsbegleiter:in');
    expect(file.masterData.status).toBe('aktiv');
    expect(file.employment.employmentStatus).toBe('active');
    expect(file.portalAccess.portalActive).toBe(true);
    expect(file.backgroundCheck.status).toBe('missing');
    expect(file.qualifications).toEqual([]);
    expect(file.documents).toEqual([]);
    expect(file.tabs.length).toBeGreaterThan(0);
  });

  it('serializes Geburtsdatum for live employee update', () => {
    expect(buildMasterDataLiveUpdatePayload({ dateOfBirth: '15.03.1990' })).toEqual({
      date_of_birth: '1990-03-15',
    });
    expect(buildMasterDataLiveUpdatePayload({ dateOfBirth: '1990-03-15' })).toEqual({
      date_of_birth: '1990-03-15',
    });
    expect(buildMasterDataLiveUpdatePayload({ dateOfBirth: null })).toEqual({
      date_of_birth: null,
    });
  });

  it('derives qualifications from employee flags', () => {
    const qualifications = buildQualificationsFromEmployeeRow({
      ...BASE_ROW,
      has_first_aid_certificate: true,
      first_aid_valid_until: '2027-01-01',
      has_driver_license: true,
      driver_license_class: 'B',
      qualification: 'Pflegefachkraft',
    });

    expect(qualifications).toHaveLength(3);
    expect(qualifications.map((q) => q.qualificationType)).toEqual([
      'first_aid',
      'driving_license',
      'nursing_qualification',
    ]);
  });
});
