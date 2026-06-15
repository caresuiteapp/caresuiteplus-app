import type { ServiceResult } from '@/types';
import type { ClientContactRecord } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

export type ClientContactInput = Omit<
  ClientContactRecord,
  'id' | 'tenantId' | 'clientId' | 'createdAt' | 'updatedAt'
>;

export async function fetchClientContacts(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientContactRecord[]>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().fetchContacts(tenantId, clientId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    return { ok: true, data: full.contacts };
  }, { delayMs: 200 });
}

export async function createClientContact(
  tenantId: string,
  clientId: string,
  input: ClientContactInput,
): Promise<ServiceResult<ClientContactRecord>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().createContact(tenantId, clientId, input);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const now = new Date().toISOString();
    const contact: ClientContactRecord = {
      id: `contact-${clientId}-${Date.now()}`,
      tenantId,
      clientId,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    upsertDemoClientFullDetail({ ...full, contacts: [...full.contacts, contact], updatedAt: now });
    return { ok: true, data: contact };
  }, { delayMs: 250 });
}

export async function updateClientContact(
  tenantId: string,
  clientId: string,
  contactId: string,
  input: Partial<ClientContactInput>,
): Promise<ServiceResult<ClientContactRecord>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().updateContact(tenantId, clientId, contactId, input);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const idx = full.contacts.findIndex((c) => c.id === contactId);
    if (idx < 0) return { ok: false, error: 'Kontakt nicht gefunden.' };

    const now = new Date().toISOString();
    const updated = { ...full.contacts[idx], ...input, updatedAt: now };
    const contacts = [...full.contacts];
    contacts[idx] = updated;
    upsertDemoClientFullDetail({ ...full, contacts, updatedAt: now });
    return { ok: true, data: updated };
  }, { delayMs: 250 });
}

export async function deleteClientContact(
  tenantId: string,
  clientId: string,
  contactId: string,
): Promise<ServiceResult<void>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().deleteContact(tenantId, clientId, contactId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    upsertDemoClientFullDetail({
      ...full,
      contacts: full.contacts.filter((c) => c.id !== contactId),
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, data: undefined };
  }, { delayMs: 200 });
}
