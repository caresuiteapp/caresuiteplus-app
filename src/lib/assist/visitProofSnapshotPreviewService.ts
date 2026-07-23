/**
 * Build Leistungsnachweis preview for office proof review from persisted snapshot + DB backfill.
 */
import type { ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import type { VisitTimesSummary } from '@/features/assistWorkflow/calculateVisitTimes';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import {
  mapSignatureRowToCapture,
  pickSignatureImageUrl,
  resolveSignatureFieldStatus,
  resolveVisitSignatureImageUrl,
} from '@/lib/assist/visitSignatureImageService';
import { formatClientAddressLine } from '@/lib/clients/clientAddressResolver';
import { formatStreetLine } from '@/lib/formatAddress';
import { probeSignatureImageDimensions } from '@/lib/signatures/signatureOrientation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { VISIT_TASK_STATUS_LABELS, type VisitTaskStatus } from '@/lib/assist/visitTypes';
import type { VisitProofPreview, VisitProofPreviewTaskItem } from '@/lib/assist/visitProofPreviewService';
import type { VisitSignatureCapture } from '@/lib/assist/visitSignatureSessionStore';
import { formatVisitProofDateTimeRange } from '@/lib/assist/visitProofDateTimeFormat';
import {
  loadVisitProofBrandingForTenant,
  resolveVisitProofEmployeeName,
  VISIT_PROOF_EMPLOYEE_UNKNOWN,
} from '@/lib/assist/visitProofBranding';
import { resolveVisitProofDocumentationText } from '@/lib/assist/visitProofTaskPresentation';

export type VisitProofSnapshotEnrichment = {
  employeeName?: string | null;
  serviceName?: string | null;
  location?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  visitTimes?: VisitTimesSummary | null;
  signature?: VisitSignatureCapture | null;
  signatureImageUrl?: string | null;
  signatureImageWidth?: number | null;
  signatureImageHeight?: number | null;
  tasks?: VisitProofPreviewTaskItem[];
  documentationNote?: string | null;
  tenantLogoUrl?: string | null;
  tenantName?: string | null;
  tenantLegalName?: string | null;
  tenantAddressLine?: string | null;
  tenantIkNumber?: string | null;
  tenantTaxId?: string | null;
  costCarrier?: string | null;
};

function pickEnrichmentString(
  override: string | null | undefined,
  fallback: string | null | undefined,
): string | null | undefined {
  const overrideText = typeof override === 'string' ? override.trim() : '';
  if (overrideText && overrideText !== VISIT_PROOF_EMPLOYEE_UNKNOWN) return overrideText;
  const fallbackText = typeof fallback === 'string' ? fallback.trim() : '';
  if (fallbackText && fallbackText !== VISIT_PROOF_EMPLOYEE_UNKNOWN) return fallbackText;
  return override ?? fallback;
}

/** Merge DB enrichment with caller overrides — meaningful override values win. */
export function mergeVisitProofEnrichment(
  base: VisitProofSnapshotEnrichment,
  override: VisitProofSnapshotEnrichment = {},
): VisitProofSnapshotEnrichment {
  return {
    employeeName: pickEnrichmentString(override.employeeName, base.employeeName),
    serviceName: pickEnrichmentString(override.serviceName, base.serviceName),
    location: pickEnrichmentString(override.location, base.location),
    scheduledStart: pickEnrichmentString(override.scheduledStart, base.scheduledStart),
    scheduledEnd: pickEnrichmentString(override.scheduledEnd, base.scheduledEnd),
    visitTimes: override.visitTimes ?? base.visitTimes ?? null,
    signature: override.signature ?? base.signature ?? null,
    signatureImageUrl: pickEnrichmentString(override.signatureImageUrl, base.signatureImageUrl),
    signatureImageWidth: override.signatureImageWidth ?? base.signatureImageWidth ?? null,
    signatureImageHeight: override.signatureImageHeight ?? base.signatureImageHeight ?? null,
    tasks: override.tasks?.length ? override.tasks : base.tasks,
    documentationNote: pickEnrichmentString(override.documentationNote, base.documentationNote),
    tenantLogoUrl: pickEnrichmentString(override.tenantLogoUrl, base.tenantLogoUrl),
    tenantName: pickEnrichmentString(override.tenantName, base.tenantName),
    tenantLegalName: pickEnrichmentString(override.tenantLegalName, base.tenantLegalName),
    tenantAddressLine: pickEnrichmentString(override.tenantAddressLine, base.tenantAddressLine),
    tenantIkNumber: pickEnrichmentString(override.tenantIkNumber, base.tenantIkNumber),
    tenantTaxId: pickEnrichmentString(override.tenantTaxId, base.tenantTaxId),
    costCarrier: pickEnrichmentString(override.costCarrier, base.costCarrier),
  };
}

const EMPLOYEE_TASK_STATUS_LABELS: Record<string, string> = {
  done: 'Erledigt',
  not_done: 'Nicht erledigt',
  requires_follow_up: 'Nachverfolgung',
  open: 'Offen',
  partial: 'Teilweise erledigt',
  not_possible: 'Nicht möglich',
  deferred: 'Verschoben',
  cancelled: 'Abgebrochen',
};

function readString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function buildStructuredDocumentationText(row: {
  short_description?: string | null;
  special_notes?: string | null;
  deviations?: string | null;
  deviation_justification?: string | null;
  referral_required?: boolean | null;
  emergency_or_problem?: boolean | null;
}): string | null {
  const parts: string[] = [];
  const shortDescription = row.short_description?.trim();
  if (shortDescription) parts.push(shortDescription);
  const specialNotes = row.special_notes?.trim();
  if (specialNotes) parts.push(`Besonderheiten: ${specialNotes}`);
  const deviations = row.deviations?.trim();
  if (deviations) {
    parts.push(`Abweichungen: ${deviations}`);
    const justification = row.deviation_justification?.trim();
    if (justification) parts.push(`Begründung: ${justification}`);
  }
  if (row.referral_required) parts.push('Weiterleitung erforderlich.');
  if (row.emergency_or_problem) parts.push('Notfall/Problem gemeldet.');
  return parts.length > 0 ? parts.join('\n\n') : null;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

function personName(row?: { first_name?: string | null; last_name?: string | null } | null): string {
  if (!row) return '';
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
}

type ClientAddressRow = {
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
};

function formatLocationFromClient(client?: ClientAddressRow | null): string | null {
  if (!client) return null;
  const street = formatStreetLine(client.street, client.house_number);
  const line = formatClientAddressLine(street || client.street, client.postal_code, client.city);
  return line.trim() || null;
}

function resolveAddressSnapshot(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = value.trim();
    return text || null;
  }
  if (value && typeof value === 'object') {
    const formatted = String((value as { formatted?: string }).formatted ?? '').trim();
    return formatted || null;
  }
  return null;
}

function snapshotTasksLookStale(snapshot: Record<string, unknown>): boolean {
  const tasks = parseTasksFromSnapshot(snapshot);
  if (tasks.length === 0) return true;
  return tasks.every((task) => task.status === 'open');
}

function mapDbTasks(
  rows: Array<{ id: string; title: string; status: string; note?: string | null }> | undefined,
): VisitProofPreviewTaskItem[] {
  if (!rows?.length) return [];
  return rows.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status as VisitTaskStatus,
    statusLabel: resolveTaskStatusLabel(task.status),
    note: task.note ?? null,
    completionNote: task.note ?? null,
    notDoneReason: task.note ?? null,
  }));
}

