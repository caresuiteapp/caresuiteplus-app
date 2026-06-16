function newConnectRequestId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
import type { PermissionKey, RoleKey } from '@/types';
import type {
  ConnectAdapterResult,
  ConnectCapability,
  ConnectCategoryKey,
  ConnectConnectorStatus,
  ConnectEnvironment,
  ConnectExecutionContext,
  ConnectGuardResult,
  ConnectIntegrationStatus,
} from '@/types/connect/gateway';
import { isDemoMode } from '@/lib/supabase/config';
import { assertConnectActionAllowed } from './connectGuard';
import {
  assertConnectFeatureAllowed,
  buildConnectFeatureGateContextFromExecution,
  resolveConnectFeatureKeyFromGateway,
} from './connectFeatureGate';
import { getConnectAdapterOrFallback } from './connectAdapterRegistry';
import { recordConnectAuditDraft } from './connectAudit';

export type ConnectGatewayInput = {
  tenantId: string | null | undefined;
  userId: string | null | undefined;
  role: RoleKey | null | undefined;
  providerKey: string;
  category: ConnectCategoryKey;
  environment?: ConnectEnvironment;
  integrationId?: string | null;
  integrationStatus?: ConnectIntegrationStatus;
  connectorStatus?: ConnectConnectorStatus;
  hasCredentialReference?: boolean;
  allowedActions?: readonly string[];
  permissions?: PermissionKey[];
};

export function buildConnectExecutionContext(input: ConnectGatewayInput): ConnectExecutionContext | null {
  if (!input.tenantId?.trim() || !input.userId?.trim() || !input.role) {
    return null;
  }

  const demoMode = isDemoMode();
  const environment: ConnectEnvironment =
    input.environment ?? (demoMode ? 'demo' : 'production');

  const adapter = getConnectAdapterOrFallback(input.providerKey);

  return {
    tenantId: input.tenantId.trim(),
    userId: input.userId.trim(),
    role: input.role,
    environment,
    integrationId: input.integrationId?.trim() ?? null,
    providerKey: input.providerKey,
    category: input.category,
    requestId: newConnectRequestId(),
    permissions: input.permissions ?? [],
    demoMode,
    integrationStatus: input.integrationStatus ?? 'not_configured',
    connectorStatus: input.connectorStatus ?? 'coming_soon',
    hasCredentialReference: Boolean(input.hasCredentialReference),
    allowedActions: input.allowedActions ?? adapter.getAllowedActions(),
    isMockAdapter: adapter.isMockAdapter,
  };
}

export function guardConnectAction(
  action: string,
  context: ConnectExecutionContext,
): ConnectGuardResult {
  return assertConnectActionAllowed(action, context);
}

export async function executeConnectAction(
  action: string,
  payload: Record<string, unknown>,
  context: ConnectExecutionContext,
): Promise<ConnectAdapterResult> {
  const featureKey = resolveConnectFeatureKeyFromGateway(context.category, context.providerKey);
  const featureGate = assertConnectFeatureAllowed(
    featureKey,
    action,
    buildConnectFeatureGateContextFromExecution(featureKey, context),
  );
  if (!featureGate.allowed) {
    const blocked: ConnectAdapterResult = {
      ok: false,
      blocked: true,
      message: featureGate.message,
      auditAction: action,
    };
    const adapter = getConnectAdapterOrFallback(context.providerKey);
    recordConnectAuditDraft(adapter.audit(action, blocked, context));
    return blocked;
  }

  const guard = assertConnectActionAllowed(action, context);
  if (!guard.allowed) {
    const blocked: ConnectAdapterResult = {
      ok: false,
      blocked: true,
      message: guard.message,
      auditAction: action,
    };
    const adapter = getConnectAdapterOrFallback(context.providerKey);
    recordConnectAuditDraft(adapter.audit(action, blocked, context));
    return blocked;
  }

  const adapter = getConnectAdapterOrFallback(context.providerKey);
  const result = await adapter.execute(action, payload, context);
  recordConnectAuditDraft(adapter.audit(action, result, context));
  return result;
}

export async function testConnectConnection(
  context: ConnectExecutionContext,
): Promise<ConnectAdapterResult> {
  return executeConnectAction('test_connection', {}, context);
}

export function listConnectCapabilities(context: ConnectExecutionContext): ConnectCapability[] {
  const adapter = getConnectAdapterOrFallback(context.providerKey);
  return adapter.listCapabilities(context);
}

export function getConnectConnectorStatus(context: ConnectExecutionContext): ConnectConnectorStatus {
  const adapter = getConnectAdapterOrFallback(context.providerKey);
  return adapter.getStatus(context);
}
