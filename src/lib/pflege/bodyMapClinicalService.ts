import type { ServiceResult } from '@/types';
import type {
  BodyMapCapturePhase,
  BodyMapClinicalMedia,
  BodyMapFindingHistoryEntry,
  BodyMapFindingStatus,
  PressureInjuryAssessment,
  PressureInjuryAssessmentInput,
} from '@/types/modules/bodyMap';
import { buildStorageObjectFileName, buildTenantStoragePath, toStorageUploadError } from '@/lib/storage/storagePaths';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getServiceMode } from '@/lib/services/mode';
import { updateDemoBodyMapMarker } from '@/data/demo/bodyMapMarkers';

const STORAGE_BUCKET = 'bodymap-clinical-media';

type UploadClinicalPhotoInput = {
  tenantId: string;
  clientId: string;
  markerId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  capturePhase: BodyMapCapturePhase;
  measurementReferencePresent?: boolean;
  note?: string;
  createdBy?: string | null;
};

type AddProgressInput = {
  tenantId: string;
  clientId: string;
  markerId: string;
  status: BodyMapFindingStatus;
  note: string;
  createdBy?: string | null;
};

const demoMedia = new Map<string, BodyMapClinicalMedia[]>();
const demoHistory = new Map<string, BodyMapFindingHistoryEntry[]>();
const demoPressureAssessments = new Map<string, PressureInjuryAssessment[]>();

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return crypto.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function buildBodyMapClinicalStoragePath(
  tenantId: string,
  clientId: string,
  markerId: string,
  mediaId: string,
  fileName: string,
): string {
  return buildTenantStoragePath(
    tenantId,
    'clients',
    clientId,
    'bodymap',
    markerId,
    buildStorageObjectFileName(mediaId, fileName),
  );
}