function resolveTaskStatusLabel(status: string): string {
  if (status in VISIT_TASK_STATUS_LABELS) {
    return VISIT_TASK_STATUS_LABELS[status as VisitTaskStatus];
  }
  return EMPLOYEE_TASK_STATUS_LABELS[status] ?? status;
}

function parseVisitTimes(raw: unknown): VisitTimesSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  return {
    driveSeconds: typeof value.driveSeconds === 'number' ? value.driveSeconds : null,
    serviceSeconds: typeof value.serviceSeconds === 'number' ? value.serviceSeconds : null,
    pauseSeconds: typeof value.pauseSeconds === 'number' ? value.pauseSeconds : null,
    totalSeconds: typeof value.totalSeconds === 'number' ? value.totalSeconds : null,
    driveStartedAt: readString(value, 'driveStartedAt'),
    serviceStartedAt: readString(value, 'serviceStartedAt'),
    pauseStartedAt: readString(value, 'pauseStartedAt'),
    arrivedAt: readString(value, 'arrivedAt'),
    serviceEndedAt: readString(value, 'serviceEndedAt'),
    activeTimer:
      value.activeTimer === 'drive' ||
      value.activeTimer === 'service' ||
      value.activeTimer === 'pause'
        ? value.activeTimer
        : null,
  };
}

