import type { RoleKey } from '@/types/core/auth';
import type {
  EmployeeBackgroundCheckRecord,
  EmployeeBackgroundCheckStatus,
  EmployeeDocumentCategory,
  EmployeeDocumentRecord,
  EmployeeEmploymentDetails,
  EmployeeEmploymentStatus,
  EmployeeMasterData,
  EmployeePersonnelFile,
  EmployeePortalAccessRecord,
  EmployeeQualificationRecord,
  EmployeeQualificationStatus,
  EmployeeQualificationType,
} from '@/types/modules/employeePersonnelFile';
import { mapDbStatusToCatalogStatus } from './employeeStatusMapping';
import { evaluateEmployeeDeployability } from './employeeDeployabilityService';
import { ALL_EMPLOYEE_PERSONNEL_TABS } from './employeePersonnelFieldRules';
import { computeQualificationStatus } from './employeeQualificationService';

export type EmployeePersonnelLiveRow = {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  employee_number?: string | null;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  entry_date?: string | null;
  exit_date?: string | null;
  status: string;
  role_title?: string | null;
  employment_type?: string | null;
  weekly_hours?: number | null;
  portal_enabled?: boolean | null;
  profile_id?: string | null;
  has_police_clearance?: boolean | null;
  police_clearance_date?: string | null;
  police_clearance_valid_until?: string | null;
  has_first_aid_certificate?: boolean | null;
  first_aid_valid_until?: string | null;
  has_driver_license?: boolean | null;
  driver_license_class?: string | null;
  qualification?: string | null;
  qualification_notes?: string | null;
  internal_notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeDocumentLiveRow = {
  id: string;
  tenant_id: string;
  employee_id: string | null;
  title?: string | null;
  file_name: string;
  file_path?: string | null;
  visibility?: string | null;
  released_to_employee_portal?: boolean | null;
  created_at: string;
  updated_at: string;
};

export type EmployeePortalAccountLiveRow = {
  last_login_at?: string | null;
  first_login_completed?: boolean;
  status?: string | null;
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: 'Vollzeit',
  part_time: 'Teilzeit',
  mini_job: 'Minijob',
  freelancer: 'Freiberuflich',
  temporary: 'Befristet',
  intern: 'Praktikum',
  other: 'Sonstige',
};

function mapDbStatusToEmploymentStatus(status: string | null | undefined): EmployeeEmploymentStatus {
  switch (status?.trim().toLowerCase()) {
    case 'draft':
      return 'onboarding';
    case 'active':
      return 'active';
    case 'inactive':
      return 'archived';
    case 'sick':
      return 'sick_long_term';
    case 'vacation':
      return 'on_leave';
    case 'terminated':
      return 'terminated';
    case 'blocked':
      return 'suspended';
    default:
      return 'active';
  }
}

function resolveEmploymentTypeLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return EMPLOYMENT_TYPE_LABELS[value.trim()] ?? value.trim();
}

function resolveBackgroundCheckStatus(row: EmployeePersonnelLiveRow): EmployeeBackgroundCheckStatus {
  if (row.has_police_clearance) {
    if (row.police_clearance_valid_until) {
      const validUntil = new Date(row.police_clearance_valid_until);
      if (validUntil < new Date()) return 'expired';
    }
    return 'verified';
  }
  return 'missing';
}

