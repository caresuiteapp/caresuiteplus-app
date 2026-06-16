import type {
  EmployeeBackgroundCheckRecord,
  EmployeeDocumentRecord,
  EmployeeEmploymentDetails,
  EmployeeMasterData,
  EmployeePersonnelFile,
  EmployeePortalAccessRecord,
  EmployeeQualificationRecord,
  EmployeeWorkMaterialRecord,
} from '@/types/modules/employeePersonnelFile';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { getDemoEmployeeDetail } from '@/data/demo/employeeDetails';
import { evaluateEmployeeDeployability } from '@/lib/office/employeeDeployabilityService';

const REFERENCE = new Date('2026-06-16T12:00:00.000Z');

function baseMasterData(employeeId: string): EmployeeMasterData {
  const detail = getDemoEmployeeDetail(employeeId);
  const map: Record<string, Partial<EmployeeMasterData>> = {
    'employee-001': {
      employeeNumber: 'MA-001',
      street: 'Hauptstraße',
      houseNumber: '12',
      postalCode: '10115',
      city: 'Berlin',
      mobile: '+49 170 1234567',
      entryDate: '2024-01-10',
      roleTitle: 'Alltagsbegleiter',
      employmentType: 'Teilzeit',
      weeklyHours: 30,
      costCenter: 'CC-AMB',
      emergencyContactName: 'Lisa Keller',
      emergencyContactPhone: '+49 170 9990001',
    },
    'employee-002': {
      employeeNumber: 'MA-002',
      street: 'Pflegeweg',
      houseNumber: '4',
      postalCode: '10117',
      city: 'Berlin',
      entryDate: '2023-06-01',
      roleTitle: 'Pflegefachkraft',
      employmentType: 'Vollzeit',
      weeklyHours: 38.5,
      costCenter: 'CC-PFL',
      emergencyContactName: 'Peter Krüger',
      emergencyContactPhone: '+49 170 9990002',
    },
    'employee-003': {
      employeeNumber: 'MA-003',
      entryDate: '2025-02-01',
      roleTitle: 'Betreuungskraft',
      employmentType: 'Minijob',
      weeklyHours: 10,
      costCenter: 'CC-BTR',
    },
    'employee-006': {
      employeeNumber: 'MA-006',
      entryDate: '2021-03-01',
      exitDate: '2026-05-01',
      roleTitle: 'Alltagsbegleiter',
      employmentType: 'Teilzeit',
      weeklyHours: 20,
      costCenter: 'CC-AMB',
    },
  };

  return {
    firstName: detail?.firstName ?? 'Unbekannt',
    lastName: detail?.lastName ?? 'Unbekannt',
    dateOfBirth: null,
    employeeNumber: null,
    street: null,
    houseNumber: null,
    postalCode: null,
    city: null,
    country: 'DE',
    phone: detail?.phone ?? null,
    mobile: null,
    email: detail?.email ?? null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    entryDate: detail?.startDate ?? null,
    exitDate: null,
    status: detail?.status ?? 'aktiv',
    roleTitle: detail?.jobTitle ?? null,
    employmentType: null,
    weeklyHours: null,
    costCenter: null,
    ...map[employeeId],
  };
}

function buildEmployment(employeeId: string): EmployeeEmploymentDetails {
  const statusMap: Record<string, EmployeeEmploymentDetails['employmentStatus']> = {
    'employee-001': 'active',
    'employee-002': 'active',
    'employee-003': 'onboarding',
    'employee-004': 'active',
    'employee-005': 'applicant',
    'employee-006': 'suspended',
  };

  return {
    contractType: employeeId === 'employee-003' ? 'befristet' : 'unbefristet',
    probationEndsAt: employeeId === 'employee-003' ? '2025-08-01' : null,
    fixedTermEndsAt: employeeId === 'employee-003' ? '2026-02-01' : null,
    noticePeriodDays: 28,
    weeklyHours: baseMasterData(employeeId).weeklyHours,
    deploymentArea: 'Ambulant Berlin',
    employmentStatus: statusMap[employeeId] ?? 'active',
  };
}

function buildPortalAccess(employeeId: string): EmployeePortalAccessRecord {
  const active = !['employee-005', 'employee-006'].includes(employeeId);
  return {
    profileId: active ? `profile-${employeeId}` : null,
    portalActive: active,
    roleKey: employeeId === 'employee-004' ? 'business_manager' : 'caregiver',
    lastLoginAt: active ? '2026-06-15T08:30:00.000Z' : null,
    invitationSentAt: active ? '2024-01-11T09:00:00.000Z' : null,
    passwordConfigured: active,
    twoFactorPrepared: false,
  };
}

function buildQualifications(employeeId: string): EmployeeQualificationRecord[] {
  const now = REFERENCE.toISOString();
  const common = (type: EmployeeQualificationRecord['qualificationType'], title: string, validUntil: string): EmployeeQualificationRecord => ({
    id: `${employeeId}-${type}`,
    tenantId: DEMO_TENANT_ID,
    employeeId,
    qualificationType: type,
    title,
    issuingOrganization: 'Demo Akademie',
    issuedAt: '2024-01-01',
    validUntil,
    documentId: `doc-${employeeId}-${type}`,
    verifiedBy: 'HR Admin',
    verifiedAt: '2024-01-05T10:00:00.000Z',
    status: 'valid',
    createdAt: now,
    updatedAt: now,
  });

  if (employeeId === 'employee-002') {
    return [
      common('nursing_qualification', 'Pflegefachkraft', '2027-12-31'),
      common('first_aid', 'Erste Hilfe', '2026-08-01'),
      common('hygiene_training', 'Hygiene', '2026-12-31'),
    ];
  }

  if (employeeId === 'employee-003') {
    return [
      {
        ...common('first_aid', 'Erste Hilfe', '2026-07-01'),
        status: 'expires_soon',
      },
      common('hygiene_training', 'Hygiene', '2026-12-31'),
    ];
  }

  if (employeeId === 'employee-006') {
    return [
      {
        ...common('first_aid', 'Erste Hilfe', '2025-01-01'),
        status: 'expired',
      },
    ];
  }

  return [common('first_aid', 'Erste Hilfe', '2027-06-01')];
}

