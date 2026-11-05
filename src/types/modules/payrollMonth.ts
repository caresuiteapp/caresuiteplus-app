export type PayrollStatementStatus =
  | 'draft'
  | 'published'
  | 'confirmed'
  | 'rejected'
  | 'superseded'
  | 'locked'
  | 'paid';

export type ExpenseClaimStatus =
  | 'draft'
  | 'submitted'
  | 'needs_info'
  | 'approved'
  | 'partially_approved'
  | 'rejected'
  | 'reimbursed';

export type ExpenseCategory =
  | 'receipt'
  | 'mileage'
  | 'public_transport'
  | 'rail'
  | 'taxi'
  | 'parking'
  | 'toll'
  | 'accommodation'
  | 'meals'
  | 'client_purchase'
  | 'work_equipment'
  | 'postage'
  | 'communication'
  | 'training'
  | 'other';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  receipt: 'Barauslage / Quittung',
  mileage: 'Kilometerpauschale',
  public_transport: 'ÖPNV-Ticket',
  rail: 'Bahnfahrt',
  taxi: 'Taxi / Mietwagen / Carsharing',
  parking: 'Parkkosten',
  toll: 'Maut / Fähre',
  accommodation: 'Übernachtung',
  meals: 'Verpflegung',
  client_purchase: 'Einkauf für Klient:in',
  work_equipment: 'Arbeitsmittel / Verbrauchsmaterial',
  postage: 'Porto / Versand / Kopien',
  communication: 'Telefon / Internet / Kommunikation',
  training: 'Fortbildung / Teilnahmegebühr',
  other: 'Sonstige Auslage',
};

