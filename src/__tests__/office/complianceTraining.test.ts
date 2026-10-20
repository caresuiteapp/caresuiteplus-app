import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  buildComplianceAccessContext,
  canViewComplianceTrainingData,
  filterComplianceAssignmentsForViewer,
} from '@/lib/office/complianceTrainingAccess';
import {
  acknowledgeComplianceTraining,
  assignMandatoryComplianceForEmployee,
  createComplianceTrainingItem,
  evaluateComplianceDeployability,
  exportComplianceProof,
  fetchComplianceStatusForAdmin,
  fetchEmployeeComplianceAssignments,
  markComplianceTrainingViewed,
  resetComplianceTrainingStore,
  seedDefaultComplianceItemsForTenant,
} from '@/lib/office/complianceTrainingService';
import {
  evaluateEmployeeDeployability,
  isEmployeeAssignable,
} from '@/lib/office/employeeDeployabilityService';
import { listComplianceAssignmentsForTenant } from '@/lib/office/complianceTrainingStore';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';

const TENANT = DEMO_TENANT_ID;
const ADMIN = 'business_admin' as const;
const EMPLOYEE = 'employee_portal' as const;
const EMPLOYEE_ID = 'employee-003';
const OTHER_EMPLOYEE = 'employee-001';

beforeEach(() => {
  resetComplianceTrainingStore();
});

afterEach(() => {
  resetComplianceTrainingStore();
});

