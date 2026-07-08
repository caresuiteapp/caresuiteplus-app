import type { WfmTimeReviewEntryKind, WfmTimeReviewStatus } from './wfmTimeReviewService';

export interface WfmTimeExportPayload {
  schemaVersion: 1;
  employeeId: string;
  referenceKey: string;
  referenceId: string | null;
  entryKind: WfmTimeReviewEntryKind;
  periodDate: string;
  minutesTotal: number;
  reviewStatus: WfmTimeReviewStatus;
  reviewId: string;
  display?: {
    employeeName?: string | null;
    entryLabel?: string | null;
  };
}

export interface BuildExportPayloadInput {
  reviewId: string;
  employeeId: string;
  referenceKey: string;
  referenceId: string | null;
  entryKind: WfmTimeReviewEntryKind;
  periodDate: string;
  minutesTotal: number;
  reviewStatus: WfmTimeReviewStatus;
  employeeName?: string | null;
  entryLabel?: string | null;
}

export function normalizeExportMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function normalizeExportEmployeeSnapshot(input: {
  employeeId: string;
  employeeName?: string | null;
}): { employeeId: string; employeeName: string | null } {
  return {
    employeeId: input.employeeId,
    employeeName: input.employeeName?.trim() || null,
  };
}

export function normalizeExportEntrySnapshot(input: {
  referenceKey: string;
  referenceId: string | null;
  entryKind: WfmTimeReviewEntryKind;
  periodDate: string;
  entryLabel?: string | null;
}): {
  referenceKey: string;
  referenceId: string | null;
  entryKind: WfmTimeReviewEntryKind;
  periodDate: string;
  entryLabel: string | null;
} {
  return {
    referenceKey: input.referenceKey.trim(),
    referenceId: input.referenceId,
    entryKind: input.entryKind,
    periodDate: input.periodDate,
    entryLabel: input.entryLabel?.trim() || null,
  };
}

export function buildExportPayloadForReview(input: BuildExportPayloadInput): WfmTimeExportPayload {
  const minutesTotal = normalizeExportMinutes(input.minutesTotal);
  const employee = normalizeExportEmployeeSnapshot({
    employeeId: input.employeeId,
    employeeName: input.employeeName,
  });
  const entry = normalizeExportEntrySnapshot({
    referenceKey: input.referenceKey,
    referenceId: input.referenceId,
    entryKind: input.entryKind,
    periodDate: input.periodDate,
    entryLabel: input.entryLabel,
  });

  if (!entry.referenceKey) {
    throw new Error('reference_key ist Pflicht für Export-Payload.');
  }

  const payload: WfmTimeExportPayload = {
    schemaVersion: 1,
    employeeId: employee.employeeId,
    referenceKey: entry.referenceKey,
    referenceId: entry.referenceId,
    entryKind: entry.entryKind,
    periodDate: entry.periodDate,
    minutesTotal,
    reviewStatus: input.reviewStatus,
    reviewId: input.reviewId,
  };

  if (employee.employeeName || entry.entryLabel) {
    payload.display = {
      employeeName: employee.employeeName,
      entryLabel: entry.entryLabel,
    };
  }

  return payload;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function calculateExportPayloadHash(payload: WfmTimeExportPayload): string {
  const normalized = buildExportPayloadForReview({
    reviewId: payload.reviewId,
    employeeId: payload.employeeId,
    referenceKey: payload.referenceKey,
    referenceId: payload.referenceId,
    entryKind: payload.entryKind,
    periodDate: payload.periodDate,
    minutesTotal: payload.minutesTotal,
    reviewStatus: payload.reviewStatus,
    employeeName: payload.display?.employeeName,
    entryLabel: payload.display?.entryLabel,
  });
  const content = stableStringify(normalized);
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
