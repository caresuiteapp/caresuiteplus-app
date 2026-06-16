import type { RoleKey } from '@/types/core/auth';
import type { TenantScopedEntity } from '../core/base';

export type EmployeeEmploymentStatus =
  | 'applicant'
  | 'onboarding'
  | 'active'
  | 'paused'
  | 'sick_long_term'
  | 'on_leave'
  | 'suspended'
  | 'terminated'
  | 'archived';

export type EmployeeQualificationType =
  | 'nursing_qualification'
  | 'first_aid'
  | 'hygiene_training'
  | 'medication_administration'
  | 'dementia_care'
  | 'driving_license'
  | 'professional_development'
  | 'other';

export type EmployeeQualificationStatus =
  | 'valid'
  | 'expires_soon'
  | 'expired'
  | 'missing'
  | 'pending_review'
  | 'rejected';

export type EmployeeBackgroundCheckStatus =
  | 'not_required'
  | 'missing'
  | 'requested'
  | 'submitted'
  | 'verified'
  | 'expired'
  | 'rejected';

export type EmployeeDocumentCategory =
  | 'contract'
  | 'agreement'
  | 'privacy'
  | 'confidentiality'
  | 'briefing'
  | 'background_check'
  | 'qualification'
  | 'certificate'
  | 'warning'
  | 'termination'
  | 'handover_protocol'
  | 'return_protocol'
  | 'other';

export type EmployeeWorkMaterialStatus =
  | 'issued'
  | 'return_pending'
  | 'damaged'
  | 'lost'
  | 'returned';

export type EmployeeDeployabilityResult = 'assignable' | 'warning' | 'blocked';

export type EmployeePersonnelTabKey =
  | 'overview'
  | 'personnel_file'
  | 'master_data'
  | 'employment'
  | 'roles_permissions'
  | 'qualifications'
  | 'background_check'
  | 'documents'
  | 'deployability'
  | 'work_materials'
  | 'audit';

export type EmployeeMasterData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  employeeNumber: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  entryDate: string | null;
  exitDate: string | null;
  status: string;
  roleTitle: string | null;
  employmentType: string | null;
  weeklyHours: number | null;
  costCenter: string | null;
};

export type EmployeePortalAccessRecord = {
  profileId: string | null;
  portalActive: boolean;
  roleKey: RoleKey | null;
  lastLoginAt: string | null;
  invitationSentAt: string | null;
  passwordConfigured: boolean;
  twoFactorPrepared: boolean;
};

export type EmployeeEmploymentDetails = {
  contractType: string | null;
  probationEndsAt: string | null;
  fixedTermEndsAt: string | null;
  noticePeriodDays: number | null;
  weeklyHours: number | null;
  deploymentArea: string | null;
  employmentStatus: EmployeeEmploymentStatus;
};

export type EmployeeQualificationRecord = TenantScopedEntity & {
  employeeId: string;
  qualificationType: EmployeeQualificationType;
  title: string;
  issuingOrganization: string | null;
  issuedAt: string | null;
  validUntil: string | null;
  documentId: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  status: EmployeeQualificationStatus;
};

export type EmployeeBackgroundCheckRecord = TenantScopedEntity & {
  employeeId: string;
  present: boolean;
  issueDate: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  followUpDueAt: string | null;
  status: EmployeeBackgroundCheckStatus;
  documentId: string | null;
};

export type EmployeeDocumentRecord = TenantScopedEntity & {
  employeeId: string;
  category: EmployeeDocumentCategory;
  title: string;
  fileName: string;
  storagePath: string | null;
  sensitive: boolean;
  releasedToPortal: boolean;
  validUntil: string | null;
};

export type EmployeeWorkMaterialRecord = TenantScopedEntity & {
  employeeId: string;
  itemName: string;
  category: 'uniform' | 'equipment' | 'keys' | 'other';
  status: EmployeeWorkMaterialStatus;
  issuedAt: string | null;
  returnDueAt: string | null;
};

export type EmployeeDeployabilityCheck = {
  result: EmployeeDeployabilityResult;
  active: boolean;
  portalOk: boolean;
  qualificationOk: boolean;
  notAbsent: boolean;
  backgroundCheckOk: boolean;
  availabilityOk: boolean;
  noBlock: boolean;
  requiredDocsOk: boolean;
  warnings: EmployeeDeployabilityIssue[];
  blockers: EmployeeDeployabilityIssue[];
};

export type EmployeeDeployabilityIssue = {
  code: string;
  message: string;
  severity: 'warning' | 'error';
};

export type EmployeeAuditEvent = TenantScopedEntity & {
  employeeId: string;
  action: string;
  actorId: string | null;
  actorRole: RoleKey | null;
  summary: string;
  fieldChanges?: Record<string, { before: string | null; after: string | null }>;
};

export type EmployeePersonnelOverview = {
  employeeId: string;
  tenantId: string;
  fullName: string;
  roleTitle: string | null;
  employmentStatus: EmployeeEmploymentStatus;
  portalActive: boolean;
  qualificationStatus: EmployeeQualificationStatus | 'mixed';
  backgroundCheckStatus: EmployeeBackgroundCheckStatus;
  deployability: EmployeeDeployabilityResult;
  openTasks: string[];
  nextExpiryDates: Array<{ label: string; date: string; type: 'qualification' | 'background_check' | 'document' }>;
};

export type EmployeePersonnelFile = {
  employeeId: string;
  tenantId: string;
  masterData: EmployeeMasterData;
  portalAccess: EmployeePortalAccessRecord;
  employment: EmployeeEmploymentDetails;
  qualifications: EmployeeQualificationRecord[];
  backgroundCheck: EmployeeBackgroundCheckRecord;
  documents: EmployeeDocumentRecord[];
  workMaterials: EmployeeWorkMaterialRecord[];
  deployability: EmployeeDeployabilityCheck;
  auditEvents: EmployeeAuditEvent[];
  tabs: EmployeePersonnelTabKey[];
};
