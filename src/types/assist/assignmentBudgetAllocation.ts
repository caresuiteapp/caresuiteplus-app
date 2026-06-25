import type { EntityId } from '@/types/core/base';
import type { ClientAssistBillingProfile } from './clientAssistBilling';

export type BudgetAllocationLineStatus =
  | 'used'
  | 'partial'
  | 'not_needed'
  | 'blocked'
  | 'skipped';

export type BudgetAllocationProposalLine = {
  priorityOrder: number;
  catalogKey: string;
  budgetAccountId: EntityId | null;
  label: string;
  amountCents: number;
  status: BudgetAllocationLineStatus;
  reason: string;
};

export type ManualBudgetAllocationOverride = {
  catalogKey: string;
  amountCents: number;
  reason: string;
  approvedBy?: string | null;
  internalNote?: string | null;
};

export type AssistBudgetAllocationInput = {
  tenantId: string;
  clientId: string;
  assignmentDate: string;
  plannedStart: string;
  plannedEnd: string;
  plannedMinutes: number;
  hourlyRateCents: number;
  serviceType?: string | null;
  profile?: ClientAssistBillingProfile;
  manualOverride?: ManualBudgetAllocationOverride | null;
  actorRoleKey?: import('@/types').RoleKey | null;
};

export type AssistBudgetAllocationResult = {
  totalAmountCents: number;
  allocationProposal: BudgetAllocationProposalLine[];
  selfPayerAmountCents: number;
  statutoryAmountCents: number;
  primaryCatalogKey: string | null;
  warnings: string[];
  canSave: boolean;
  requiresManualApproval: boolean;
  auditRequired: boolean;
  hasSelfPayerAgreement: boolean;
};

export type AssignmentBudgetAllocationRow = {
  id: EntityId;
  tenantId: EntityId;
  assignmentId: EntityId;
  clientId: EntityId;
  budgetAccountId: EntityId | null;
  catalogKey: string;
  allocationStatus: string;
  plannedAmountCents: number;
  reservedAmountCents: number;
  finalAmountCents: number | null;
  priorityOrder: number;
  isManualOverride: boolean;
  overrideReason: string | null;
};

export const ALLOCATION_LINE_STATUS_LABELS: Record<BudgetAllocationLineStatus, string> = {
  used: 'wird verwendet',
  partial: 'teilweise',
  not_needed: 'nicht benötigt',
  blocked: 'blockiert',
  skipped: 'übersprungen',
};
