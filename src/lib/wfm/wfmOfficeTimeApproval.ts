import type { ServiceResult } from '@/types';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { resolveWfmOfficeTimeDisplay } from './wfmOfficeTimeDisplayResolver';

/** The quick approval only covers completed actual work, never planned time. */
export function canApproveWfmOfficeTimeEntry(entry: WfmOfficeTimeEntry): boolean {
  const display = resolveWfmOfficeTimeDisplay(entry);
  if (entry.canApprove === false || !display.canApprove || display.isPlannedOnly) return false;
  const start = Date.parse(display.displayStart ?? '');
  const end = Date.parse(display.displayEnd ?? '');
  return Number.isFinite(start) && Number.isFinite(end) && end > start && end <= Date.now();
}

export function selectedWfmApprovalEntries(
  entries: readonly WfmOfficeTimeEntry[],
  selectedIds: ReadonlySet<string>,
): WfmOfficeTimeEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id) || !selectedIds.has(entry.id) || !canApproveWfmOfficeTimeEntry(entry)) return false;
    seen.add(entry.id);
    return true;
  });
}

export type WfmApprovalOutcome = {
  approvedIds: string[];
  failed: { entry: WfmOfficeTimeEntry; error: string }[];
};

/** Keep partial successes explicit; each item uses the existing persisted review. */
export async function approveWfmOfficeTimeSelection(
  entries: readonly WfmOfficeTimeEntry[],
  approve: (entry: WfmOfficeTimeEntry) => Promise<ServiceResult<WfmOfficeTimeEntry>>,
  onProgress?: (done: number, total: number) => void,
): Promise<WfmApprovalOutcome> {
  const unique = [...new Map(entries.map((entry) => [entry.id, entry])).values()];
  const outcome: WfmApprovalOutcome = { approvedIds: [], failed: [] };
  for (const [index, entry] of unique.entries()) {
    try {
      if (!canApproveWfmOfficeTimeEntry(entry)) {
        outcome.failed.push({ entry, error: 'Dieser Eintrag ist nicht zur Genehmigung verfügbar. Bitte die Details prüfen.' });
      } else {
        const result = await approve(entry);
        if (result.ok && result.data.id === entry.id && result.data.reviewStatus === 'approved') {
          outcome.approvedIds.push(entry.id);
        } else {
          outcome.failed.push({ entry, error: result.ok ? 'Der Server hat die Genehmigung nicht bestätigt.' : result.error });
        }
      }
    } catch (error) {
      outcome.failed.push({ entry, error: error instanceof Error ? error.message : 'Die Genehmigung konnte nicht gespeichert werden.' });
    }
    onProgress?.(index + 1, unique.length);
  }
  return outcome;
}