function mapMedia(row: Record<string, unknown>): BodyMapClinicalMedia {
  return {
    id: String(row.id ?? ''),
    tenantId: String(row.tenant_id ?? ''),
    clientId: String(row.client_id ?? ''),
    markerId: String(row.marker_id ?? ''),
    storagePath: String(row.storage_path ?? ''),
    mediaType: String(row.media_type ?? 'photo') as BodyMapClinicalMedia['mediaType'],
    capturePhase: row.capture_phase ? (String(row.capture_phase) as BodyMapCapturePhase) : null,
    originalFileName: row.original_file_name ? String(row.original_file_name) : null,
    mimeType: row.mime_type ? String(row.mime_type) : null,
    fileSizeBytes: row.file_size_bytes == null ? null : Number(row.file_size_bytes),
    capturedAt: row.captured_at ? String(row.captured_at) : null,
    measurementReferencePresent: Boolean(row.measurement_reference_present),
    note: String(row.note ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

function mapHistory(row: Record<string, unknown>): BodyMapFindingHistoryEntry {
  return {
    id: String(row.id ?? ''),
    markerId: String(row.marker_id ?? ''),
    eventType: String(row.event_type ?? 'updated') as BodyMapFindingHistoryEntry['eventType'],
    snapshot:
      row.snapshot && typeof row.snapshot === 'object'
        ? (row.snapshot as Record<string, unknown>)
        : {},
    note: String(row.note ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

function mapPressureAssessment(row: Record<string, unknown>): PressureInjuryAssessment {
  return {
    id: String(row.id ?? ''),
    tenantId: String(row.tenant_id ?? ''),
    clientId: String(row.client_id ?? ''),
    markerId: String(row.marker_id ?? ''),
    classification: String(row.classification ?? ''),
    presentOnAdmission:
      row.present_on_admission == null ? null : Boolean(row.present_on_admission),
    deviceRelated: Boolean(row.device_related),
    medicalDevice: row.medical_device ? String(row.medical_device) : null,
    lengthCm: row.length_cm == null ? null : Number(row.length_cm),
    widthCm: row.width_cm == null ? null : Number(row.width_cm),
    depthCm: row.depth_cm == null ? null : Number(row.depth_cm),
    tissuePercentages: (row.tissue_percentages as Record<string, number>) ?? {},
    exudate: (row.exudate as PressureInjuryAssessmentInput['exudate']) ?? {},
    pain: (row.pain as PressureInjuryAssessmentInput['pain']) ?? {},
    infectionSigns: (row.infection_signs as Record<string, boolean>) ?? {},
    escalationFlags: Array.isArray(row.escalation_flags)
      ? row.escalation_flags.map(String)
      : [],
    treatmentPlan: (row.treatment_plan as PressureInjuryAssessmentInput['treatmentPlan']) ?? {},
    pressureReliefPlan:
      (row.pressure_relief_plan as PressureInjuryAssessmentInput['pressureReliefPlan']) ?? {},
    nextReviewAt: row.next_review_at ? String(row.next_review_at) : null,
    assessedAt: String(row.assessed_at ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

export async function uploadBodyMapClinicalPhoto(
  input: UploadClinicalPhotoInput,
): Promise<ServiceResult<BodyMapClinicalMedia>> {
  const mediaId = makeId('media');
  const createdAt = nowIso();
  const storagePath = buildBodyMapClinicalStoragePath(
    input.tenantId,
    input.clientId,
    input.markerId,
    mediaId,
    input.fileName,
  );

  if (getServiceMode() === 'demo') {
    const item: BodyMapClinicalMedia = {
      id: mediaId,
      tenantId: input.tenantId,
      clientId: input.clientId,
      markerId: input.markerId,
      storagePath,
      mediaType: input.measurementReferencePresent ? 'measurement_photo' : 'photo',
      capturePhase: input.capturePhase,
      originalFileName: input.fileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.bytes.byteLength,
      capturedAt: createdAt,
      measurementReferencePresent: input.measurementReferencePresent ?? false,
      note: input.note?.trim() ?? '',
      createdAt,
    };
    demoMedia.set(input.markerId, [item, ...(demoMedia.get(input.markerId) ?? [])]);
    return { ok: true, data: item };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, input.bytes, { contentType: input.mimeType, upsert: false });
  if (uploadError) return { ok: false, error: toStorageUploadError(uploadError.message) };

  const { data, error } = await fromUnknownTable(supabase, 'body_map_finding_media')
    .insert({
      id: mediaId,
      tenant_id: input.tenantId,
      client_id: input.clientId,
      marker_id: input.markerId,
      storage_bucket: STORAGE_BUCKET,
      storage_path: storagePath,
      media_type: input.measurementReferencePresent ? 'measurement_photo' : 'photo',
      capture_phase: input.capturePhase,
      original_file_name: input.fileName,
      mime_type: input.mimeType,
      file_size_bytes: input.bytes.byteLength,
      captured_at: createdAt,
      measurement_reference_present: input.measurementReferencePresent ?? false,
      note: input.note?.trim() ?? '',
      created_by: input.createdBy ?? null,
      created_at: createdAt,
    })
    .select('*')
    .single();
  if (error || !data) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  await fromUnknownTable(supabase, 'body_map_finding_history').insert({
    tenant_id: input.tenantId,
    client_id: input.clientId,
    marker_id: input.markerId,
    event_type: 'photo',
    snapshot: { mediaId, storagePath, capturePhase: input.capturePhase },
    note: input.note?.trim() ?? '',
    created_by: input.createdBy ?? null,
  });
  return { ok: true, data: mapMedia(data as Record<string, unknown>) };
}

export async function fetchBodyMapClinicalRecord(
  tenantId: string,
  clientId: string,
  markerId: string,
): Promise<
  ServiceResult<{
    media: BodyMapClinicalMedia[];
    history: BodyMapFindingHistoryEntry[];
    pressureAssessments: PressureInjuryAssessment[];
  }>
> {
  if (getServiceMode() === 'demo') {
    return {
      ok: true,
      data: {
        media: demoMedia.get(markerId) ?? [],
        history: demoHistory.get(markerId) ?? [],
        pressureAssessments: demoPressureAssessments.get(markerId) ?? [],
      },
    };
  }
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const [mediaResult, historyResult, pressureResult] = await Promise.all([
    fromUnknownTable(supabase, 'body_map_finding_media')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('marker_id', markerId)
      .order('created_at', { ascending: false }),
    fromUnknownTable(supabase, 'body_map_finding_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('marker_id', markerId)
      .order('created_at', { ascending: false }),
    fromUnknownTable(supabase, 'pressure_injury_assessments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('marker_id', markerId)
      .order('assessed_at', { ascending: false }),
  ]);
  const error = mediaResult.error ?? historyResult.error ?? pressureResult.error;
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return {
    ok: true,
    data: {
      media: (mediaResult.data ?? []).map((row) => mapMedia(row as Record<string, unknown>)),
      history: (historyResult.data ?? []).map((row) => mapHistory(row as Record<string, unknown>)),
      pressureAssessments: (pressureResult.data ?? []).map((row) =>
        mapPressureAssessment(row as Record<string, unknown>),
      ),
    },
  };
}

export async function createPressureInjuryAssessment(
  tenantId: string,
  clientId: string,
  markerId: string,
  input: PressureInjuryAssessmentInput,
  assessedBy?: string | null,
): Promise<ServiceResult<PressureInjuryAssessment>> {
  const id = makeId('pressure');
  const createdAt = nowIso();
  const assessment: PressureInjuryAssessment = {
    id,
    tenantId,
    clientId,
    markerId,
    ...input,
    assessedAt: createdAt,
    createdAt,
  };
  if (getServiceMode() === 'demo') {
    demoPressureAssessments.set(markerId, [
      assessment,
      ...(demoPressureAssessments.get(markerId) ?? []),
    ]);
    return { ok: true, data: assessment };
  }
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const { data, error } = await fromUnknownTable(supabase, 'pressure_injury_assessments')
    .insert({
      id,
      tenant_id: tenantId,
      client_id: clientId,
      marker_id: markerId,
      classification: input.classification,
      present_on_admission: input.presentOnAdmission ?? null,
      device_related: input.deviceRelated,
      medical_device: input.medicalDevice ?? null,
      length_cm: input.lengthCm ?? null,
      width_cm: input.widthCm ?? null,
      depth_cm: input.depthCm ?? null,
      tissue_percentages: input.tissuePercentages,
      exudate: input.exudate,
      pain: input.pain,
      infection_signs: input.infectionSigns,
      escalation_flags: input.escalationFlags,
      treatment_plan: input.treatmentPlan,
      pressure_relief_plan: input.pressureReliefPlan,
      assessed_by: assessedBy ?? null,
      next_review_at: input.nextReviewAt ?? null,
      assessed_at: createdAt,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: mapPressureAssessment(data as Record<string, unknown>) };
}

export async function addBodyMapFindingProgress(
  input: AddProgressInput,
): Promise<ServiceResult<{ status: BodyMapFindingStatus; createdAt: string }>> {
  const createdAt = nowIso();
  if (getServiceMode() === 'demo') {
    updateDemoBodyMapMarker(input.clientId, input.markerId, {
      findingStatus: input.status,
    });
    const entry: BodyMapFindingHistoryEntry = {
      id: makeId('history'),
      markerId: input.markerId,
      eventType:
        input.status === 'geschlossen'
          ? 'closed'
          : input.status === 'wiedereroeffnet'
            ? 'reopened'
            : input.status === 'heilend' || input.status === 'abgeheilt'
              ? 'healing'
              : 'updated',
      snapshot: { findingStatus: input.status },
      note: input.note.trim(),
      createdAt,
    };
    demoHistory.set(input.markerId, [entry, ...(demoHistory.get(input.markerId) ?? [])]);
    return { ok: true, data: { status: input.status, createdAt } };
  }
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  const closedAt =
    input.status === 'geschlossen' || input.status === 'abgeheilt' ? createdAt : null;
  const { error } = await fromUnknownTable(supabase, 'body_map_markers')
    .update({
      finding_status: input.status,
      closed_at: closedAt,
      updated_at: createdAt,
    })
    .eq('tenant_id', input.tenantId)
    .eq('client_id', input.clientId)
    .eq('id', input.markerId);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (input.note.trim()) {
    const { error: historyError } = await fromUnknownTable(
      supabase,
      'body_map_finding_history',
    ).insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      marker_id: input.markerId,
      event_type: 'treatment',
      snapshot: { findingStatus: input.status },
      note: input.note.trim(),
      created_by: input.createdBy ?? null,
      created_at: createdAt,
    });
    if (historyError) return { ok: false, error: toGermanSupabaseError(historyError) };
  }
  return { ok: true, data: { status: input.status, createdAt } };
}