function buildBackgroundCheck(employeeId: string): EmployeeBackgroundCheckRecord {
  const now = REFERENCE.toISOString();
  if (employeeId === 'employee-003') {
    return {
      id: `bg-${employeeId}`,
      tenantId: DEMO_TENANT_ID,
      employeeId,
      present: false,
      issueDate: null,
      verifiedAt: null,
      verifiedBy: null,
      followUpDueAt: null,
      status: 'missing',
      documentId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  if (employeeId === 'employee-006') {
    return {
      id: `bg-${employeeId}`,
      tenantId: DEMO_TENANT_ID,
      employeeId,
      present: true,
      issueDate: '2023-01-01',
      verifiedAt: '2023-01-10T10:00:00.000Z',
      verifiedBy: 'HR Admin',
      followUpDueAt: '2025-01-01',
      status: 'expired',
      documentId: `doc-bg-${employeeId}`,
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    id: `bg-${employeeId}`,
    tenantId: DEMO_TENANT_ID,
    employeeId,
    present: true,
    issueDate: '2025-01-15',
    verifiedAt: '2025-01-20T10:00:00.000Z',
    verifiedBy: 'HR Admin',
    followUpDueAt: '2027-01-15',
    status: 'verified',
    documentId: `doc-bg-${employeeId}`,
    createdAt: now,
    updatedAt: now,
  };
}

function buildDocuments(employeeId: string): EmployeeDocumentRecord[] {
  const now = REFERENCE.toISOString();
  return [
    {
      id: `doc-contract-${employeeId}`,
      tenantId: DEMO_TENANT_ID,
      employeeId,
      category: 'contract',
      title: 'Arbeitsvertrag',
      fileName: 'arbeitsvertrag.pdf',
      storagePath: employeeId === 'employee-005' ? null : `tenants/${DEMO_TENANT_ID}/employees/${employeeId}/contract.pdf`,
      sensitive: false,
      releasedToPortal: true,
      validUntil: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `doc-privacy-${employeeId}`,
      tenantId: DEMO_TENANT_ID,
      employeeId,
      category: 'privacy',
      title: 'Datenschutzhinweis',
      fileName: 'datenschutz.pdf',
      storagePath: `tenants/${DEMO_TENANT_ID}/employees/${employeeId}/privacy.pdf`,
      sensitive: false,
      releasedToPortal: true,
      validUntil: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `doc-bg-file-${employeeId}`,
      tenantId: DEMO_TENANT_ID,
      employeeId,
      category: 'background_check',
      title: 'Führungszeugnis',
      fileName: 'fuehrungszeugnis.pdf',
      storagePath: `tenants/${DEMO_TENANT_ID}/employees/${employeeId}/bg.pdf`,
      sensitive: true,
      releasedToPortal: false,
      validUntil: '2027-01-15',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function buildWorkMaterials(employeeId: string): EmployeeWorkMaterialRecord[] {
  const now = REFERENCE.toISOString();
  return [
    {
      id: `wm-uniform-${employeeId}`,
      tenantId: DEMO_TENANT_ID,
      employeeId,
      itemName: 'Dienstkleidung Set',
      category: 'uniform',
      status: employeeId === 'employee-006' ? 'return_pending' : 'issued',
      issuedAt: '2024-06-01',
      returnDueAt: employeeId === 'employee-006' ? '2026-05-15' : null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

const fileCache = new Map<string, EmployeePersonnelFile>();

export function getDemoEmployeePersonnelFile(employeeId: string): EmployeePersonnelFile | null {
  if (fileCache.has(employeeId)) return fileCache.get(employeeId)!;
  const detail = getDemoEmployeeDetail(employeeId);
  if (!detail) return null;

  const masterData = baseMasterData(employeeId);
  const employment = buildEmployment(employeeId);
  const portalAccess = buildPortalAccess(employeeId);
  const qualifications = buildQualifications(employeeId);
  const backgroundCheck = buildBackgroundCheck(employeeId);
  const documents = buildDocuments(employeeId);
  const workMaterials = buildWorkMaterials(employeeId);

  const deployability = evaluateEmployeeDeployability({
    employment,
    portalAccess,
    qualifications,
    backgroundCheck,
    documents,
    roleTitle: masterData.roleTitle,
    blocked: detail.status === 'gesperrt',
    absent: employment.employmentStatus === 'on_leave' || employment.employmentStatus === 'sick_long_term',
    backgroundCheckRequired: true,
    portalRequired: false,
  });

  const file: EmployeePersonnelFile = {
    employeeId,
    tenantId: DEMO_TENANT_ID,
    masterData,
    portalAccess,
    employment,
    qualifications,
    backgroundCheck,
    documents,
    workMaterials,
    deployability,
    auditEvents: [],
    tabs: [],
  };

  fileCache.set(employeeId, file);
  return file;
}

export function resetDemoEmployeePersonnelFileCache(): void {
  fileCache.clear();
}
