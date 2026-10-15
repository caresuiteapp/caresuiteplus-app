import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';

export type CompanyOrganizationStatus = 'active' | 'inactive' | 'archived';
export type CompanyOrganizationKind = 'entity' | 'site' | 'department' | 'placement' | 'relationship';
export type CompanyOrganizationView = 'sites' | 'departments' | 'entities' | 'relationships' | 'placements' | 'access';
export type CompanyOrganizationScope = { tenantId: string; actorRoleKey: RoleKey | null; actorProfileId?: string | null; effectivePermissions?: readonly PermissionKey[] };
export type CompanyOrganizationResult<T> = { ok: true; data: T } | { ok: false; error: string; conflict?: boolean; setupRequired?: boolean; reloadRequired?: boolean };
export type CompanyOrganizationRecord = { id: string; tenantId: string; version: number; status: CompanyOrganizationStatus; createdAt: string; updatedAt: string };
export type CompanyContactFields = { contactName: string | null; email: string | null; phone: string | null; notes: string | null };
export type CompanyAddressFields = { street: string | null; postalCode: string | null; city: string | null; country: string };
export type CompanyLegalEntity = CompanyOrganizationRecord & CompanyContactFields & CompanyAddressFields & {
  name: string; code: string | null; legalForm: string | null; registrationNumber: string | null; taxNumber: string | null;
  vatId: string | null; parentEntityId: string | null; website: string | null; leaderEmployeeId: string | null;
};
export type CompanySite = CompanyOrganizationRecord & CompanyContactFields & CompanyAddressFields & {
  name: string; code: string | null; entityId: string | null; kind: 'headquarters' | 'branch' | 'office' | 'service' | 'warehouse' | 'other';
  leaderEmployeeId: string | null; costCenterId: string | null; openingHours: string | null;
};
export type CompanyDepartment = CompanyOrganizationRecord & CompanyContactFields & {
  name: string; code: string | null; entityId: string | null; siteId: string | null; parentDepartmentId: string | null;
  leaderEmployeeId: string | null; costCenterId: string | null;
};
export type CompanyEmployeePlacement = CompanyOrganizationRecord & {
  employeeId: string; entityId: string | null; siteId: string | null; departmentId: string | null;
  roleTitle: string | null; startsOn: string; endsOn: string | null; isPrimary: boolean; allocationPercent: number | null; notes: string | null;
};
export type CompanyRelationship = CompanyOrganizationRecord & CompanyContactFields & {
  kind: 'subsidiary' | 'holding' | 'franchise' | 'cooperation'; entityId: string | null; partnerEntityId: string | null;
  partnerName: string; territory: string | null; ownershipPercent: number | null; startsOn: string | null; endsOn: string | null;
  contractReference: string | null; responsibilities: string | null;
};
export type CompanyOrganizationEmployee = { id: string; firstName: string; lastName: string; status: string };
export type CompanyCostCenter = { id: string; code: string; name: string; isActive: boolean };
export type CompanyOrganizationAudit = { id: string; kind: CompanyOrganizationKind; recordId: string; action: 'created' | 'updated' | 'archived' | 'restored'; actorId: string; createdAt: string; version: number };
export type CompanyOrganizationSnapshot = {
  entities: CompanyLegalEntity[]; sites: CompanySite[]; departments: CompanyDepartment[];
  placements: CompanyEmployeePlacement[]; relationships: CompanyRelationship[];
  employees: CompanyOrganizationEmployee[]; employeesVisible: boolean; costCenters: CompanyCostCenter[]; audit: CompanyOrganizationAudit[];
  permissions: CompanyOrganizationPermissions; scopeLimited: boolean; canManageEntities: boolean;
};
type Editable<T> = Omit<T, keyof CompanyOrganizationRecord> & { id?: string; expectedVersion?: number; status?: CompanyOrganizationStatus };
export type CompanyLegalEntityInput = Editable<CompanyLegalEntity>;
export type CompanySiteInput = Editable<CompanySite>;
export type CompanyDepartmentInput = Editable<CompanyDepartment>;
export type CompanyEmployeePlacementInput = Editable<CompanyEmployeePlacement>;
export type CompanyRelationshipInput = Editable<CompanyRelationship>;
export type CompanyOrganizationPermissions = { view: boolean; manage: boolean; viewEmployees: boolean; managePlacements: boolean };