function parseTasksFromSnapshot(snapshot: Record<string, unknown>): VisitProofPreviewTaskItem[] {
  const raw = snapshot.tasks ?? snapshot.taskList;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry, index): VisitProofPreviewTaskItem | null => {
      if (!entry || typeof entry !== 'object') return null;
      const obj = entry as Record<string, unknown>;
      const title = String(obj.title ?? obj.taskTitle ?? obj.label ?? '').trim();
      if (!title) return null;
      const status = String(obj.status ?? 'open');
      return {
        id: String(obj.id ?? `task-${index}`),
        title,
        status: status as VisitTaskStatus,
        statusLabel: resolveTaskStatusLabel(status),
        note: obj.note != null ? String(obj.note) : null,
        completionNote: obj.completionNote != null ? String(obj.completionNote) : null,
        notDoneReason: obj.notDoneReason != null ? String(obj.notDoneReason) : null,
        isInternal: obj.isInternal === true || obj.is_internal === true,
        isWorkflow: obj.isWorkflow === true || obj.is_workflow === true,
        category:
          obj.category != null
            ? String(obj.category)
            : obj.categoryKey != null
              ? String(obj.categoryKey)
              : null,
      };
    })
    .filter((item): item is VisitProofPreviewTaskItem => item != null);
}

function parseSignatureFromSnapshot(snapshot: Record<string, unknown>): VisitSignatureCapture | null {
  const directName = readString(snapshot, 'signerName');
  const directAt = readString(snapshot, 'signedAt');
  if (directName && directAt) {
      return {
        visitId: readString(snapshot, 'visitId') ?? '',
        signerName: directName,
        signerRole: readString(snapshot, 'signerRole') ?? 'client',
        signedAt: directAt,
        dataUrl: readString(snapshot, 'signatureDataUrl') ?? '',
      };
  }

  const nested = snapshot.signature;
  if (nested && typeof nested === 'object') {
    const sig = nested as Record<string, unknown>;
    const signerName = readString(sig, 'signerName');
    const signedAt = readString(sig, 'signedAt');
    if (signerName && signedAt) {
      return {
        visitId: readString(snapshot, 'visitId') ?? '',
        signerName,
        signerRole: readString(sig, 'signerRole') ?? 'client',
        signedAt,
        dataUrl: readString(sig, 'signatureDataUrl') ?? '',
      };
    }
  }

  return null;
}

function hasClientSignature(
  snapshot: Record<string, unknown>,
  signature: VisitSignatureCapture | null,
  signatureId: string | null,
): boolean {
  return Boolean(signatureId || signature || readString(snapshot, 'signerName') || readString(snapshot, 'signedAt'));
}

