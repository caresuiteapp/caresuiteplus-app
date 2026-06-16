import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/supabase/config';
import { getServiceMode } from '@/lib/services/mode';
import type { ConnectAdapterResult } from '@/types/connect/gateway';
import {
  buildConnectExecutionContext,
  executeConnectAction,
  type ConnectGatewayInput,
} from './connectGatewayService';

export type ConnectGatewayInvokeInput = ConnectGatewayInput & {
  action: string;
  payload?: Record<string, unknown>;
};

/**
 * Client-Gateway — ruft niemals externe Anbieter direkt auf.
 * Demo/lokal: Gateway-Service. Live: Edge Function connect-provider-proxy.
 */
export async function invokeConnectProviderAction(
  input: ConnectGatewayInvokeInput,
): Promise<ConnectAdapterResult> {
  const context = buildConnectExecutionContext(input);
  if (!context) {
    return {
      ok: false,
      blocked: true,
      message: 'Connect-Kontext unvollständig — Aktion blockiert.',
      auditAction: input.action,
    };
  }

  const useLocalGateway = isDemoMode() || getServiceMode() === 'demo';

  if (useLocalGateway) {
    return executeConnectAction(input.action, input.payload ?? {}, context);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      blocked: true,
      message: 'Supabase nicht verfügbar — externe Aktion blockiert.',
      auditAction: input.action,
    };
  }

  const { data, error } = await supabase.functions.invoke('connect-provider-proxy', {
    body: {
      providerKey: input.providerKey,
      action: input.action,
      payload: input.payload ?? {},
      integrationId: input.integrationId ?? null,
      category: input.category,
    },
  });

  if (error) {
    return {
      ok: false,
      blocked: true,
      message: error.message ?? 'Connect-Proxy nicht erreichbar.',
      auditAction: input.action,
    };
  }

  const result = data as ConnectAdapterResult | null;
  if (!result?.auditAction) {
    return {
      ok: false,
      blocked: true,
      message: 'Ungültige Proxy-Antwort.',
      auditAction: input.action,
    };
  }

  return result;
}

/** Platzhalter-Konfiguration — keine Secrets, nur Status für Admin-UI. */
export function maskConnectCredentialReference(reference: string | null | undefined): string {
  if (!reference?.trim()) return 'Nicht konfiguriert';
  return `vault:••••${reference.slice(-4)}`;
}