export type PayrollExpenseClaim = {
  id: string;
  tenantId: string;
  employeeId: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amountCents: number;
  approvedAmountCents: number | null;
  currency: string;
  assignmentId: string | null;
  clientId: string | null;
  paymentMethod: string | null;
  receiptNumber: string | null;
  receiptPath: string | null;
  mileageKm: number | null;
  mileageRateCents: number | null;
  origin: string | null;
  destination: string | null;
  vehicleLabel: string | null;
  drivingLogId?: string | null;
  travelType?: import('./travelCompensation').TravelRouteType | null;
  automaticSource?: boolean;
  businessPurpose: string;
  taxTreatment: 'reimbursement' | 'taxable' | 'review';
  status: ExpenseClaimStatus;
  officeNote: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PayrollAssignmentTimeLine = {
  entryKey?: string;
  payrollDisposition?: 'included' | 'deferred';
  assignmentId: string | null;
  workDate: string;
  clientLabel: string | null;
  assignmentTitle: string;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  plannedMinutes: number;
  actualMinutes: number;
  travelMinutes: number;
  differenceMinutes: number;
  status: string | null;
};

/** Persisted in the published snapshot so a skipped source can be settled once. */
export type PayrollDeferredTimeEntry = {
  key: string;
  entryId: string;
  originYear: number;
  originMonth: number;
  workDate: string;
  assignmentId: string | null;
  visitId: string | null;
  sessionId: string | null;
  plannedStartAt: string | null;
  clientLabel: string | null;
  assignmentTitle: string;
  reason: 'missing' | 'incomplete' | 'unapproved' | 'rejected' | 'deferred';
};
export type PayrollCatchUpTimeEntry = PayrollDeferredTimeEntry & {
  acceptanceId?: string;
  sourceEntryId: string;
  minutes: number;
  travelMinutes: number;
  actualStartAt: string;
  actualEndAt: string;
  reviewedAt: string | null;
};

export type PayrollTimeAcceptance = {
  id: string; employeeId: string; deferredKey: string; targetYear: number; targetMonth: number;
  reviewId: string; reviewUpdatedAt: string; updatedAt: string;
  entry: import('./wfmOfficeTimekeeping').WfmOfficeTimeEntry;
};
export type PayrollTimeAcceptanceOption = {
  item: PayrollDeferredTimeEntry;
  entry: import('./wfmOfficeTimekeeping').WfmOfficeTimeEntry | null;
  reviewId: string | null; reviewUpdatedAt: string | null;
  acceptance: PayrollTimeAcceptance | null;
  currentBlock: string | null; nextBlock: string | null;
};

export type PayrollNextMonthPreview = {
  periodYear: number;
  periodMonth: number;
  totalPlannedMinutes: number;
  assignments: PayrollAssignmentTimeLine[];
};

export type PayrollStatementSnapshot = {
  currentPeriodWorkMinutes?: number;
  catchUpWorkMinutes?: number;
  deferredTimeEntries?: PayrollDeferredTimeEntry[];
  catchUpTimeEntries?: PayrollCatchUpTimeEntry[];
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  periodYear: number;
  periodMonth: number;
  compensationType: 'salary' | 'hourly';
  hourlyRateCents: number;
  fixedSalaryCents: number;
  maxPayoutMinutes: number | null;
  actualWorkMinutes: number;
  travelMinutes: number;
  vacationMinutes: number;
  sickMinutes: number;
  otherPaidAbsenceMinutes: number;
  /** Vertragliches Soll des ausgewählten Monats. */
  targetWorkMinutes?: number;
  /** A payout comparison basis must not be presented as contractual working time. */
  targetWorkSource?: 'payout_limit';
  /** Arbeitszeit plus bezahlte Abwesenheiten. */
  creditedActualMinutes?: number;
  /** Anrechenbare Ist-Zeit abzüglich vertraglichem Soll. */
  targetActualDifferenceMinutes?: number;
  /** Gesamter Einsatzplan des ausgewählten Monats. */
  monthlyPlannedMinutes?: number;
  /** Noch ausstehende geplante Einsätze ab jetzt bis Monatsende. */
  plannedMinutes: number;
  payableMinutes: number;
  overtimeTransferMinutes: number;
  timeAccountBalanceMinutes: number;
  earnedGrossCents: number;
  projectedGrossCents: number;
  approvedExpensesCents: number;
  pendingExpensesCents: number;
  advancesCents: number;
  deductionsCents: number;
  payoutGrossCents: number;
  projectedTotalPayoutCents: number;
  generatedAt: string;
  expenseClaims: PayrollExpenseClaim[];
  /** Revisionsfeste Einsatz- und Zeiterfassungszeilen des Abrechnungsmonats. */
  assignmentTimeLines?: PayrollAssignmentTimeLine[];
  /** Vollständige Einsatzvorschau des unmittelbar folgenden Monats. */
  nextMonthPreview?: PayrollNextMonthPreview;
};

export type PayrollStatement = {
  id: string;
  tenantId: string;
  employeeId: string;
  periodYear: number;
  periodMonth: number;
  version: number;
  status: PayrollStatementStatus;
  snapshot: PayrollStatementSnapshot;
  pdfPath: string | null;
  pdfSha256: string | null;
  employeeDecisionReason: string | null;
  publishedAt: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PayrollEmployeeMonth = PayrollStatementSnapshot & {
  latestStatement: PayrollStatement | null;
  pendingPortalUploads: PayrollPortalUpload[];
};

export type PayrollPortalUpload = {
  id: string;
  employeeId: string;
  fileName: string;
  storagePath: string;
  category: string | null;
  status: 'hochgeladen' | 'wird_geprueft';
  createdAt: string;
};

export type PayrollMonthOverview = {
  periodYear: number;
  periodMonth: number;
  generatedAt: string;
  employees: PayrollEmployeeMonth[];
  totals: {
    earnedGrossCents: number;
    projectedGrossCents: number;
    approvedExpensesCents: number;
    plannedMinutes: number;
    overtimeTransferMinutes: number;
  };
};

export type CreateExpenseClaimInput = {
  tenantId: string;
  employeeId: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amountCents: number;
  businessPurpose: string;
  paymentMethod?: string | null;
  receiptNumber?: string | null;
  receiptPath?: string | null;
  mileageKm?: number | null;
  mileageRateCents?: number | null;
  origin?: string | null;
  destination?: string | null;
  vehicleLabel?: string | null;
  drivingLogId?: string | null;
  travelType?: import('./travelCompensation').TravelRouteType | null;
  assignmentId?: string | null;
  clientId?: string | null;
};