/** Merge snapshot fields with optional DB enrichment for review preview. */
export function buildVisitProofPreviewFromProof(
  proof: AssistVisitProofRow,
  enrichment: VisitProofSnapshotEnrichment = {},
): VisitProofPreview & { visitTimes: VisitTimesSummary | null; signatureImageUrl: string | null } {
  const snapshot = proof.payloadSnapshot ?? {};
  const visitTimes = enrichment.visitTimes ?? parseVisitTimes(snapshot.visitTimes);

  const clientName = readString(snapshot, 'clientName') ?? '—';
  const employeeName = resolveVisitProofEmployeeName(snapshot, {
    employeeName: enrichment.employeeName,
  });
  const serviceName =
    enrichment.serviceName ??
    readString(snapshot, 'serviceName') ??
    readString(snapshot, 'title') ??
    'Leistungsnachweis';
  const scheduledStart =
    enrichment.scheduledStart ??
    readString(snapshot, 'scheduledStart') ??
    readString(snapshot, 'plannedStartAt') ??
    '';
  const scheduledEnd =
    enrichment.scheduledEnd ??
    readString(snapshot, 'scheduledEnd') ??
    readString(snapshot, 'plannedEndAt') ??
    '';
  const location =
    enrichment.location ??
    readString(snapshot, 'location') ??
    readString(snapshot, 'locationAddress') ??
    (typeof snapshot.address_snapshot === 'string' ? snapshot.address_snapshot : null) ??
    '—';
  const documentationNote = resolveVisitProofDocumentationText(
    snapshot,
    enrichment.documentationNote ??
      readString(snapshot, 'documentationNote') ??
      readString(snapshot, 'documentation'),
  );

  const signature = enrichment.signature ?? parseSignatureFromSnapshot(snapshot);
  const signatureImageUrl =
    enrichment.signatureImageUrl ??
    pickSignatureImageUrl(null, signature?.dataUrl);

  const tasks = enrichment.tasks?.length
    ? enrichment.tasks
    : parseTasksFromSnapshot(snapshot);

  const fields = [
    { label: 'Klient:in', value: clientName, required: true, missing: clientName === '—' },
    {
      label: 'Mitarbeitende:r',
      value: employeeName,
      required: false,
      missing: employeeName === VISIT_PROOF_EMPLOYEE_UNKNOWN,
    },
    { label: 'Leistung', value: serviceName, required: true, missing: !serviceName.trim() },
    {
      label: 'Termin',
      value: formatVisitProofDateTimeRange(scheduledStart, scheduledEnd),
      required: true,
      missing: !scheduledStart,
    },
    {
      label: 'Anfahrt',
      value: formatDuration(visitTimes?.driveSeconds),
      required: false,
      missing: visitTimes?.driveSeconds == null,
    },
    {
      label: 'Angekommen',
      value: formatDateTime(visitTimes?.arrivedAt),
      required: false,
      missing: !visitTimes?.arrivedAt,
    },
    {
      label: 'Einsatz gestartet',
      value: formatDateTime(visitTimes?.serviceStartedAt),
      required: false,
      missing: !visitTimes?.serviceStartedAt,
    },
    {
      label: 'Einsatz beendet',
      value: formatDateTime(visitTimes?.serviceEndedAt),
      required: false,
      missing: !visitTimes?.serviceEndedAt,
    },
    {
      label: 'Ort',
      value: location,
      required: false,
      missing: !location.trim() || location === '—',
    },
    {
      label: 'Dokumentation',
      value: documentationNote ?? '—',
      required: true,
      missing: !documentationNote,
    },
    {
      label: 'Unterschrift',
      value: resolveSignatureFieldStatus({
        hasSignatureRecord: hasClientSignature(snapshot, signature, proof.signatureId),
        hasDrawnImage: Boolean(signatureImageUrl),
      }),
      required: true,
      missing: !hasClientSignature(snapshot, signature, proof.signatureId),
    },
  ];

  const signed = hasClientSignature(snapshot, signature, proof.signatureId);
  const readyForExport = fields
    .filter((field) => field.required)
    .every((field) => !field.missing);

  const softMissing = fields.filter((field) => field.missing && !field.required);
  const incompleteHint = readyForExport
    ? softMissing.length > 0
      ? 'Pflichtfelder vollständig — einige Zusatzangaben fehlen noch.'
      : 'Alle Pflichtfelder sind vorhanden.'
    : signed
      ? 'Einige Pflichtfelder fehlen noch — Snapshot und Einsatzdaten werden ergänzt.'
      : 'Einige Pflichtfelder fehlen im Snapshot — Daten werden aus dem Einsatz ergänzt, sofern möglich.';

  return {
    visitId: proof.visitId,
    title: readString(snapshot, 'title') ?? serviceName,
    clientName,
    employeeName,
    serviceName,
    scheduledStart,
    scheduledEnd,
    durationMinutes: null,
    location,
    documentationNote,
    tasks,
    signature,
    fields,
    readyForExport,
    incompleteHint,
    visitTimes,
    signatureImageUrl,
  };
}

type VisitEnrichmentRow = {
  id: string;
  title: string | null;
  service_name: string | null;
  planned_start_at: string | null;
  planned_end_at: string | null;
  address_snapshot: unknown;
  employee_id?: string | null;
  legacy_assignment_id?: string | null;
  employees?: { first_name: string | null; last_name: string | null } | null;
  clients?: ClientAddressRow | null;
  assist_visit_tasks?: Array<{
    id: string;
    title: string;
    status: string;
    note?: string | null;
  }>;
};

type AssignmentEnrichmentRow = {
  id: string;
  title: string | null;
  address_snapshot?: string | null;
  employee_id?: string | null;
  documentation_notes?: string | null;
  employees?: { first_name: string | null; last_name: string | null } | null;
  clients?: ClientAddressRow | null;
  assignment_tasks?: Array<{
    id: string;
    title: string;
    status: string;
    sort_order?: number;
  }>;
};

