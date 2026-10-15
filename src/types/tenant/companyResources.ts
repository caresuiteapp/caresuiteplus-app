import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';

export type CompanyResourceScope = { tenantId: string; actorRoleKey: RoleKey | null; effectivePermissions?: readonly PermissionKey[] };
export type CompanyResourceResult<T> = { ok: true; data: T } | { ok: false; error: string; unavailable?: boolean; conflict?: boolean; reloadRequired?: boolean };
export type CompanyResourceKind = 'contract' | 'insurance' | 'vehicle' | 'allocation' | 'asset';
export type CompanyResourceStatus = 'draft' | 'active' | 'ended' | 'archived';
export type CompanyResourceBase = { id: string; tenantId: string; version: number; createdAt: string; updatedAt: string };
export type CompanyResourcePlacement = { entityId: string | null; siteId: string | null; departmentId: string | null };
export type CompanyPaymentInterval = 'once' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
export type CompanyContract = CompanyResourceBase & CompanyResourcePlacement & {
  title: string; contractType: string; counterparty: string; reference: string | null; status: CompanyResourceStatus;
  startsOn: string | null; endsOn: string | null; noticeOn: string | null; noticeRule: string | null;
  renewalRule: string | null; reviewOn: string | null; responsibleEmployeeId: string | null;
  costCents: number | null; paymentInterval: CompanyPaymentInterval; currency: 'EUR'; documentId: string | null; notes: string | null;
};
export type CompanyInsurancePolicy = CompanyResourceBase & CompanyResourcePlacement & {
  title: string; insuranceType: string; provider: string; policyNumber: string; status: CompanyResourceStatus;
  startsOn: string | null; endsOn: string | null; noticeOn: string | null; reviewOn: string | null;
  coverageCents: number | null; excessCents: number | null; premiumCents: number | null;
  paymentInterval: CompanyPaymentInterval; currency: 'EUR'; coverageDescription: string | null;
  contractId: string | null; responsibleEmployeeId: string | null; documentId: string | null; notes: string | null;
};
export type CompanyVehicle = CompanyResourceBase & CompanyResourcePlacement & {
  plate: string; vin: string | null; make: string | null; model: string | null; vehicleType: string;
  ownership: 'owned' | 'leased' | 'rented'; status: 'available' | 'maintenance' | 'unavailable' | 'archived';
  mileage: number; firstRegistrationOn: string | null; purchasedOn: string | null; leaseEndsOn: string | null;
  huDueOn: string | null; serviceDueOn: string | null; serviceDueMileage: number | null;
  insurancePolicyId: string | null; contractId: string | null; inventoryItemId: string | null;
  documentId: string | null; notes: string | null;
};
export type CompanyVehicleAllocation = CompanyResourceBase & {
  vehicleId: string; employeeId: string; startsAt: string; endsAt: string | null;
  status: 'planned' | 'active' | 'returned' | 'cancelled'; issueMileage: number; issueCondition: string;
  returnedAt: string | null; returnMileage: number | null; returnCondition: string | null; notes: string | null;
};
export type CompanyAssetLink = CompanyResourceBase & CompanyResourcePlacement & {
  inventoryItemId: string; vehicleId: string | null; status: 'active' | 'archived'; notes: string | null;
};
export type CompanyResourceInput<T extends CompanyResourceBase> = Omit<T, keyof CompanyResourceBase> & { id?: string; expectedVersion?: number };
export type CompanyContractInput = CompanyResourceInput<CompanyContract>;
export type CompanyInsuranceInput = CompanyResourceInput<CompanyInsurancePolicy>;
export type CompanyVehicleInput = CompanyResourceInput<CompanyVehicle>;
export type CompanyVehicleAllocationInput = Omit<CompanyResourceInput<CompanyVehicleAllocation>, 'returnedAt' | 'returnMileage' | 'returnCondition' | 'status'> & { status: 'planned' | 'active' | 'cancelled' };
export type CompanyAssetLinkInput = CompanyResourceInput<CompanyAssetLink>;
export type CompanyVehicleReturnInput = { id: string; expectedVersion: number; returnedAt: string; returnMileage: number; returnCondition: string; notes?: string | null };
export type CompanyResourceChoice = { id: string; label: string; status?: string; entityId?: string | null; siteId?: string | null; groupKey?: string | null };
export type CompanyResourceEmployee = { id: string; firstName: string; lastName: string; status: string };
export type CompanyLogbookVehicle = { id: string; employeeId: string; plate: string; make: string | null; model: string | null; active: boolean; ownership: string; companyVehicleId: string | null };
export type CompanyResourceAudit = { id: string; resourceKind: CompanyResourceKind; resourceId: string; action: string; actorId: string; createdAt: string; label: string };
export type CompanyResourcesSnapshot = {
  contracts: CompanyContract[]; policies: CompanyInsurancePolicy[]; vehicles: CompanyVehicle[];
  allocations: CompanyVehicleAllocation[]; assetLinks: CompanyAssetLink[]; employees: CompanyResourceEmployee[]; employeesVisible: boolean;
  entities: CompanyResourceChoice[]; sites: CompanyResourceChoice[]; departments: CompanyResourceChoice[];
  inventoryItems: CompanyResourceChoice[]; logbookVehicles: CompanyLogbookVehicle[]; documents: CompanyResourceChoice[];
  audit: CompanyResourceAudit[]; permissions: PermissionKey[]; scopeLimited: boolean; canManageScopes: boolean;
};
export type CompanyResourceDeadline = { id: string; resourceKind: 'contract' | 'insurance' | 'vehicle' | 'allocation'; resourceId: string; title: string; label: string; dueOn: string; overdue: boolean };
