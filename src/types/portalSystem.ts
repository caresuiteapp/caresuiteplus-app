import type { ClientPortalFeatureKey, ClientPortalSettingsResolved } from '@/types/clientCore';
import type { ClientPortalAssistVisitProof } from '@/types/assistExecutionPersistence';
import type {
  EmployeePortalAssignmentListItem,
  EmployeePortalOverview,
  EmployeePortalTaskItem,
} from '@/types/modules/employeePortalExecution';

/** Portal kind — client vs employee vs relative (Angehörige) vs office control. */
export type PortalKind = 'client' | 'employee' | 'relative';

/** Visibility matrix entry for a client portal feature. */
export type PortalFeatureVisibility = {
  featureKey: ClientPortalFeatureKey | string;
  label: string;
  visible: boolean;
  source: 'tenant' | 'client' | 'service' | 'blocked';
};

/** Client portal visibility matrix (Office is source of truth). */
export type ClientPortalVisibilityMatrix = {
  tenantId: string;
  clientId: string;
  portalEnabled: boolean;
  features: PortalFeatureVisibility[];
  blockedAlways: string[];
};

/** Sanitized client field keys allowed in employee portal for a visit. */
export type EmployeePortalClientFieldKey =
  | 'displayName'
  | 'street'
  | 'zip'
  | 'city'
  | 'phone'
  | 'accessHint'
  | 'emergencyContact';

/** Employee portal client slice for an assigned visit. */
export type EmployeePortalClientSlice = Partial<
  Record<EmployeePortalClientFieldKey, string | null>
>;

/** Client portal visit projection — no GPS / internal notes. */
export type ClientPortalVisitProjection = {
  id: string;
  title: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  statusLabel: string | null;
  serviceName: string | null;
};

/** Employee portal visit projection — assignment-scoped, limited client fields. */
export type EmployeePortalVisitProjection = {
  assignmentId: string;
  visitId: string | null;
  title: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: string;
  serviceName: string | null;
  client: EmployeePortalClientSlice;
  executionHref: string;
};

/** Client portal budget slice — no internal billing notes. */
export type ClientPortalBudgetProjection = {
  budgetYear: number | null;
  items: Array<{
    budgetTypeKey: string | null;
    budgetTypeName: string | null;
    allocatedCents: number;
    usedCents: number;
    reservedCents: number;
    remainingCents: number;
  }>;
};

/** Client portal dashboard projection. */
export type ClientPortalDashboardProjection = {
  nextVisits: ClientPortalVisitProjection[];
  recentProofs: ClientPortalAssistVisitProof[];
  documentCount: number;
  messageCount: number;
  budgetSummary: ClientPortalBudgetProjection | null;
  helpAvailable: boolean;
};

/** Employee portal dashboard projection. */
export type EmployeePortalDashboardProjection = {
  todayAssignments: EmployeePortalAssignmentListItem[];
  upcomingAssignments: EmployeePortalAssignmentListItem[];
  openTasks: EmployeePortalTaskItem[];
  openDocumentationCount: number;
  missingSignatureCount: number;
  openSignatureDocumentCount: number;
  overdueSignatureDocumentCount: number;
  messageCount: number;
};

/** Full client portal projection bundle. */
export type ClientPortalProjection = {
  tenantId: string;
  clientId: string;
  settings: ClientPortalSettingsResolved;
  visibility: ClientPortalVisibilityMatrix;
  dashboard: ClientPortalDashboardProjection;
};

/** Full employee portal projection bundle. */
export type EmployeePortalProjection = {
  tenantId: string;
  employeeId: string;
  overview: EmployeePortalOverview;
  assignedVisits: EmployeePortalVisitProjection[];
  dashboard: EmployeePortalDashboardProjection;
  blockedFields: string[];
};

/** Portal sync state for Office/Akte — visit/proof chain. */
export type PortalSyncState = {
  visitId: string;
  assignmentId: string | null;
  employeePortalStatus: string;
  assistProofStatus: string | null;
  officeReleaseStatus: string | null;
  clientPortalVisible: boolean;
  pdfAvailable: boolean;
  signatureComplete: boolean;
};

/** Employee portal impact summary for Office. */
export type EmployeePortalImpactSummary = {
  allowedClientFields: EmployeePortalClientFieldKey[];
  blockedClientFields: string[];
  showsBudget: false;
  showsInvoices: false;
  showsFullClientRecord: false;
  gpsTrackingEmployeePortalOnly: true;
};
