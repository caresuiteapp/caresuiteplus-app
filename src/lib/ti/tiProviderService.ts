import type { RoleKey, ServiceResult } from '@/types';
import type {
  TIConnectionStatus,
  TIProviderCheckResult,
  TIProviderKind,
  TIProviderListItem,
} from '@/types/modules/ti';
import {
  TI_DEMO_TENANT,
  appendTIAuditEvent,
  demoTIProviders,
  getTIProviderList,
} from '@/data/demo/ti';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { tiProvidersSupabaseRepository } from '@/lib/ti/repositories';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';

export async function fetchTIProviders(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TIProviderListItem[]>> {
  const denied = enforcePermission<TIProviderListItem[]>(actorRoleKey, 'ti.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const result = await tiProvidersSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    if (result.data.length === 0) {
      return {
        ok: false,
        error: 'Kein TI-Provider konfiguriert. Bitte Provider in den Einstellungen anlegen.',
      };
    }
    const data: TIProviderListItem[] = result.data.map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      name: String(row.name ?? row.display_name ?? 'TI-Provider'),
      kind: (row.kind ?? row.provider_key ?? 'kim') as TIProviderKind,
      connectionStatus: (row.connection_status as TIConnectionStatus) ?? 'not_configured',
      isActive: Boolean(row.is_active ?? true),
      endpointUrl: String(row.endpoint_url ?? ''),
      secretReference: String(row.secret_reference ?? ''),
      lastCheckAt: (row.last_check_at as string | null) ?? null,
      lastError: (row.last_error as string | null) ?? null,
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    }));
    return { ok: true, data };
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 150));
  return { ok: true, data: getTIProviderList() };
}

export async function checkTIProviderConnection(
  tenantId: string,
  providerId: string,
  actorRoleKey?: RoleKey | null,
  actorName = 'System',
): Promise<ServiceResult<TIProviderCheckResult>> {
  const denied = enforcePermission<TIProviderCheckResult>(actorRoleKey, 'ti.provider.manage');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const providers = await tiProvidersSupabaseRepository.list(tenantId);
    if (!providers.ok) return providers;
    const provider = providers.data.find((p) => String(p.id) === providerId);
    if (!provider) {
      return {
        ok: false,
        error: 'provider_required: Kein TI-Provider konfiguriert oder Provider nicht gefunden.',
      };
    }
    return {
      ok: true,
      data: {
        providerId,
        status: (provider.connection_status as TIConnectionStatus) ?? 'not_configured',
        checkedAt: new Date().toISOString(),
        message: 'Live-Modus: Echter Provider-Connector erforderlich (Edge Function).',
      },
    };
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  const provider = demoTIProviders.find((p) => p.id === providerId);
  if (!provider) return { ok: false, error: 'Provider nicht gefunden.' };

  await new Promise((r) => setTimeout(r, 400));

  const status: TIConnectionStatus = provider.isActive ? provider.connectionStatus : 'disabled';
  const message =
    status === 'kim_active'
      ? 'Verbindung erfolgreich — KIM-Postfach erreichbar'
      : status === 'provider_configured'
        ? 'Provider konfiguriert — Verbindungste st ausstehend'
        : status === 'not_configured'
          ? 'Provider noch nicht konfiguriert'
          : 'Verbindungsprüfung abgeschlossen';

  appendTIAuditEvent({
    tenantId,
    action: 'provider_check',
    actorId: null,
    actorName,
    resourceType: 'ti_provider',
    resourceId: providerId,
    details: message,
    ipAddress: null,
  });

  return {
    ok: true,
    data: {
      providerId,
      status,
      checkedAt: new Date().toISOString(),
      message,
    },
  };
}

export async function updateTIProviderConfig(
  tenantId: string,
  providerId: string,
  config: { secretReference: string; endpointUrl: string },
  actorRoleKey?: RoleKey | null,
  actorName = 'System',
): Promise<ServiceResult<TIProviderListItem>> {
  const denied = enforcePermission<TIProviderListItem>(actorRoleKey, 'ti.provider.manage');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (!config.secretReference.startsWith('vault:')) {
    return { ok: false, error: 'Secret-Referenz muss mit vault: beginnen — keine Klartext-Secrets.' };
  }

  if (getServiceMode() === 'supabase') {
    return {
      ok: false,
      error: 'provider_required: Provider-Konfiguration im Live-Modus über Edge Function — nicht im Frontend.',
    };
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  const provider = demoTIProviders.find((p) => p.id === providerId);
  if (!provider) return { ok: false, error: 'Provider nicht gefunden.' };

  provider.secretReference = config.secretReference;
  provider.endpointUrl = config.endpointUrl;
  provider.connectionStatus = 'provider_configured';
  provider.updatedAt = new Date().toISOString();

  appendTIAuditEvent({
    tenantId,
    action: 'provider_configured',
    actorId: null,
    actorName,
    resourceType: 'ti_provider',
    resourceId: providerId,
    details: 'Provider-Konfiguration aktualisiert (Secret-Referenz)',
    ipAddress: null,
  });

  const { createdAt: _c, ...listItem } = provider;
  return { ok: true, data: listItem };
}
