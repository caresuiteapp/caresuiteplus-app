import type { EmployeeAbsence } from '@/types/modules/employeeAbsence';
import type { ManagementTask } from '@/types/modules/liveMonitor';
import type {
  PersonalComplianceEmployeeRow,
  PersonalComplianceKpiKey,
  PersonalComplianceKpiTile,
  PersonalComplianceListFilter,
  PersonalComplianceRiskCode,
  PersonalComplianceRiskItem,
  PersonalComplianceSnapshot,
} from '@/types/modules/personalComplianceCockpit';
import { PERSONAL_COMPLIANCE_KPI_DATA_SOURCES, PERSONAL_COMPLIANCE_KPI_LABELS } from '@/types/modules/personalComplianceCockpit';
import type { QmCorrectionRequest } from '@/types/modules/qmCockpit';
import { demoEmployees } from '@/data/demo/employees';
import { getDemoEmployeePersonnelFile } from '@/data/demo/employeePersonnelFile';
import { PERSONAL_COMPLIANCE_REFERENCE_DATE } from '@/data/demo/personalComplianceCockpit';
import {
  ASSIGNABLE_EMPLOYMENT_STATUSES,
  getRequiredQualificationsForRole,
} from './employeePersonnelFieldRules';
import { computeBackgroundCheckStatus } from './employeeBackgroundCheckService';
import { computeQualificationStatus } from './employeeQualificationService';
import { evaluateEmployeeAssignmentEligibility } from './employeeAssignmentEligibility';
import {
  getComplianceItemById,
  listComplianceAssignmentsForTenant,
} from './complianceTrainingStore';
import {
  isComplianceAssignmentBlocking,
  resolveEffectiveComplianceStatus,
} from './complianceTrainingService';
import {
  listOffboardingSessionsForTenant,
  listPersonnelAbsencesForTenant,
  PERSONAL_COMPLIANCE_STORE,
  seedPersonalComplianceDemoStore,
} from './personalComplianceStore';
import { listAbsencesForTenant } from './absenceStore';
import { listCorrectionRequests } from '@/lib/assist/correctionRequestService';
import { listManagementTasks } from '@/lib/assist/managementTaskService';
import { seedTrainingDemoStore, TRAINING_STORE } from '@/lib/training/trainingStore';

const KPI_ACCENT: Record<PersonalComplianceKpiKey, string> = {
  active_employees: '#3b82f6',
  deployable: '#22c55e',
  not_deployable: '#ef4444',
  qualification_missing: '#f97316',
  qualification_expiring: '#eab308',
  background_check_missing: '#dc2626',
  background_check_expired: '#b91c1c',
  briefing_missing: '#8b5cf6',
  required_document_missing: '#64748b',
  return_open: '#06b6d4',
  offboarding_open: '#a855f7',
  sick_absent: '#f59e0b',
  open_corrections: '#ec4899',
  open_personnel_tasks: '#6366f1',
};

const OPEN_CORRECTION_STATUSES = new Set<QmCorrectionRequest['status']>([
  'open',
  'in_progress',
  'waiting_for_employee',
]);

const OPEN_TASK_STATUSES = new Set([
  'open',
  'in_progress',
  'waiting_for_employee',
  'waiting_for_management',
] as const);

const PERSONNEL_TASK_TYPES = new Set([
  'master_data_review',
  'missing_contract',
  'absence_replacement',
  'absence_conflict',
] as const);

const ACTIVE_ABSENCE_STATUSES = new Set<EmployeeAbsence['status']>(['approved', 'active']);

function isAbsenceActiveNow(absence: EmployeeAbsence, reference: Date): boolean {
  if (!ACTIVE_ABSENCE_STATUSES.has(absence.status)) return false;
  const start = new Date(absence.startsAt);
  const end = new Date(absence.endsAt);
  return reference >= start && reference <= end;
}

