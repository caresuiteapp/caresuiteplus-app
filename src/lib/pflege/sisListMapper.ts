import type { ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { SisAssessment } from '@/types/modules/pflege';

/** Spalten aus assessment_runs (FlutterFlow-Basis) + optionale Joins. */
export const SIS_ASSESSMENT_SELECT_COLUMNS =
  'id, tenant_id, client_id, total_score, status, completed_at, started_at, updated_at, created_at, result_payload, clients(first_name, last_name), employees(first_name, last_name)';

export type SisAssessmentLiveRow = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  total_score: number | null;
  status: string;
  completed_at: string | null;
  started_at: string | null;
  updated_at: string;
  created_at: string;
  result_payload?: Record<string, unknown> | null;
  clients?: { first_name?: string | null; last_name?: string | null } | null;
  employees?: { first_name?: string | null; last_name?: string | null } | null;
};

function mapCatalogStatus(status: string): WorkflowStatus {
  switch (status) {
    case 'active':
      return 'aktiv';
    case 'draft':
      return 'entwurf';
    case 'archived':
    case 'deprecated':
      return 'archiviert';
    case 'disabled':
      return 'gesperrt';
    default:
      return 'in_bearbeitung';
  }
}

function readNextReviewAt(payload: Record<string, unknown> | null | undefined): string | null {
  const value = payload?.next_review_at ?? payload?.nextReviewAt;
  return typeof value === 'string' && value.trim() ? value : null;
}

function readClientName(row: SisAssessmentLiveRow): string {
  const first = row.clients?.first_name?.trim();
  const last = row.clients?.last_name?.trim();
  if (first || last) return [first, last].filter(Boolean).join(' ');
  return '—';
}

function readAssessorName(row: SisAssessmentLiveRow): string {
  const first = row.employees?.first_name?.trim();
  const last = row.employees?.last_name?.trim();
  if (first || last) return [first, last].filter(Boolean).join(' ');
  return '—';
}

export function mapSisAssessmentRow(row: SisAssessmentLiveRow): SisAssessment {
  const assessedAt = row.completed_at ?? row.started_at ?? row.created_at;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id ?? '',
    clientName: readClientName(row),
    assessedAt,
    overallScore: row.total_score ?? 0,
    status: mapCatalogStatus(row.status),
    nextReviewAt: readNextReviewAt(row.result_payload ?? null),
    assessorName: readAssessorName(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    visibility: 'team',
    sensitivity: 'care',
  };
}

export function mapSisAssessmentRows(rows: SisAssessmentLiveRow[]): ServiceResult<SisAssessment[]> {
  const data = rows.map(mapSisAssessmentRow).sort(
    (a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime(),
  );
  return { ok: true, data };
}
