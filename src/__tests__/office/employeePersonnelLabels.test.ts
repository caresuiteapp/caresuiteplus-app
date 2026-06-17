import { describe, expect, it } from 'vitest';
import {
  labelBackgroundCheckStatus,
  labelEmployeeDeployability,
  labelEmploymentStatus,
  labelQualificationStatus,
  resolvePersonnelBlockerActions,
} from '@/lib/office/employeePersonnelLabels';
import { evaluateEmployeeDeployability } from '@/lib/office/employeeDeployabilityService';
import { buildEmployeePersonnelFileFromLiveRows } from '@/lib/office/employeePersonnelFileMapper';

describe('employeePersonnelLabels', () => {
  it('übersetzt Status-Badges ins Deutsche', () => {
    expect(labelEmployeeDeployability('blocked')).toBe('Gesperrt');
    expect(labelEmployeeDeployability('assignable')).toBe('Einsatzfähig');
    expect(labelBackgroundCheckStatus('missing')).toBe('Fehlt');
    expect(labelQualificationStatus('missing')).toBe('Fehlt');
    expect(labelEmploymentStatus('active')).toBe('Aktiv');
  });

  it('liefert Übersichts-Aktionen für Blocker', () => {
    const file = buildEmployeePersonnelFileFromLiveRows({
      employee: {
        id: 'emp-1',
        tenant_id: 'tenant-1',
        first_name: 'Mhi',
        last_name: 'Test',
        role_title: 'Alltagsbegleiter:in',
        email: 'test@example.com',
        phone: '123',
        status: 'active',
        portal_enabled: true,
        has_police_clearance: false,
        has_first_aid_certificate: false,
        created_at: '2026-06-17T10:00:00.000Z',
        updated_at: '2026-06-17T10:00:00.000Z',
      },
    });

    const actions = resolvePersonnelBlockerActions(file.deployability);
    expect(actions.some((a) => a.label === 'Qualifikation erfassen')).toBe(true);
    expect(actions.some((a) => a.label === 'Führungszeugnis hinterlegen')).toBe(true);
  });

  it('open tasks aus Deployability sind deutsch', () => {
    const deployability = evaluateEmployeeDeployability({
      employment: {
        contractType: null,
        probationEndsAt: null,
        fixedTermEndsAt: null,
        noticePeriodDays: null,
        weeklyHours: 20,
        deploymentArea: null,
        employmentStatus: 'active',
      },
      portalAccess: {
        profileId: null,
        portalActive: true,
        roleKey: null,
        lastLoginAt: null,
        invitationSentAt: null,
        passwordConfigured: false,
        twoFactorPrepared: false,
      },
      qualifications: [],
      backgroundCheck: {
        id: 'bg-1',
        tenantId: 't1',
        employeeId: 'e1',
        present: false,
        issueDate: null,
        verifiedAt: null,
        verifiedBy: null,
        followUpDueAt: null,
        status: 'missing',
        documentId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      documents: [],
      roleTitle: 'Alltagsbegleiter:in',
      backgroundCheckRequired: true,
    });

    expect(deployability.blockers.some((b) => b.message.includes('Führungszeugnis'))).toBe(true);
    expect(deployability.blockers.some((b) => b.message.includes('Pflichtqualifikation'))).toBe(true);
  });
});
