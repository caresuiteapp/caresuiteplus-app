import draftStorage from './clientIntakeDraftStore';
import { createEmptyIntakeForm } from '@/lib/clients/clientIntakeService';
import { parseHomeAccessStoredValue } from '@/lib/clients/clientIntakeHomeAccess';
import { isUuid } from '@/lib/validation/uuid';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeDocumentState } from '@/features/intakeDocuments/intakeDocumentTypes';

const STORAGE_PREFIX = 'caresuite:client-intake-draft';
const CLIENT_INTAKE_DRAFT_SCHEMA_VERSION = 2;

export type ClientIntakeDraft = {
  form: ClientIntakeFormData;
  stepIndex: number;
  updatedAt: string;
  /** Live-Supabase-Klient:in mit status lead, falls Entwurf serverseitig persistiert wurde. */
  clientId?: string | null;
  schemaVersion?: number;
  serverRevision?: number;
  /** Local comparison only; the authoritative hash is owned by the server. */
  serverFormSnapshot?: string;
  pendingSave?: { operationId: string; expectedRevision: number; form: ClientIntakeFormData };
  pendingReconciliation?: { operationId: string; expectedRevision: number; expectedClientUpdatedAt: string };

};

function storageKey(userId: string, tenantId: string, clientId?: string | null): string {
  return `${STORAGE_PREFIX}:${tenantId}:${userId}${isUuid(clientId) ? `:${clientId}` : ''}`;
}

export function mergeIntakeFormWithDefaults(partial: Partial<ClientIntakeFormData>): ClientIntakeFormData {
  const base = createEmptyIntakeForm();
  const merged = { ...base };
  if (partial.intakeWorkflowVersion === 2) merged.intakeWorkflowVersion = 2;
  if (partial.intakeStage === 'first_contact' || partial.intakeStage === 'full_intake') merged.intakeStage = partial.intakeStage;
  if (typeof partial.intakeAppointmentRequested === 'boolean') merged.intakeAppointmentRequested = partial.intakeAppointmentRequested;
  for (const key of ['intakeContactPerson', 'intakeContactNotes', 'intakeAppointmentStart', 'intakeAppointmentEnd', 'intakeAppointmentLocation'] as const) {
    if (typeof partial[key] === 'string') merged[key] = partial[key];
  }
  for (const key of Object.keys(base) as (keyof ClientIntakeFormData)[]) {
    const value = partial[key];
    if ((typeof base[key] === 'string' && typeof value === 'string') ||
        (typeof base[key] === 'boolean' && typeof value === 'boolean')) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  const arrayKeys: (keyof ClientIntakeFormData)[] = [
    'careContexts',
    'billingTypes',
    'fundingSources',
    'costBearerTypes',
    'homeAccess',
    'supportWishes',
    'preferredTimes',
    'excludedTimes',
    'assignedModules',
    'consentTypes',
    'contractTypes',
    'documentCategories',
    'taskCategories',
    'intakeOptionalConsents',
    'intakeDocuments',
    'intakeDocumentHistory',
  ];

  for (const key of arrayKeys) {
    const value = partial[key];
    if (!Array.isArray(value)) continue;
    (merged as Record<string, unknown>)[key] = (key === 'intakeDocuments' || key === 'intakeDocumentHistory')
      ? value.filter((entry): entry is IntakeDocumentState => typeof entry === 'object' && entry !== null && !Array.isArray(entry) &&
          typeof entry.templateKey === 'string' && entry.signatures && typeof entry.signatures === 'object')
        .map((entry: IntakeDocumentState) => ({ ...entry,
          missingPlaceholders: Array.isArray(entry.missingPlaceholders) ? entry.missingPlaceholders.filter((value) => typeof value === 'string') : ['Gespeichertes Dokument prüfen'],
          unresolvedKeys: Array.isArray(entry.unresolvedKeys) ? entry.unresolvedKeys.filter((value) => typeof value === 'string') : [],
          signatures: Object.fromEntries(Object.entries(entry.signatures).filter(([role, signature]) =>
            ['client', 'employee', 'legal_representative'].includes(role) && signature && typeof signature.dataUrl === 'string')),
        }))
      : value.filter((entry) => typeof entry === 'string');
  }

  if (typeof partial.homeAccess === 'string') {
    merged.homeAccess = parseHomeAccessStoredValue(partial.homeAccess);
  }

  for (const key of ['costBearerTemplateIds', 'costBearerDbTypes'] as const) {
    const value = partial[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      merged[key] = Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'string'));
    }
  }

  return merged;
}

export function hasIntakeDraftContent(draft: Pick<ClientIntakeDraft, 'form' | 'stepIndex'>): boolean {
  if (draft.stepIndex > 0) return true;

  const defaults = createEmptyIntakeForm();
  return (Object.keys(defaults) as (keyof ClientIntakeFormData)[]).some((key) => {
    const value = draft.form[key];
    if (typeof value === 'string') return Boolean(value.trim()) && value !== defaults[key];
    return value != null && JSON.stringify(value) !== JSON.stringify(defaults[key]);
  });
}

