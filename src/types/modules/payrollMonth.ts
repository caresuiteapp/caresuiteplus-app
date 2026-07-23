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

export type PayrollStatementSnapshot = {
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
  assignmentId?: string | null;
  clientId?: string | null;
};
