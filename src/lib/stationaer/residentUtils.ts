import type { WorkflowStatus } from '@/types/workflow/status';

export function isResidentActive(status: WorkflowStatus): boolean {
  return status === 'aktiv' || status === 'in_bearbeitung';
}

export function isNewAdmission(admissionDate: string): boolean {
  const admitted = new Date(admissionDate);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  return admitted >= thirtyDaysAgo;
}
