export type ClientFinancingDecision = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export type ClientFinancingApproval = {
  id: string;
  logicalApprovalId: string;
  tenantId: string;
  clientId: string;
  financingPathId: string;
  applicationReference: string;
  appliedOn: string;
  requestedFrom: string;
  requestedUntil: string | null;
  decision: ClientFinancingDecision;
  decisionReference: string | null;
  decidedOn: string | null;
  approvedFrom: string | null;
  approvedUntil: string | null;
  followUpDueOn: string | null;
  version: number;
  supersedesApprovalId: string | null;
  createdAt: string;
};

export type ClientFinancingApprovalIssue =
  | 'approval_identity_missing'
  | 'logical_identity_missing'
  | 'tenant_identity_missing'
  | 'client_identity_missing'
  | 'financing_path_identity_missing'
  | 'application_reference_missing'
  | 'application_date_invalid'
  | 'requested_period_invalid'
  | 'decision_invalid'
  | 'not_approved'
  | 'decision_reference_missing'
  | 'decision_date_invalid'
  | 'approved_period_invalid'
  | 'approval_not_started'
  | 'approval_expired'
  | 'follow_up_date_invalid'
  | 'version_invalid';

export type ClientFinancingApprovalAssessment = {
  approval: ClientFinancingApproval;
  state: 'approved_current' | 'pending' | 'not_current' | 'incomplete';
  issues: ClientFinancingApprovalIssue[];
  referenceDate: string;
  remainingDays: number | null;
  followUp: 'overdue' | 'due_soon' | 'not_due' | 'not_documented';
};

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year!, month! - 1, day!));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month! - 1
    && candidate.getUTCDate() === day;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function assessClientFinancingApproval(
  approval: ClientFinancingApproval,
  referenceDate: string,
  warningDays = 30,
): ClientFinancingApprovalAssessment {
  if (!isDate(referenceDate)) throw new Error('Der Prüftag muss ein gültiges Kalenderdatum sein.');
  if (!Number.isInteger(warningDays) || warningDays < 0) throw new Error('Die Warnfrist muss eine nicht negative ganze Zahl sein.');
  const issues: ClientFinancingApprovalIssue[] = [];
  if (!hasText(approval.id)) issues.push('approval_identity_missing');
  if (!hasText(approval.logicalApprovalId)) issues.push('logical_identity_missing');
  if (!hasText(approval.tenantId)) issues.push('tenant_identity_missing');
  if (!hasText(approval.clientId)) issues.push('client_identity_missing');
  if (!hasText(approval.financingPathId)) issues.push('financing_path_identity_missing');
  if (!hasText(approval.applicationReference)) issues.push('application_reference_missing');
  if (!isDate(approval.appliedOn)) issues.push('application_date_invalid');
  if (!isDate(approval.requestedFrom)
    || (approval.requestedUntil !== null && (!isDate(approval.requestedUntil) || approval.requestedUntil < approval.requestedFrom))) {
    issues.push('requested_period_invalid');
  }
  if (!['pending', 'approved', 'rejected', 'withdrawn'].includes(approval.decision)) {
    issues.push('decision_invalid');
  } else if (approval.decision !== 'approved') issues.push('not_approved');

  if (approval.decision !== 'pending' && ['approved', 'rejected', 'withdrawn'].includes(approval.decision)) {
    if (!hasText(approval.decisionReference)) issues.push('decision_reference_missing');
    if (!isDate(approval.decidedOn)) issues.push('decision_date_invalid');
  }
  if (approval.decision === 'approved') {
    if (!isDate(approval.approvedFrom)
      || !isDate(approval.approvedUntil)
      || approval.approvedUntil < approval.approvedFrom) {
      issues.push('approved_period_invalid');
    } else {
      if (approval.approvedFrom > referenceDate) issues.push('approval_not_started');
      if (approval.approvedUntil < referenceDate) issues.push('approval_expired');
    }
  }
  if (approval.followUpDueOn !== null && !isDate(approval.followUpDueOn)) issues.push('follow_up_date_invalid');
  if (!Number.isInteger(approval.version) || approval.version < 1) issues.push('version_invalid');

  const incomplete = issues.some((issue) => [
    'approval_identity_missing', 'logical_identity_missing', 'tenant_identity_missing',
    'client_identity_missing', 'financing_path_identity_missing', 'application_reference_missing',
    'application_date_invalid', 'requested_period_invalid', 'decision_invalid',
    'decision_reference_missing', 'decision_date_invalid', 'approved_period_invalid', 'version_invalid',
    'follow_up_date_invalid',
  ].includes(issue));
  const state = issues.length === 0
    ? 'approved_current'
    : incomplete
      ? 'incomplete'
      : approval.decision === 'pending'
        ? 'pending'
        : 'not_current';
  const remainingDays = approval.decision === 'approved' && isDate(approval.approvedUntil)
    ? daysBetween(referenceDate, approval.approvedUntil)
    : null;
  let followUp: ClientFinancingApprovalAssessment['followUp'] = 'not_documented';
  if (isDate(approval.followUpDueOn)) {
    const untilFollowUp = daysBetween(referenceDate, approval.followUpDueOn);
    followUp = untilFollowUp < 0 ? 'overdue' : untilFollowUp <= warningDays ? 'due_soon' : 'not_due';
  }
  return { approval, state, issues, referenceDate, remainingDays, followUp };
}

export function assessClientFinancingApprovals(
  approvals: readonly ClientFinancingApproval[],
  referenceDate: string,
  warningDays = 30,
): ClientFinancingApprovalAssessment[] {
  const ids = new Set<string>();
  for (const approval of approvals) {
    if (ids.has(approval.id)) throw new Error('Doppelte Genehmigungsidentität.');
    ids.add(approval.id);
  }
  return approvals.map((approval) => assessClientFinancingApproval(approval, referenceDate, warningDays));
}
