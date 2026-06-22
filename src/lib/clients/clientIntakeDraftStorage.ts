import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEmptyIntakeForm } from '@/lib/clients/clientIntakeService';
import { parseHomeAccessStoredValue } from '@/lib/clients/clientIntakeHomeAccess';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';

const STORAGE_PREFIX = 'caresuite:client-intake-draft';

export type ClientIntakeDraft = {
  form: ClientIntakeFormData;
  stepIndex: number;
  updatedAt: string;
  /** Live-Supabase-Klient:in mit status lead, falls Entwurf serverseitig persistiert wurde. */
  clientId?: string | null;
};

function storageKey(userId: string, tenantId: string): string {
  return `${STORAGE_PREFIX}:${tenantId}:${userId}`;
}

export function mergeIntakeFormWithDefaults(partial: Partial<ClientIntakeFormData>): ClientIntakeFormData {
  const base = createEmptyIntakeForm();
  const merged = { ...base, ...partial };

  const arrayKeys: (keyof ClientIntakeFormData)[] = [
    'careContexts',
    'billingTypes',
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
  ];

  for (const key of arrayKeys) {
    if (!Array.isArray(merged[key])) {
      (merged as Record<string, unknown>)[key] = base[key];
    }
  }

  if (typeof partial.homeAccess === 'string') {
    merged.homeAccess = parseHomeAccessStoredValue(partial.homeAccess);
  }

  if (!merged.costBearerTemplateIds || typeof merged.costBearerTemplateIds !== 'object') {
    merged.costBearerTemplateIds = base.costBearerTemplateIds;
  }
  if (!merged.costBearerDbTypes || typeof merged.costBearerDbTypes !== 'object') {
    merged.costBearerDbTypes = base.costBearerDbTypes;
  }

  return merged;
}

export function hasIntakeDraftContent(draft: Pick<ClientIntakeDraft, 'form' | 'stepIndex'>): boolean {
  if (draft.stepIndex > 0) return true;

  const f = draft.form;
  const careContexts = f.careContexts ?? [];
  if (careContexts.length > 0) return true;

  const billingTypes = f.billingTypes ?? [];

  return Boolean(
    f.firstName?.trim()
    || f.lastName?.trim()
    || f.street?.trim()
    || f.phone?.trim()
    || f.mobile?.trim()
    || f.email?.trim()
    || billingTypes.length > 0
    || f.consentDatenschutz
    || f.consentVertrag,
  );
}

export async function loadClientIntakeDraft(
  userId: string,
  tenantId: string,
): Promise<ClientIntakeDraft | null> {
  const raw = await AsyncStorage.getItem(storageKey(userId, tenantId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ClientIntakeDraft>;
    if (!parsed.form || typeof parsed.stepIndex !== 'number') return null;

    const draft: ClientIntakeDraft = {
      form: mergeIntakeFormWithDefaults(parsed.form),
      stepIndex: Math.max(0, parsed.stepIndex),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      clientId: typeof parsed.clientId === 'string' ? parsed.clientId : null,
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
    clientId: draft.clientId ?? null,
  };

  if (!hasIntakeDraftContent(payload)) {
    await clearClientIntakeDraft(userId, tenantId);
    return;
  }

  await AsyncStorage.setItem(storageKey(userId, tenantId), JSON.stringify(payload));
}

export async function clearClientIntakeDraft(userId: string, tenantId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(userId, tenantId));
}