const VISIT_ENRICHMENT_SELECT =
  'id, title, service_name, planned_start_at, planned_end_at, address_snapshot, employee_id, legacy_assignment_id, employees(first_name, last_name), clients(street, house_number, postal_code, city), assist_visit_tasks(id, title, status, note)';

const ASSIGNMENT_ENRICHMENT_SELECT =
  'id, title, address_snapshot, employee_id, documentation_notes, employees(first_name, last_name), clients(street, house_number, postal_code, city), assignment_tasks(id, title, status, sort_order)';

/** Load missing employee, tasks, times and signature from related tables. */
export async function enrichVisitProofForPreview(
  tenantId: string,
  proof: AssistVisitProofRow,
): Promise<ServiceResult<VisitProofSnapshotEnrichment>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const snapshot = proof.payloadSnapshot ?? {};
  const enrichment: VisitProofSnapshotEnrichment = {};

  const needsEmployee = resolveVisitProofEmployeeName(snapshot) === VISIT_PROOF_EMPLOYEE_UNKNOWN;
  const staleSnapshotTasks = snapshotTasksLookStale(snapshot);
  const needsTasks =
    !Array.isArray(snapshot.tasks) ||
    (snapshot.tasks as unknown[]).length === 0 ||
    staleSnapshotTasks;
  const needsLocation =
    !readString(snapshot, 'location') &&
    !readString(snapshot, 'locationAddress') &&
    !resolveAddressSnapshot(snapshot.address_snapshot);
  const needsTimes = !snapshot.visitTimes;
  const needsSchedule =
    !readString(snapshot, 'scheduledStart') &&
    !readString(snapshot, 'plannedStartAt');
  const needsDocumentation =
    resolveVisitProofDocumentationText(snapshot) ===
    'Keine zusätzliche Dokumentation erfasst.';

  let resolvedAssignmentId = readString(snapshot, 'assignmentId');
  let visitRow: VisitEnrichmentRow | null = null;

  if (
    needsEmployee ||
    needsTasks ||
    needsTimes ||
    needsSchedule ||
    needsLocation ||
    needsDocumentation ||
    !readString(snapshot, 'serviceName')
  ) {
    const { data, error } = await fromUnknownTable(supabase, 'assist_visits')
      .select(VISIT_ENRICHMENT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', proof.visitId)
      .maybeSingle();

    if (error && !isSupabaseMissingTableError(error)) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    if (data) {
      visitRow = data as unknown as VisitEnrichmentRow;
      if (needsEmployee) enrichment.employeeName = personName(visitRow.employees) || null;
      if (!readString(snapshot, 'serviceName')) enrichment.serviceName = visitRow.service_name;
      if (needsSchedule) {
        enrichment.scheduledStart = visitRow.planned_start_at;
        enrichment.scheduledEnd = visitRow.planned_end_at;
      }
      if (needsLocation) {
        enrichment.location =
          resolveAddressSnapshot(visitRow.address_snapshot) ??
          formatLocationFromClient(visitRow.clients) ??
          null;
      }
      if (!resolvedAssignmentId && visitRow.legacy_assignment_id) {
        resolvedAssignmentId = visitRow.legacy_assignment_id;
      }
      if (needsTasks && visitRow.assist_visit_tasks?.length && !staleSnapshotTasks) {
        enrichment.tasks = mapDbTasks(visitRow.assist_visit_tasks);
      }
    }
  }

  const employeeId = readString(snapshot, 'employeeId') ?? visitRow?.employee_id ?? null;

  if (needsDocumentation) {
    const { data: documentationData, error: documentationError } = await fromUnknownTable(
      supabase,
      'assist_visit_documentation',
    )
      .select(
        'short_description, special_notes, deviations, deviation_justification, referral_required, emergency_or_problem',
      )
      .eq('tenant_id', tenantId)
      .eq('visit_id', proof.visitId)
      .maybeSingle();

    if (documentationError && !isSupabaseMissingTableError(documentationError)) {
      return { ok: false, error: toGermanSupabaseError(documentationError) };
    }

    if (documentationData) {
      enrichment.documentationNote = buildStructuredDocumentationText(documentationData);
    }
  }

  const shouldLoadAssignment =
    Boolean(resolvedAssignmentId) &&
    (needsEmployee || needsLocation || staleSnapshotTasks || needsTasks || needsDocumentation);

  if (shouldLoadAssignment && resolvedAssignmentId) {
    const { data: assignmentData, error: assignmentError } = await fromUnknownTable(
      supabase,
      'assignments',
    )
      .select(ASSIGNMENT_ENRICHMENT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', resolvedAssignmentId)
      .maybeSingle();

    if (assignmentError && !isSupabaseMissingTableError(assignmentError)) {
      return { ok: false, error: toGermanSupabaseError(assignmentError) };
    }

    if (assignmentData) {
      const assignment = assignmentData as unknown as AssignmentEnrichmentRow;
      if (needsEmployee && !enrichment.employeeName) {
        enrichment.employeeName = personName(assignment.employees) || null;
      }
      if (needsLocation && !enrichment.location) {
        enrichment.location =
          resolveAddressSnapshot(assignment.address_snapshot) ??
          formatLocationFromClient(assignment.clients) ??
          null;
      }
      if ((needsTasks || staleSnapshotTasks) && assignment.assignment_tasks?.length) {
        enrichment.tasks = mapDbTasks(
          [...assignment.assignment_tasks].sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
          ),
        );
      }
      if (needsDocumentation && !enrichment.documentationNote) {
        enrichment.documentationNote = assignment.documentation_notes?.trim() || null;
      }
      if (needsEmployee && !enrichment.employeeName && assignment.employee_id) {
        const { data: employeeData } = await fromUnknownTable(supabase, 'employees')
          .select('first_name, last_name')
          .eq('tenant_id', tenantId)
          .eq('id', assignment.employee_id)
          .maybeSingle();

        if (employeeData) {
          enrichment.employeeName = personName(employeeData) || null;
        }
      }
    }
  }

  if (employeeId && needsEmployee && !enrichment.employeeName) {
    const { data: employeeData } = await fromUnknownTable(supabase, 'employees')
      .select('first_name, last_name')
      .eq('tenant_id', tenantId)
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeData) {
      enrichment.employeeName = personName(employeeData as { first_name?: string | null; last_name?: string | null }) || null;
    }
  }

  const snapshotSig = parseSignatureFromSnapshot(snapshot);
  if (snapshotSig) {
    enrichment.signature = { ...snapshotSig, visitId: proof.visitId };
    if (!enrichment.signatureImageUrl && snapshotSig.dataUrl?.trim()) {
      enrichment.signatureImageUrl = pickSignatureImageUrl(null, snapshotSig.dataUrl);
    }
  }

  if (!enrichment.signatureImageUrl?.trim()) {
    const sig = await fetchValidVisitSignature(tenantId, proof.visitId);
    if (sig.ok && sig.data) {
      if (!enrichment.signature) {
        const signatureImageUrl = await resolveVisitSignatureImageUrl(sig.data.storagePath);
        enrichment.signature = mapSignatureRowToCapture(proof.visitId, sig.data, signatureImageUrl);
        enrichment.signatureImageUrl = signatureImageUrl;
      } else {
        enrichment.signatureImageUrl = await resolveVisitSignatureImageUrl(sig.data.storagePath);
        if (enrichment.signatureImageUrl) {
          enrichment.signature = {
            ...enrichment.signature,
            dataUrl: enrichment.signatureImageUrl,
          };
        }
      }
    }
  }

  if (!enrichment.documentationNote) {
    enrichment.documentationNote = resolveVisitProofDocumentationText(snapshot);
  }

  const branding = await loadVisitProofBrandingForTenant(tenantId);
  enrichment.tenantLogoUrl = branding.logoUrl ?? null;
  enrichment.tenantName = branding.tenantName ?? null;
  enrichment.tenantLegalName = branding.legalName ?? null;
  enrichment.tenantAddressLine = branding.addressLine ?? null;
  enrichment.tenantIkNumber = branding.ikNumber ?? null;
  enrichment.tenantTaxId = branding.taxId ?? null;

  if (enrichment.signatureImageUrl?.trim()) {
    const dimensions = await probeSignatureImageDimensions(enrichment.signatureImageUrl);
    if (dimensions) {
      enrichment.signatureImageWidth = dimensions.width;
      enrichment.signatureImageHeight = dimensions.height;
    }
  }

  return { ok: true, data: enrichment };
}

export function proofHasClientSignature(proof: AssistVisitProofRow): boolean {
  const snapshot = proof.payloadSnapshot ?? {};
  return hasClientSignature(snapshot, parseSignatureFromSnapshot(snapshot), proof.signatureId);
}