function buildQualificationRecord(
  row: EmployeePersonnelLiveRow,
  suffix: string,
  qualificationType: EmployeeQualificationType,
  title: string,
  validUntil: string | null,
): EmployeeQualificationRecord {
  const base = {
    id: `${row.id}-${suffix}`,
    tenantId: row.tenant_id,
    employeeId: row.id,
    qualificationType,
    title,
    issuingOrganization: null,
    issuedAt: null,
    validUntil,
    documentId: null,
    verifiedBy: null,
    verifiedAt: row.updated_at,
    status: 'pending_review' as EmployeeQualificationStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return {
    ...base,
    status: computeQualificationStatus(base),
  };
}

export function buildQualificationsFromEmployeeRow(
  row: EmployeePersonnelLiveRow,
): EmployeeQualificationRecord[] {
  const qualifications: EmployeeQualificationRecord[] = [];

  if (row.has_first_aid_certificate) {
    qualifications.push(
      buildQualificationRecord(
        row,
        'first-aid',
        'first_aid',
        'Erste Hilfe',
        row.first_aid_valid_until ?? null,
      ),
    );
  }

  if (row.has_driver_license) {
    qualifications.push(
      buildQualificationRecord(
        row,
        'driver-license',
        'driving_license',
        row.driver_license_class?.trim()
          ? `Führerschein (${row.driver_license_class.trim()})`
          : 'Führerschein',
        null,
      ),
    );
  }

  if (row.qualification?.trim()) {
    qualifications.push(
      buildQualificationRecord(
        row,
        'primary-qualification',
        'nursing_qualification',
        row.qualification.trim(),
        null,
      ),
    );
  }

  return qualifications;
}

function mapDocumentCategory(_row: EmployeeDocumentLiveRow): EmployeeDocumentCategory {
  return 'other';
}

export function mapEmployeeDocumentsLiveRows(
  rows: EmployeeDocumentLiveRow[],
): EmployeeDocumentRecord[] {
  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id ?? '',
    category: mapDocumentCategory(row),
    title: row.title?.trim() || row.file_name,
    fileName: row.file_name,
    storagePath: row.file_path ?? null,
    sensitive: row.visibility === 'confidential' || row.visibility === 'internal_only',
    releasedToPortal: row.released_to_employee_portal ?? false,
    validUntil: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function buildEmployeePersonnelFileFromLiveRows(input: {
  employee: EmployeePersonnelLiveRow;
  documents?: EmployeeDocumentLiveRow[];
  portalAccount?: EmployeePortalAccountLiveRow | null;
}): EmployeePersonnelFile {
  const { employee: row } = input;
  const documents = mapEmployeeDocumentsLiveRows(input.documents ?? []);
  const qualifications = buildQualificationsFromEmployeeRow(row);
  const portalAccount = input.portalAccount;

  const masterData: EmployeeMasterData = {
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    dateOfBirth: row.date_of_birth ?? null,
    employeeNumber: row.employee_number ?? null,
    street: row.street ?? null,
    houseNumber: row.house_number ?? null,
    postalCode: row.postal_code ?? null,
    city: row.city ?? null,
    country: row.country ?? 'DE',
    phone: row.phone ?? null,
    mobile: row.mobile ?? null,
    email: row.email ?? null,
    emergencyContactName: row.emergency_contact_name ?? null,
    emergencyContactPhone: row.emergency_contact_phone ?? null,
    entryDate: row.entry_date ?? null,
    exitDate: row.exit_date ?? null,
    status: mapDbStatusToCatalogStatus(row.status),
    roleTitle: row.role_title ?? null,
    employmentType: resolveEmploymentTypeLabel(row.employment_type),
    weeklyHours: row.weekly_hours ?? null,
    costCenter: null,
  };

  const portalAccess: EmployeePortalAccessRecord = {
    profileId: row.profile_id ?? null,
    portalActive: row.portal_enabled === true && portalAccount?.status !== 'blocked',
    roleKey: null as RoleKey | null,
    lastLoginAt: portalAccount?.last_login_at ?? null,
    invitationSentAt: null,
    passwordConfigured: portalAccount?.first_login_completed ?? false,
    twoFactorPrepared: false,
  };

  const employment: EmployeeEmploymentDetails = {
    contractType: row.employment_type ?? null,
    probationEndsAt: null,
    fixedTermEndsAt: null,
    noticePeriodDays: null,
    weeklyHours: row.weekly_hours ?? null,
    deploymentArea: null,
    employmentStatus: mapDbStatusToEmploymentStatus(row.status),
  };

  const backgroundCheck: EmployeeBackgroundCheckRecord = {
    id: `${row.id}-background-check`,
    tenantId: row.tenant_id,
    employeeId: row.id,
    present: row.has_police_clearance === true,
    issueDate: row.police_clearance_date ?? null,
    verifiedAt: row.has_police_clearance ? row.police_clearance_date ?? null : null,
    verifiedBy: null,
    followUpDueAt: row.police_clearance_valid_until ?? null,
    status: resolveBackgroundCheckStatus(row),
    documentId: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  const deployability = evaluateEmployeeDeployability({
    employment,
    portalAccess,
    qualifications,
    backgroundCheck,
    documents,
    roleTitle: masterData.roleTitle,
    blocked: masterData.status === 'gesperrt',
    backgroundCheckRequired: true,
  });

  return {
    employeeId: row.id,
    tenantId: row.tenant_id,
    masterData,
    portalAccess,
    employment,
    qualifications,
    backgroundCheck,
    documents,
    workMaterials: [],
    deployability,
    auditEvents: [],
    tabs: ALL_EMPLOYEE_PERSONNEL_TABS,
  };
}

export function buildMasterDataLiveUpdatePayload(
  patch: Partial<EmployeeMasterData>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (patch.firstName !== undefined) out.first_name = patch.firstName.trim();
  if (patch.lastName !== undefined) out.last_name = patch.lastName.trim();
  if (patch.dateOfBirth !== undefined) out.date_of_birth = patch.dateOfBirth;
  if (patch.employeeNumber !== undefined) out.employee_number = patch.employeeNumber?.trim() || null;
  if (patch.street !== undefined) out.street = patch.street?.trim() || null;
  if (patch.houseNumber !== undefined) out.house_number = patch.houseNumber?.trim() || null;
  if (patch.postalCode !== undefined) out.postal_code = patch.postalCode?.trim() || null;
  if (patch.city !== undefined) out.city = patch.city?.trim() || null;
  if (patch.country !== undefined) out.country = patch.country?.trim() || null;
  if (patch.phone !== undefined) out.phone = patch.phone?.trim() || null;
  if (patch.mobile !== undefined) out.mobile = patch.mobile?.trim() || null;
  if (patch.email !== undefined) out.email = patch.email?.trim() || null;
  if (patch.emergencyContactName !== undefined) {
    out.emergency_contact_name = patch.emergencyContactName?.trim() || null;
  }
  if (patch.emergencyContactPhone !== undefined) {
    out.emergency_contact_phone = patch.emergencyContactPhone?.trim() || null;
  }
  if (patch.entryDate !== undefined) out.entry_date = patch.entryDate;
  if (patch.exitDate !== undefined) out.exit_date = patch.exitDate;
  if (patch.roleTitle !== undefined) out.role_title = patch.roleTitle?.trim() || null;
  if (patch.weeklyHours !== undefined) out.weekly_hours = patch.weeklyHours;

  return out;
}