export async function loadClientIntakeDraft(
  userId: string,
  tenantId: string,
  clientId?: string,
): Promise<ClientIntakeDraft | null> {
  const raw = (isUuid(clientId) ? await draftStorage.getItem(storageKey(userId, tenantId, clientId)) : null)
    ?? await draftStorage.getItem(storageKey(userId, tenantId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ClientIntakeDraft>;
    if (clientId && parsed.clientId !== clientId) return null;
    if (!parsed.form || typeof parsed.form !== 'object' || Array.isArray(parsed.form) ||
        typeof parsed.stepIndex !== 'number' || !Number.isFinite(parsed.stepIndex)) return null;

    const mergedForm = mergeIntakeFormWithDefaults(parsed.form);
    // Vor Version 2 konnten Browser-Passwortmanager Login-Daten in diese beiden
    // Fachfelder schreiben. Einmalig nur alte, noch nicht aktivierte Entwürfe bereinigen.
    if ((parsed.schemaVersion ?? 1) < CLIENT_INTAKE_DRAFT_SCHEMA_VERSION) {
      mergedForm.keyNumber = '';
      mergedForm.keySafeCode = '';
    }

    const draft: ClientIntakeDraft = {
      form: mergedForm,
      stepIndex: Math.max(0, Math.floor(parsed.stepIndex)),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      // Older demo/browser drafts may contain a non-UUID client id. Keep the
      // complete form, but never pass that legacy value into a UUID filter.
      clientId: isUuid(parsed.clientId) ? parsed.clientId : null,
      schemaVersion: CLIENT_INTAKE_DRAFT_SCHEMA_VERSION,
      serverRevision: Number.isSafeInteger(parsed.serverRevision) && (parsed.serverRevision ?? -1) >= 0 ? parsed.serverRevision : 0,
      serverFormSnapshot: typeof parsed.serverFormSnapshot === 'string' ? parsed.serverFormSnapshot : undefined,
      pendingSave: parsed.pendingSave && isUuid(parsed.pendingSave.operationId) &&
        Number.isSafeInteger(parsed.pendingSave.expectedRevision) && parsed.pendingSave.expectedRevision >= 0 &&
        parsed.pendingSave.form && typeof parsed.pendingSave.form === 'object' && !Array.isArray(parsed.pendingSave.form)
        ? { ...parsed.pendingSave, form: parsed.pendingSave.form } : undefined,
      pendingReconciliation: parsed.pendingReconciliation && isUuid(parsed.pendingReconciliation.operationId) &&
        Number.isSafeInteger(parsed.pendingReconciliation.expectedRevision) && parsed.pendingReconciliation.expectedRevision > 0 &&
        typeof parsed.pendingReconciliation.expectedClientUpdatedAt === 'string'
        ? { ...parsed.pendingReconciliation } : undefined,
    };

    return hasIntakeDraftContent(draft) ? draft : null;
  } catch {
    return null;
  }
}

export async function saveClientIntakeDraft(
  userId: string,
  tenantId: string,
  draft: Omit<ClientIntakeDraft, 'updatedAt'> & { updatedAt?: string },
): Promise<void> {
  const payload: ClientIntakeDraft = {
    form: draft.form,
    stepIndex: draft.stepIndex,
    updatedAt: draft.updatedAt ?? new Date().toISOString(),
    clientId: isUuid(draft.clientId) ? draft.clientId : null,
    schemaVersion: CLIENT_INTAKE_DRAFT_SCHEMA_VERSION,
    serverRevision: draft.serverRevision,
    serverFormSnapshot: draft.serverFormSnapshot,
    pendingSave: draft.pendingSave,
    pendingReconciliation: draft.pendingReconciliation,
  };

  if (!hasIntakeDraftContent(payload)) {
    await clearClientIntakeDraft(userId, tenantId, payload.clientId ?? undefined);
    return;
  }

  const latestKey = storageKey(userId, tenantId);
  // Keep a different locally edited intake recoverable when opening a known ID.
  const previousRaw = await draftStorage.getItem(latestKey);
  if (previousRaw) {
    let previous: Partial<ClientIntakeDraft> | null = null;
    try { previous = JSON.parse(previousRaw) as Partial<ClientIntakeDraft>; }
    catch { /* Keep the valid new draft independently recoverable. */ }
    if (isUuid(previous?.clientId) && previous.clientId !== payload.clientId) {
      const previousKey = storageKey(userId, tenantId, previous.clientId);
      if (!await draftStorage.getItem(previousKey)) await draftStorage.setItem(previousKey, previousRaw);
    }
  }
  const serialized = JSON.stringify(payload);
  if (payload.clientId) await draftStorage.setItem(storageKey(userId, tenantId, payload.clientId), serialized);
  await draftStorage.setItem(latestKey, serialized);
}

export async function clearClientIntakeDraft(userId: string, tenantId: string, clientId?: string): Promise<void> {
  const latestKey = storageKey(userId, tenantId);
  if (!isUuid(clientId)) { await draftStorage.removeItem(latestKey); return; }
  const latest = await draftStorage.getItem(latestKey);
  await draftStorage.removeItem(storageKey(userId, tenantId, clientId));
  if (latest) {
    let latestClientId: unknown;
    try { latestClientId = (JSON.parse(latest) as Partial<ClientIntakeDraft>).clientId; }
    catch { /* Do not remove an unrelated or unrecognized local draft. */ }
    if (latestClientId === clientId) await draftStorage.removeItem(latestKey);
  }
}
