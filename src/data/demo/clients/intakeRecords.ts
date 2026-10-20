import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';

const store = new Map<string, ClientIntakeFormData>();
const contextStore = new Map<string, ClientCareContext[]>();

export function upsertDemoClientIntakeRecord(clientId: string, form: ClientIntakeFormData): void {
  store.set(clientId, { ...form });
  contextStore.set(clientId, [...form.careContexts]);
}

export function getDemoClientIntakeRecord(clientId: string): ClientIntakeFormData | null {
  return store.get(clientId) ?? null;
}

export function getDemoClientCareContexts(clientId: string): ClientCareContext[] {
  return contextStore.get(clientId) ?? [];
}

export function resetDemoIntakeStore(): void {
  store.clear();
  contextStore.clear();
}
