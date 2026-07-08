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

export interface WfmCorrectionExportPayload extends WfmTimeExportPayload {
  schemaVersion: 1;
  logicalReferenceKey: string;
  exportSequence: number;
  correctionReason: string;
}

export interface WfmCorrectionPayloadDelta {
  changedFields: string[];
  oldValues: Record<string, string | number | null>;
  newValues: Record<string, string | number | null>;
  deltaMinutes: number;
}

export interface WfmReviewVersionHashInput {
  reviewId: string;
  tenantId: string;
  employeeId: string;
  periodDate: string;
  entryKind: WfmTimeReviewEntryKind;
  minutesTotal: number;
  pauseMinutes?: number;
  referenceId: string | null;
  referenceKey: string;
  logicalReferenceKey: string;
  reviewStatus: WfmTimeReviewStatus;
  exportBlocking: boolean;
  approvedAt?: string | null;
  approvedBy?: string | null;
  sourceSessionId?: string | null;
  sourceKind?: string | null;
  employeeName?: string | null;
  entryLabel?: string | null;
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

export interface BuildCorrectionExportPayloadInput extends BuildExportPayloadInput {
  logicalReferenceKey: string;
  exportSequence: number;
  correctionReason: string;
}

export interface BuildCorrectionPayloadDeltaInput {
  oldPayload: WfmTimeExportPayload;
  newPayload: WfmCorrectionExportPayload;
}

export interface CorrectionCsvRowInput {
  exportKind: 'correction_delta';
  logicalReferenceKey: string;
  referenceKey: string;
  exportSequence: number;
  originalExportJobId: string;
  correctionExportJobId: string;
  originalExportItemId: string;
  newExportItemId: string;
  employeeId: string;
  employeeName?: string | null;
  entryKind: WfmTimeReviewEntryKind;
  periodDate: string;
  changedFields: string[];
  oldValues: Record<string, string | number | null>;
  newValues: Record<string, string | number | null>;
  deltaMinutes: number;
  correctionReason: string;
  finalizedAt: string;
  finalizedBy: string;
  payloadHash: string;
  previousPayloadHash: string;
}

export function buildLogicalReferenceKey(reviewId: string): string {
  return `review:${reviewId}`;
}

export function buildCorrectionReferenceKey(
  logicalReferenceKey: string,
  sequence: number,
): string {
  if (sequence <= 1) return logicalReferenceKey;
  return `${logicalReferenceKey}:correction:${sequence}`;
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

export function buildCorrectionExportPayload(
  input: BuildCorrectionExportPayloadInput,
): WfmCorrectionExportPayload {
  const base = buildExportPayloadForReview(input);
  return {
    ...base,
    referenceKey: buildCorrectionReferenceKey(input.logicalReferenceKey, input.exportSequence),
    logicalReferenceKey: input.logicalReferenceKey,
    exportSequence: input.exportSequence,
    correctionReason: input.correctionReason.trim(),
  };
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

function fnv1aHash(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
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
  return fnv1aHash(stableStringify(normalized));
}

export function buildReviewVersionHash(input: WfmReviewVersionHashInput): string {
  const normalized = {
    reviewId: input.reviewId,
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    periodDate: input.periodDate,
    entryKind: input.entryKind,
    minutesTotal: normalizeExportMinutes(input.minutesTotal),
    pauseMinutes: normalizeExportMinutes(input.pauseMinutes ?? 0),
    referenceId: input.referenceId,
    referenceKey: input.referenceKey.trim(),
    logicalReferenceKey: input.logicalReferenceKey,
    reviewStatus: input.reviewStatus,
    exportBlocking: input.exportBlocking,
    approvedAt: input.approvedAt ?? null,
    approvedBy: input.approvedBy ?? null,
    sourceSessionId: input.sourceSessionId ?? null,
    sourceKind: input.sourceKind ?? null,
    employeeName: input.employeeName?.trim() || null,
    entryLabel: input.entryLabel?.trim() || null,
  };
  return fnv1aHash(stableStringify(normalized));
}

export const calculateReviewVersionHash = buildReviewVersionHash;

const DELTA_FIELDS: Array<keyof WfmTimeExportPayload | 'logicalReferenceKey' | 'exportSequence'> = [
  'minutesTotal',
  'periodDate',
  'employeeId',
  'entryKind',
  'referenceId',
  'referenceKey',
  'reviewStatus',
];

export function buildCorrectionPayloadDelta(
  oldOrInput: WfmTimeExportPayload | BuildCorrectionPayloadDeltaInput,
  newPayload?: WfmTimeExportPayload | WfmCorrectionExportPayload,
): WfmCorrectionPayloadDelta {
  const input: BuildCorrectionPayloadDeltaInput =
    newPayload != null
      ? {
          oldPayload: oldOrInput as WfmTimeExportPayload,
          newPayload: newPayload as WfmCorrectionExportPayload,
        }
      : (oldOrInput as BuildCorrectionPayloadDeltaInput);
  const changedFields: string[] = [];
  const oldValues: Record<string, string | number | null> = {};
  const newValues: Record<string, string | number | null> = {};

  for (const field of DELTA_FIELDS) {
    const oldValue = input.oldPayload[field as keyof WfmTimeExportPayload] as string | number | null;
    const newValue = input.newPayload[field as keyof WfmCorrectionExportPayload] as string | number | null;
    if (oldValue !== newValue) {
      changedFields.push(field);
      oldValues[field] = oldValue;
      newValues[field] = newValue;
    }
  }

  return {
    changedFields,
    oldValues,
    newValues,
    deltaMinutes: input.newPayload.minutesTotal - input.oldPayload.minutesTotal,
  };
}

function serializeRecord(record: Record<string, string | number | null>): string {
  return Object.keys(record)
    .sort()
    .map((key) => `${key}=${record[key] ?? ''}`)
    .join('|');
}

export const CORRECTION_CSV_HEADER =
  'export_kind;logical_reference_key;reference_key;export_sequence;original_export_job_id;correction_export_job_id;original_export_item_id;new_export_item_id;employee_id;employee_name;entry_kind;period_date;changed_fields;old_values;new_values;delta_minutes;correction_reason;finalized_at;finalized_by;payload_hash;previous_payload_hash';

export function buildCorrectionCsvRows(rows: CorrectionCsvRowInput[]): string[] {
  return rows.map((row) =>
    [
      row.exportKind,
      row.logicalReferenceKey,
      row.referenceKey,
      String(row.exportSequence),
      row.originalExportJobId,
      row.correctionExportJobId,
      row.originalExportItemId,
      row.newExportItemId,
      row.employeeId,
      row.employeeName ?? '',
      row.entryKind,
      row.periodDate,
      row.changedFields.join(','),
      serializeRecord(row.oldValues),
      serializeRecord(row.newValues),
      String(row.deltaMinutes),
      row.correctionReason,
      row.finalizedAt,
      row.finalizedBy,
      row.payloadHash,
      row.previousPayloadHash,
    ].join(';'),
  );
}

export function buildCorrectionCsv(rows: CorrectionCsvRowInput[]): string {
  const body = buildCorrectionCsvRows(rows);
  return body.length > 0 ? `${CORRECTION_CSV_HEADER}\n${body.join('\n')}` : CORRECTION_CSV_HEADER;
}
