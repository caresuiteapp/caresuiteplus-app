import { getServiceMode } from '@/lib/services/mode';
import {
  BODYMAP_MEDICAL_CHECKLIST_VERSION,
  BODYMAP_MEDICAL_REVIEW_CRITERIA,
  createPendingMedicalReviewItems,
  getBodyMapMedicalCriteria,
} from '@/lib/pflege/bodyMap3d/medicalReviewCatalog';
import type {
  BodyMapMedicalReviewIssue,
  BodyMapMedicalReviewRun,
  BodyMapMedicalReviewStatus,
} from '@/types/platformConsole';
import { platformRpc } from './platformSupabaseClient';

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type RawOverview = { forbidden?: boolean; reviews?: Record<string, unknown>[] };

const now = () => new Date().toISOString();
let demoReviews: BodyMapMedicalReviewRun[] = [];

function mapItem(raw: Record<string, unknown>) {
  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    criterionId: String(raw.criterion_id ?? raw.criterionId ?? ''),
    category: String(raw.category ?? ''),
    result: (raw.result ?? 'pending') as BodyMapMedicalReviewRun['items'][number]['result'],
    notes: String(raw.notes ?? ''),
    evidence: Array.isArray(raw.evidence)
      ? (raw.evidence as Record<string, unknown>[])
      : [],
    updatedAt: typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
  };
}

function mapIssue(raw: Record<string, unknown>): BodyMapMedicalReviewIssue {
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    anatomicalZoneId:
      typeof (raw.anatomical_zone_id ?? raw.anatomicalZoneId) === 'string'
        ? String(raw.anatomical_zone_id ?? raw.anatomicalZoneId)
        : null,
    viewId: (raw.view_id ?? raw.viewId ?? null) as BodyMapMedicalReviewIssue['viewId'],
    severity: (raw.severity ?? 'minor') as BodyMapMedicalReviewIssue['severity'],
    status: (raw.status ?? 'open') as BodyMapMedicalReviewIssue['status'],
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    surfacePoint:
      (raw.surface_point ?? raw.surfacePoint ?? null) as BodyMapMedicalReviewIssue['surfacePoint'],
    evidence: Array.isArray(raw.evidence)
      ? (raw.evidence as Record<string, unknown>[])
      : [],
    resolution:
      typeof raw.resolution === 'string' ? raw.resolution : null,
    createdAt: String(raw.created_at ?? raw.createdAt ?? now()),
  };
}

function mapRun(raw: Record<string, unknown>): BodyMapMedicalReviewRun {
  return {
    id: String(raw.id),
    variantId: String(raw.variant_id ?? raw.variantId),
    assetPath: String(raw.asset_path ?? raw.assetPath),
    assetSha256: String(raw.asset_sha256 ?? raw.assetSha256),
    sourceCommitSha: String(raw.source_commit_sha ?? raw.sourceCommitSha),
    checklistVersion: Number(raw.checklist_version ?? raw.checklistVersion ?? 1),
    status: (raw.status ?? 'draft') as BodyMapMedicalReviewStatus,
    reviewerName: String(raw.reviewer_name ?? raw.reviewerName ?? ''),
    reviewerQualification: String(
      raw.reviewer_qualification ?? raw.reviewerQualification ?? '',
    ),
    reviewScope: String(raw.review_scope ?? raw.reviewScope ?? ''),
    decisionReason:
      typeof (raw.decision_reason ?? raw.decisionReason) === 'string'
        ? String(raw.decision_reason ?? raw.decisionReason)
        : null,
    items: Array.isArray(raw.items)
      ? (raw.items as Record<string, unknown>[]).map(mapItem)
      : [],
    issues: Array.isArray(raw.issues)
      ? (raw.issues as Record<string, unknown>[]).map(mapIssue)
      : [],
    startedAt: String(raw.started_at ?? raw.startedAt ?? now()),
    updatedAt: String(raw.updated_at ?? raw.updatedAt ?? now()),
    submittedAt:
      typeof (raw.submitted_at ?? raw.submittedAt) === 'string'
        ? String(raw.submitted_at ?? raw.submittedAt)
        : null,
    approvedAt:
      typeof (raw.approved_at ?? raw.approvedAt) === 'string'
        ? String(raw.approved_at ?? raw.approvedAt)
        : null,
    approvedBy:
      typeof (raw.approved_by ?? raw.approvedBy) === 'string'
        ? String(raw.approved_by ?? raw.approvedBy)
        : null,
  };
}

export async function listBodyMapMedicalReviews(): Promise<
  ServiceResult<BodyMapMedicalReviewRun[]>
> {
  if (getServiceMode() === 'demo') {
    return { ok: true, data: [...demoReviews] };
  }
  const { data, error } = await platformRpc<RawOverview>(
    'platform_bodymap_review_overview',
  );
  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? 'Bodymap-Prüfungen konnten nicht geladen werden.',
    };
  }
  if (data.forbidden) {
    return { ok: false, error: 'Keine Berechtigung für medizinische Bodymap-Prüfungen.' };
  }
  return { ok: true, data: (data.reviews ?? []).map(mapRun) };
}