describe('Pflichtunterweisungs- und Compliance-Modul', () => {
  it('1 — Admin kann Unterweisung anlegen mit Rollengruppen', async () => {
    const result = await createComplianceTrainingItem(
      {
        tenantId: TENANT,
        areaKey: 'datenschutz',
        title: 'Datenschutzunterweisung 2026',
        assignedRoleGroups: ['caregiver_employee', 'office'],
        mandatory: true,
        requiresSignature: true,
      },
      ADMIN,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mandatory).toBe(true);
      expect(result.data.assignedRoleGroups).toContain('caregiver_employee');
    }
  });

  it('2 — Pflichtzuweisung für Pflegekraft-Rolle', async () => {
    const assigned = await assignMandatoryComplianceForEmployee(
      TENANT,
      EMPLOYEE_ID,
      'caregiver',
      ADMIN,
    );

    expect(assigned.ok).toBe(true);
    if (assigned.ok) {
      expect(assigned.data.length).toBeGreaterThan(0);
      expect(assigned.data.every((a) => a.mandatory)).toBe(true);
    }
  });

  it('3 — Mitarbeitende sehen nur eigene Unterweisungen', async () => {
    await assignMandatoryComplianceForEmployee(TENANT, EMPLOYEE_ID, EMPLOYEE, ADMIN);
    await assignMandatoryComplianceForEmployee(TENANT, OTHER_EMPLOYEE, 'caregiver', ADMIN);

    const own = await fetchEmployeeComplianceAssignments(TENANT, EMPLOYEE_ID, EMPLOYEE, EMPLOYEE_ID);
    const otherAttempt = await fetchEmployeeComplianceAssignments(
      TENANT,
      OTHER_EMPLOYEE,
      EMPLOYEE,
      EMPLOYEE_ID,
    );

    expect(own.ok).toBe(true);
    expect(otherAttempt.ok).toBe(false);
    if (own.ok) {
      expect(own.data.every((a) => a.employeeId === EMPLOYEE_ID)).toBe(true);
    }
  });

  it('4 — Admin sieht Unterweisungsstatus aller Mitarbeitenden', async () => {
    await assignMandatoryComplianceForEmployee(TENANT, EMPLOYEE_ID, 'caregiver', ADMIN);
    await assignMandatoryComplianceForEmployee(TENANT, OTHER_EMPLOYEE, 'nurse', ADMIN);

    const status = await fetchComplianceStatusForAdmin(TENANT, ADMIN);
    expect(status.ok).toBe(true);
    if (status.ok) {
      const employeeIds = new Set(status.data.map((r) => r.employeeId));
      expect(employeeIds.has(EMPLOYEE_ID)).toBe(true);
      expect(employeeIds.has(OTHER_EMPLOYEE)).toBe(true);
    }
  });

  it('5 — Bestätigung ohne Lesen des Dokuments wird abgelehnt', async () => {
    await assignMandatoryComplianceForEmployee(TENANT, EMPLOYEE_ID, EMPLOYEE, ADMIN);
    const assignments = listComplianceAssignmentsForTenant(TENANT, EMPLOYEE_ID);
    const assignment = assignments[0]!;

    const result = await acknowledgeComplianceTraining(
      {
        tenantId: TENANT,
        assignmentId: assignment.id,
        employeeId: EMPLOYEE_ID,
        signatureName: 'Maria Test',
        viewedDocument: false,
      },
      EMPLOYEE,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Nachweis');
    }
  });

  it('6 — Bestätigung ohne Signatur wird abgelehnt', async () => {
    await assignMandatoryComplianceForEmployee(TENANT, EMPLOYEE_ID, EMPLOYEE, ADMIN);
    const assignment = listComplianceAssignmentsForTenant(TENANT, EMPLOYEE_ID)[0]!;

    await markComplianceTrainingViewed(TENANT, assignment.id, EMPLOYEE_ID, EMPLOYEE);

    const result = await acknowledgeComplianceTraining(
      {
        tenantId: TENANT,
        assignmentId: assignment.id,
        employeeId: EMPLOYEE_ID,
        signatureName: '',
        viewedDocument: true,
      },
      EMPLOYEE,
    );

    expect(result.ok).toBe(false);
  });

  it('7 — Einsatzfähigkeit blockiert bei fehlender Pflichtunterweisung', async () => {
    await assignMandatoryComplianceForEmployee(TENANT, EMPLOYEE_ID, 'caregiver', ADMIN);

    const compliance = evaluateComplianceDeployability(TENANT, EMPLOYEE_ID, 'caregiver');
    expect(compliance.ok).toBe(false);
    expect(compliance.blockers.length).toBeGreaterThan(0);

    const file = getDemoEmployeePersonnelFile(EMPLOYEE_ID);
    expect(file).not.toBeNull();
    if (!file) return;

    const deployability = evaluateEmployeeDeployability({
      employment: file.employment,
      portalAccess: file.portalAccess,
      qualifications: file.qualifications,
      backgroundCheck: file.backgroundCheck,
      documents: file.documents,
      roleTitle: file.masterData.roleTitle,
      backgroundCheckRequired: true,
      portalRequired: false,
      tenantId: TENANT,
      employeeId: EMPLOYEE_ID,
      roleKey: 'caregiver',
    });

    expect(deployability.result).toBe('warning');
    expect(
      deployability.warnings.some((issue) => issue.code === 'compliance_training_missing'),
    ).toBe(true);
    expect(isEmployeeAssignable(deployability)).toBe(true);
  });

  it('8 — Einsatzfähigkeit frei wenn Pflichtunterweisungen bestätigt', async () => {
    await assignMandatoryComplianceForEmployee(TENANT, EMPLOYEE_ID, EMPLOYEE, ADMIN);

    for (const assignment of listComplianceAssignmentsForTenant(TENANT, EMPLOYEE_ID)) {
      await markComplianceTrainingViewed(TENANT, assignment.id, EMPLOYEE_ID, EMPLOYEE);
      const item = await seedDefaultComplianceItemsForTenant(TENANT, ADMIN);
      const requiresQuiz = item.ok && item.data.find((i) => i.id === assignment.trainingItemId)?.requiresQuiz;

      await acknowledgeComplianceTraining(
        {
          tenantId: TENANT,
          assignmentId: assignment.id,
          employeeId: EMPLOYEE_ID,
          signatureName: 'Maria Test',
          viewedDocument: true,
          quizScore: requiresQuiz ? 90 : null,
        },
        EMPLOYEE,
      );
    }

    const compliance = evaluateComplianceDeployability(TENANT, EMPLOYEE_ID, EMPLOYEE);
    expect(compliance.ok).toBe(true);
  });

  it('9 — Klient:innenportal sieht keine Unterweisungsdaten', async () => {
    const clientCtx = buildComplianceAccessContext({
      tenantId: TENANT,
      roleKey: 'client_portal',
    });
    expect(canViewComplianceTrainingData(clientCtx).allowed).toBe(false);

    await assignMandatoryComplianceForEmployee(TENANT, EMPLOYEE_ID, EMPLOYEE, ADMIN);
    const assignments = listComplianceAssignmentsForTenant(TENANT, EMPLOYEE_ID);
    const filtered = filterComplianceAssignmentsForViewer(clientCtx, assignments);
    expect(filtered).toHaveLength(0);
  });

  it('10 — Nachweisexport und Audit bei Bestätigung', async () => {
    await assignMandatoryComplianceForEmployee(TENANT, EMPLOYEE_ID, EMPLOYEE, ADMIN);
    const assignment = listComplianceAssignmentsForTenant(TENANT, EMPLOYEE_ID)[0]!;

    await markComplianceTrainingViewed(TENANT, assignment.id, EMPLOYEE_ID, EMPLOYEE);
    const ack = await acknowledgeComplianceTraining(
      {
        tenantId: TENANT,
        assignmentId: assignment.id,
        employeeId: EMPLOYEE_ID,
        signatureName: 'Maria Test',
        viewedDocument: true,
      },
      EMPLOYEE,
    );

    expect(ack.ok).toBe(true);

    const proof = exportComplianceProof(TENANT, assignment.id);
    expect(proof.ok).toBe(true);
    if (proof.ok) {
      expect(proof.data.proofAvailable).toBe(true);
      expect(proof.data.signatureName).toBe('Maria Test');
    }
  });
});
