import type { BatchStatus, ExchangeDraft } from './model';

export type RevisionSummary = {
  tenant_id: string; batch_id: string; revision: number; status: BatchStatus;
  draft_sha256: string; recorded_at: string; capture_kind: 'change' | 'backfill';
};
export type SavedRevision = RevisionSummary & { draft: ExchangeDraft };