export async function startBodyMapMedicalReview(input: {
  variantId: string;
  assetPath: string;
  assetSha256: string;
  sourceCommitSha: string;
  reviewerName: string;
  reviewerQualification: string;
  reviewScope: string;
}): Promise<ServiceResult<BodyMapMedicalReviewRun>> {
  const items = createPendingMedicalReviewItems(input.variantId);
  if (getServiceMode() === 'demo') {
    const timestamp = now();
    const run: BodyMapMedicalReviewRun = {
      id: crypto.randomUUID(),
      ...input,
      checklistVersion: BODYMAP_MEDICAL_CHECKLIST_VERSION,
      status: 'in_review',
      decisionReason: null,
      items,
      issues: [],
      startedAt: timestamp,
      updatedAt: timestamp,
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
    };
    demoReviews = [run, ...demoReviews];
    return { ok: true, data: run };
  }
  const { data, error } = await platformRpc<string>(
    'platform_bodymap_start_review',
    {
      p_variant_id: input.variantId,
      p_asset_path: input.assetPath,
      p_asset_sha256: input.assetSha256,
      p_source_commit_sha: input.sourceCommitSha,
      p_reviewer_name: input.reviewerName,
      p_reviewer_qualification: input.reviewerQualification,
      p_review_scope: input.reviewScope,
      p_checklist_version: BODYMAP_MEDICAL_CHECKLIST_VERSION,
      p_checklist_snapshot: BODYMAP_MEDICAL_REVIEW_CRITERIA.map(
        ({ appliesTo: _appliesTo, ...criterion }) => criterion,
      ),
      p_items: items,
    },
  );
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Prüfung konnte nicht gestartet werden.' };
  }
  return {
    ok: true,
    data: {
      id: data,
      ...input,
      checklistVersion: BODYMAP_MEDICAL_CHECKLIST_VERSION,
      status: 'in_review',
      decisionReason: null,
      items,
      issues: [],
      startedAt: now(),
      updatedAt: now(),
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
    },
  };
}

export async function saveBodyMapMedicalReview(
  run: BodyMapMedicalReviewRun,
  status: Extract<BodyMapMedicalReviewStatus, 'draft' | 'in_review' | 'changes_required'>,
  reason: string,
): Promise<ServiceResult<BodyMapMedicalReviewRun>> {
  const updated = { ...run, status, updatedAt: now() };
  if (getServiceMode() === 'demo') {
    demoReviews = demoReviews.map((item) => (item.id === run.id ? updated : item));
    return { ok: true, data: updated };
  }
  const { data, error } = await platformRpc<boolean>('platform_bodymap_save_review', {
    p_review_id: run.id,
    p_reviewer_name: run.reviewerName,
    p_reviewer_qualification: run.reviewerQualification,
    p_review_scope: run.reviewScope,
    p_status: status,
    p_items: run.items,
    p_issues: run.issues,
    p_reason: reason,
  });
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Prüfung konnte nicht gespeichert werden.' };
  }
  return { ok: true, data: updated };
}

export async function approveBodyMapMedicalReview(
  run: BodyMapMedicalReviewRun,
  currentAssetSha256: string,
  reason: string,
): Promise<ServiceResult<BodyMapMedicalReviewRun>> {
  const updated: BodyMapMedicalReviewRun = {
    ...run,
    status: 'approved',
    decisionReason: reason,
    approvedAt: now(),
    updatedAt: now(),
  };
  if (getServiceMode() === 'demo') {
    demoReviews = demoReviews.map((item) => (item.id === run.id ? updated : item));
    return { ok: true, data: updated };
  }
  const { data, error } = await platformRpc<boolean>(
    'platform_bodymap_approve_review',
    {
      p_review_id: run.id,
      p_expected_criteria: getBodyMapMedicalCriteria(run.variantId).length,
      p_current_asset_sha256: currentAssetSha256,
      p_reason: reason,
    },
  );
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Freigabe ist fehlgeschlagen.' };
  }
  return { ok: true, data: updated };
}

export async function revokeBodyMapMedicalReview(
  run: BodyMapMedicalReviewRun,
  reason: string,
): Promise<ServiceResult<BodyMapMedicalReviewRun>> {
  const updated: BodyMapMedicalReviewRun = {
    ...run,
    status: 'revoked',
    decisionReason: reason,
    updatedAt: now(),
  };
  if (getServiceMode() === 'demo') {
    demoReviews = demoReviews.map((item) => (item.id === run.id ? updated : item));
    return { ok: true, data: updated };
  }
  const { data, error } = await platformRpc<boolean>(
    'platform_bodymap_revoke_review',
    { p_review_id: run.id, p_reason: reason },
  );
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Freigabe konnte nicht widerrufen werden.' };
  }
  return { ok: true, data: updated };
}

export function resetDemoBodyMapMedicalReviews() {
  demoReviews = [];
}