function mergeAbsences(tenantId: string): EmployeeAbsence[] {
  const runtime = listAbsencesForTenant(tenantId);
  const seeded = listPersonnelAbsencesForTenant(tenantId);
  const byId = new Map<string, EmployeeAbsence>();
  for (const row of [...seeded, ...runtime]) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

export type BuildPersonalComplianceInput = {
  tenantId: string;
  reference?: Date;
  ensureDemoSeed?: boolean;
};

export function buildPersonalComplianceSnapshot(
  input: BuildPersonalComplianceInput,
): PersonalComplianceSnapshot {
  const reference = input.reference ?? PERSONAL_COMPLIANCE_REFERENCE_DATE;
  const { tenantId } = input;

  if (input.ensureDemoSeed !== false) {
    if (TRAINING_STORE.courses.length === 0) seedTrainingDemoStore();
    if (PERSONAL_COMPLIANCE_STORE.offboardingSessions.length === 0) seedPersonalComplianceDemoStore();
  }

  const risks: PersonalComplianceRiskItem[] = [];
  const employees: PersonalComplianceEmployeeRow[] = [];

  let activeCount = 0;
  let deployableCount = 0;
  let notDeployableCount = 0;
  let qualificationMissingCount = 0;
  let qualificationExpiringCount = 0;
  let bgMissingCount = 0;
  let bgExpiredCount = 0;
  let briefingMissingCount = 0;
  let documentMissingCount = 0;
  let returnOpenCount = 0;
  let offboardingOpenCount = 0;

  const tenantEmployees = demoEmployees.filter((e) => e.tenantId === tenantId);
  const absences = mergeAbsences(tenantId);
  const offboardingSessions = listOffboardingSessionsForTenant(tenantId);
  const openCorrections = listCorrectionRequests(tenantId).filter((c) =>
    OPEN_CORRECTION_STATUSES.has(c.status),
  );
  const openPersonnelTasks = listManagementTasks(tenantId).filter(
    (t) =>
      OPEN_TASK_STATUSES.has(t.status) &&
      (PERSONNEL_TASK_TYPES.has(t.taskType) || Boolean(t.employeeId)),
  );

  const absentEmployeeIds = new Set(
    absences.filter((a) => isAbsenceActiveNow(a, reference)).map((a) => a.employeeId),
  );

  for (const employee of tenantEmployees) {
    const file = getDemoEmployeePersonnelFile(employee.id);
    if (!file || file.tenantId !== tenantId) continue;

    const fullName = `${file.masterData.firstName} ${file.masterData.lastName}`.trim();
    const isActive = ASSIGNABLE_EMPLOYMENT_STATUSES.has(file.employment.employmentStatus);
    if (isActive) activeCount += 1;

    const absent = absentEmployeeIds.has(employee.id);
    const eligibility = evaluateEmployeeAssignmentEligibility({
      tenantId,
      employeeId: employee.id,
      personnelFile: file,
      roleKey: file.portalAccess.roleKey,
      absent,
      blocked: employee.status === 'gesperrt',
      reference,
    });

    if (eligibility.deployable) deployableCount += 1;
    else if (isActive) notDeployableCount += 1;

    const employeeRisks: PersonalComplianceRiskItem[] = [];

    const requiredTypes = getRequiredQualificationsForRole(file.masterData.roleTitle);
    for (const type of requiredTypes) {
      const match = file.qualifications.find((q) => q.qualificationType === type);
      if (!match) {
        qualificationMissingCount += 1;
        employeeRisks.push({
          id: `risk-${employee.id}-qual-missing-${type}`,
          employeeId: employee.id,
          employeeName: fullName,
          roleTitle: file.masterData.roleTitle,
          code: 'qualification_missing',
          title: 'Qualifikation fehlt',
          message: `Erforderliche Qualifikation fehlt: ${type}.`,
          severity: 'critical',
          dataSource: 'employee_qualifications',
          relatedEntityId: null,
          dueAt: null,
          sensitive: false,
        });
        continue;
      }
      const status = computeQualificationStatus(match, reference);
      if (status === 'expired' || status === 'missing' || status === 'rejected') {
        qualificationMissingCount += 1;
        employeeRisks.push({
          id: `risk-${employee.id}-qual-expired-${type}`,
          employeeId: employee.id,
          employeeName: fullName,
          roleTitle: file.masterData.roleTitle,
          code: 'qualification_missing',
          title: 'Qualifikation ungültig',
          message: `${match.title} ist abgelaufen oder ungültig.`,
          severity: 'critical',
          dataSource: 'employee_qualifications',
          relatedEntityId: match.id,
          dueAt: match.validUntil,
          sensitive: false,
        });
      } else if (status === 'expires_soon') {
        qualificationExpiringCount += 1;
        employeeRisks.push({
          id: `risk-${employee.id}-qual-soon-${type}`,
          employeeId: employee.id,
          employeeName: fullName,
          roleTitle: file.masterData.roleTitle,
          code: 'qualification_expiring',
          title: 'Qualifikation läuft ab',
          message: `${match.title} läuft am ${match.validUntil?.slice(0, 10) ?? '?'} ab.`,
          severity: 'warning',
          dataSource: 'employee_qualifications',
          relatedEntityId: match.id,
          dueAt: match.validUntil,
          sensitive: false,
        });
      }
    }

    const bgStatus = computeBackgroundCheckStatus(file.backgroundCheck, reference);
    if (bgStatus === 'missing') {
      bgMissingCount += 1;
      employeeRisks.push({
        id: `risk-${employee.id}-bg-missing`,
        employeeId: employee.id,
        employeeName: fullName,
        roleTitle: file.masterData.roleTitle,
        code: 'background_check_missing',
        title: 'Führungszeugnis fehlt',
        message: 'Führungszeugnis fehlt oder nicht verifiziert.',
        severity: 'critical',
        dataSource: 'employee_background_checks',
        relatedEntityId: file.backgroundCheck.id,
        dueAt: null,
        sensitive: true,
      });
    } else if (bgStatus === 'expired') {
      bgExpiredCount += 1;
      employeeRisks.push({
        id: `risk-${employee.id}-bg-expired`,
        employeeId: employee.id,
        employeeName: fullName,
        roleTitle: file.masterData.roleTitle,
        code: 'background_check_expired',
        title: 'Führungszeugnis abgelaufen',
        message: 'Führungszeugnis ist abgelaufen.',
        severity: 'critical',
        dataSource: 'employee_background_checks',
        relatedEntityId: file.backgroundCheck.id,
        dueAt: file.backgroundCheck.followUpDueAt,
        sensitive: true,
      });
    }

    for (const assignment of listComplianceAssignmentsForTenant(tenantId, employee.id)) {
      const item = getComplianceItemById(tenantId, assignment.trainingItemId);
      if (!isComplianceAssignmentBlocking(assignment, item, reference)) continue;
      briefingMissingCount += 1;
      const status = resolveEffectiveComplianceStatus(assignment, item, reference);
      employeeRisks.push({
        id: `risk-${employee.id}-briefing-${assignment.id}`,
        employeeId: employee.id,
        employeeName: fullName,
        roleTitle: file.masterData.roleTitle,
        code: 'briefing_missing',
        title: 'Pflichtunterweisung offen',
        message: `Pflichtunterweisung „${item?.title ?? assignment.trainingItemId}" (${status}).`,
        severity: 'warning',
        dataSource: 'compliance_training',
        relatedEntityId: assignment.id,
        dueAt: assignment.dueAt,
        sensitive: false,
      });
    }

    for (const record of TRAINING_STORE.records.filter(
      (r) => r.tenantId === tenantId && r.employeeId === employee.id,
    )) {
      const course = TRAINING_STORE.courses.find((c) => c.id === record.courseId);
      if (!course?.isMandatory || course.trainingTypeGroup !== 'mandatory_briefing') continue;
      if (['passed', 'completed', 'waived', 'not_required'].includes(record.status)) continue;
      if (employeeRisks.some((r) => r.relatedEntityId === record.id && r.code === 'briefing_missing')) {
        continue;
      }
      briefingMissingCount += 1;
      employeeRisks.push({
        id: `risk-${employee.id}-tr-briefing-${record.id}`,
        employeeId: employee.id,
        employeeName: fullName,
        roleTitle: file.masterData.roleTitle,
        code: 'briefing_missing',
        title: 'Pflichtschulung offen',
        message: `Pflichtschulung „${course.title}" (${record.status}).`,
        severity: 'warning',
        dataSource: 'employee_training_records',
        relatedEntityId: record.id,
        dueAt: record.validUntil,
        sensitive: false,
      });
    }

    const missingDocs = file.documents.filter(
      (d) => (d.category === 'contract' || d.category === 'briefing') && !d.storagePath,
    );
    for (const doc of missingDocs) {
      documentMissingCount += 1;
      employeeRisks.push({
        id: `risk-${employee.id}-doc-${doc.id}`,
        employeeId: employee.id,
        employeeName: fullName,
        roleTitle: file.masterData.roleTitle,
        code: 'document_missing',
        title: 'Pflichtdokument fehlt',
        message: `${doc.title} fehlt in der Personalakte.`,
        severity: 'warning',
        dataSource: 'employee_documents',
        relatedEntityId: doc.id,
        dueAt: doc.validUntil,
        sensitive: doc.category === 'briefing',
      });
    }

    for (const material of file.workMaterials.filter((m) => m.status === 'return_pending')) {
      returnOpenCount += 1;
      employeeRisks.push({
        id: `risk-${employee.id}-return-${material.id}`,
        employeeId: employee.id,
        employeeName: fullName,
        roleTitle: file.masterData.roleTitle,
        code: 'return_open',
        title: 'Rückgabe offen',
        message: `${material.itemName} — Rückgabe ausstehend.`,
        severity: 'warning',
        dataSource: 'inventory_assignments',
        relatedEntityId: material.id,
        dueAt: material.returnDueAt,
        sensitive: false,
      });
    }

    if (absent) {
      const absence = absences.find(
        (a) => a.employeeId === employee.id && isAbsenceActiveNow(a, reference),
      );
      employeeRisks.push({
        id: `risk-${employee.id}-absent`,
        employeeId: employee.id,
        employeeName: fullName,
        roleTitle: file.masterData.roleTitle,
        code: 'absent',
        title: 'Abwesend',
        message: absence
          ? `Abwesenheit (${absence.absenceType}) bis ${absence.endsAt.slice(0, 10)}.`
          : 'Mitarbeitende:r ist abwesend.',
        severity: 'warning',
        dataSource: 'employee_absences',
        relatedEntityId: absence?.id ?? null,
        dueAt: absence?.endsAt ?? null,
        sensitive: absence?.absenceType === 'sick_leave',
      });
    }

    if (!eligibility.deployable && isActive) {
      employeeRisks.push({
        id: `risk-${employee.id}-not-deployable`,
        employeeId: employee.id,
        employeeName: fullName,
        roleTitle: file.masterData.roleTitle,
        code: 'not_deployable',
        title: 'Nicht einsatzfähig',
        message: eligibility.blockers[0] ?? 'Einsatzfähigkeit blockiert.',
        severity: 'critical',
        dataSource: 'employees',
        relatedEntityId: employee.id,
        dueAt: null,
        sensitive: false,
      });
    }

    risks.push(...employeeRisks);

    const criticalRiskCount = employeeRisks.filter((r) => r.severity === 'critical').length;
    employees.push({
      employeeId: employee.id,
      fullName,
      roleTitle: file.masterData.roleTitle,
      employmentStatus: file.employment.employmentStatus,
      deployable: eligibility.deployable,
      deployabilityResult: eligibility.result,
      riskCount: employeeRisks.length,
      criticalRiskCount,
      topRisks: employeeRisks.slice(0, 3).map((r) => r.title),
      personnelFileRoute: `/office/employees/${employee.id}`,
    });
  }

  for (const session of offboardingSessions) {
    offboardingOpenCount += 1;
    const file = getDemoEmployeePersonnelFile(session.employeeId);
    const fullName = file
      ? `${file.masterData.firstName} ${file.masterData.lastName}`.trim()
      : session.employeeId;
    risks.push({
      id: `risk-offboarding-${session.id}`,
      employeeId: session.employeeId,
      employeeName: fullName,
      roleTitle: file?.masterData.roleTitle ?? null,
      code: 'offboarding_open',
      title: 'Offboarding offen',
      message: `Offboarding (${session.overallStatus}) — Schritt ${session.currentStepKey}.`,
      severity: 'warning',
      dataSource: 'employee_offboarding_sessions',
      relatedEntityId: session.id,
      dueAt: session.exitDate,
      sensitive: false,
    });
  }

  for (const correction of openCorrections) {
    const file = getDemoEmployeePersonnelFile(correction.assignedToEmployeeId);
    const fullName = file
      ? `${file.masterData.firstName} ${file.masterData.lastName}`.trim()
      : correction.assignedToEmployeeId;
    risks.push({
      id: `risk-correction-${correction.id}`,
      employeeId: correction.assignedToEmployeeId,
      employeeName: fullName,
      roleTitle: file?.masterData.roleTitle ?? null,
      code: 'open_correction',
      title: 'Korrektur offen',
      message: correction.reason,
      severity: 'warning',
      dataSource: 'management_tasks',
      relatedEntityId: correction.id,
      dueAt: correction.dueAt,
      sensitive: false,
    });
  }

  for (const task of openPersonnelTasks) {
    if (!task.employeeId) continue;
    const file = getDemoEmployeePersonnelFile(task.employeeId);
    const fullName = file
      ? `${file.masterData.firstName} ${file.masterData.lastName}`.trim()
      : task.employeeId;
    risks.push({
      id: `risk-task-${task.id}`,
      employeeId: task.employeeId,
      employeeName: fullName,
      roleTitle: file?.masterData.roleTitle ?? null,
      code: 'personnel_task',
      title: task.title,
      message: task.description,
      severity: task.priority === 'critical' ? 'critical' : 'info',
      dataSource: 'management_tasks',
      relatedEntityId: task.id,
      dueAt: task.dueAt,
      sensitive: false,
    });
  }

  const sickAbsentCount = absentEmployeeIds.size;

  const kpiValues: Record<PersonalComplianceKpiKey, number> = {
    active_employees: activeCount,
    deployable: deployableCount,
    not_deployable: notDeployableCount,
    qualification_missing: qualificationMissingCount,
    qualification_expiring: qualificationExpiringCount,
    background_check_missing: bgMissingCount,
    background_check_expired: bgExpiredCount,
    briefing_missing: briefingMissingCount,
    required_document_missing: documentMissingCount,
    return_open: returnOpenCount,
    offboarding_open: offboardingOpenCount,
    sick_absent: sickAbsentCount,
    open_corrections: openCorrections.length,
    open_personnel_tasks: openPersonnelTasks.length,
  };

  const kpis: PersonalComplianceKpiTile[] = (Object.keys(kpiValues) as PersonalComplianceKpiKey[]).map(
    (key) => ({
      key,
      label: PERSONAL_COMPLIANCE_KPI_LABELS[key],
      value: kpiValues[key],
      dataSource: PERSONAL_COMPLIANCE_KPI_DATA_SOURCES[key],
      accentColor: KPI_ACCENT[key],
      drilldownFilter: { kpiKey: key },
    }),
  );

  return {
    tenantId,
    generatedAt: reference.toISOString(),
    kpis,
    risks,
    employees,
    preparedOnly: false,
    availableDataSources: [
      'employees',
      'employee_qualifications',
      'employee_background_checks',
      'employee_training_records',
      'compliance_training',
      'employee_absences',
      'inventory_assignments',
      'employee_documents',
      'employee_offboarding_sessions',
      'management_tasks',
    ],
  };
}

export function filterPersonalComplianceSnapshot(
  snapshot: PersonalComplianceSnapshot,
  filter?: PersonalComplianceListFilter,
): PersonalComplianceSnapshot {
  if (!filter) return snapshot;

  let risks = snapshot.risks;
  let employees = snapshot.employees;

  if (filter.kpiKey) {
    const kpiToRisk: Partial<Record<PersonalComplianceKpiKey, PersonalComplianceRiskCode[]>> = {
      qualification_missing: ['qualification_missing'],
      qualification_expiring: ['qualification_expiring'],
      background_check_missing: ['background_check_missing'],
      background_check_expired: ['background_check_expired'],
      briefing_missing: ['briefing_missing'],
      required_document_missing: ['document_missing'],
      return_open: ['return_open'],
      offboarding_open: ['offboarding_open'],
      sick_absent: ['absent'],
      not_deployable: ['not_deployable'],
      open_corrections: ['open_correction'],
      open_personnel_tasks: ['personnel_task'],
      deployable: [],
      active_employees: [],
    };
    const codes = kpiToRisk[filter.kpiKey];
    if (codes && codes.length > 0) {
      risks = risks.filter((r) => codes.includes(r.code));
      const ids = new Set(risks.map((r) => r.employeeId));
      employees = employees.filter((e) => ids.has(e.employeeId));
    }
    if (filter.kpiKey === 'deployable') {
      employees = employees.filter((e) => e.deployable);
      const ids = new Set(employees.map((e) => e.employeeId));
      risks = risks.filter((r) => ids.has(r.employeeId));
    }
    if (filter.kpiKey === 'not_deployable') {
      employees = employees.filter((e) => !e.deployable);
      const ids = new Set(employees.map((e) => e.employeeId));
      risks = risks.filter((r) => ids.has(r.employeeId));
    }
    if (filter.kpiKey === 'active_employees') {
      employees = employees.filter((e) =>
        ASSIGNABLE_EMPLOYMENT_STATUSES.has(e.employmentStatus),
      );
    }
  }

  if (filter.riskCode) {
    risks = risks.filter((r) => r.code === filter.riskCode);
    const ids = new Set(risks.map((r) => r.employeeId));
    employees = employees.filter((e) => ids.has(e.employeeId));
  }

  if (filter.employmentStatus) {
    employees = employees.filter((e) => e.employmentStatus === filter.employmentStatus);
    const ids = new Set(employees.map((e) => e.employeeId));
    risks = risks.filter((r) => ids.has(r.employeeId));
  }

  if (filter.deployable != null) {
    employees = employees.filter((e) => e.deployable === filter.deployable);
    const ids = new Set(employees.map((e) => e.employeeId));
    risks = risks.filter((r) => ids.has(r.employeeId));
  }

  if (filter.roleTitle?.trim()) {
    const q = filter.roleTitle.trim().toLowerCase();
    employees = employees.filter((e) => e.roleTitle?.toLowerCase().includes(q));
    const ids = new Set(employees.map((e) => e.employeeId));
    risks = risks.filter((r) => ids.has(r.employeeId));
  }

  if (filter.search?.trim()) {
    const q = filter.search.trim().toLowerCase();
    employees = employees.filter(
      (e) => e.fullName.toLowerCase().includes(q) || e.roleTitle?.toLowerCase().includes(q),
    );
    risks = risks.filter(
      (r) => r.employeeName.toLowerCase().includes(q) || r.title.toLowerCase().includes(q),
    );
  }

  return { ...snapshot, risks, employees };
}

export function emptyPersonalComplianceSnapshot(tenantId: string): PersonalComplianceSnapshot {
  return {
    tenantId,
    generatedAt: new Date().toISOString(),
    kpis: [],
    risks: [],
    employees: [],
    preparedOnly: true,
    availableDataSources: [],
  };
}
