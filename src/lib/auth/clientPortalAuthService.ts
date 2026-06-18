import type { ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { getServiceMode } from '@/lib/services/mode';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import type { PortalSessionRecord } from './portalSessionStore';
import type {
  AccessCredentialsReveal,
  ClientPortalCode,
  PortalAccessPermissions,
  PortalAccessType,
} from './auth.types';
import {
  getClientPortalCodes,
  getPortalCodeHash,
  saveClientPortalCode,
  savePortalPermissions,
  setPortalCodeHash,
} from './demoAccessStore';
import { recordLoginAuditEvent } from './loginAuditService';
import {
  hashPortalCode,
  normalizePortalCodeInput,
  pickUniquePortalCode,
  validatePortalCodeFormat,
  verifyPortalCode,
} from './portalCodeGenerator';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function generateClientPortalCode(input: {
  tenantId: string;
  clientId: string;
  createdBy: string | null;
  expiresAt?: string | null;
}): Promise<ServiceResult<{ code: ClientPortalCode; credentials: AccessCredentialsReveal }>> {
  const plainCode = pickUniquePortalCode([]);
  const code: ClientPortalCode = {
    id: createId('cpc'),
    tenantId: input.tenantId,
    clientId: input.clientId,
    status: 'active',
    expiresAt: input.expiresAt ?? null,
    lastUsedAt: null,
    createdBy: input.createdBy,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    blockedAt: null,
    blockedBy: null,
    blockedReason: null,
    regeneratedAt: null,
  };

  saveClientPortalCode(code);
  await setPortalCodeHash(code.id, await hashPortalCode(plainCode));

  const permissions: PortalAccessPermissions = {
    id: createId('pap'),
    tenantId: input.tenantId,
    portalType: 'client',
    portalAccountId: code.id,
    canViewAppointments: true,
    canViewDocuments: true,
    canViewMessages: true,
    canSendMessages: true,
    canViewServiceRecords: true,
    canViewInvoices: false,
    canDownloadDocuments: true,
    canConfirmAppointments: true,
    canSignRecords: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  savePortalPermissions(permissions);

  return {
    ok: true,
    data: {
      code,
      credentials: {
        portalCode: plainCode,
        expiresAt: code.expiresAt,
      },
    },
  };
}

export async function validatePortalCodeLogin(
  codeInput: string,
  portalType: PortalAccessType,
): Promise<ServiceResult<{ portalAccountId: string; tenantId: string; portalSession?: PortalSessionRecord }>> {
  const formatError = validatePortalCodeFormat(codeInput);
  if (formatError) {
    return { ok: false, error: formatError };
  }

  if (getServiceMode() === 'supabase') {
    const login = await invokeEdgeFunction<{
      portalAccountId: string;
      tenantId: string;
      portalType: PortalAccessType;
      sessionToken: string;
      expiresAt: string;
    }>('portal-code-login', { code: codeInput, portalType });

    if (!login.ok) {
      return { ok: false, error: login.error };
    }

    const portalSession: PortalSessionRecord = {
      sessionToken: login.data.sessionToken,
      tenantId: login.data.tenantId,
      loginType: portalType === 'client' ? 'client_portal' : 'relative_portal',
      roleKey: portalType === 'client' ? 'client_portal' : 'family_portal',
      expiresAt: login.data.expiresAt,
      accountId: login.data.portalAccountId,
    };

    return {
      ok: true,
      data: {
        portalAccountId: login.data.portalAccountId,
        tenantId: login.data.tenantId,
        portalSession,
      },
    };
  }

  const tenantId = DEMO_TENANT_ID;
  const normalized = normalizePortalCodeInput(codeInput);
  const codes = getClientPortalCodes(tenantId);

  for (const entry of codes) {
    const hash = getPortalCodeHash(entry.id);
    if (!hash) continue;
    const valid = await verifyPortalCode(normalized, hash);
    if (!valid) continue;

    if (entry.status === 'regenerated' || entry.status === 'expired' || entry.status === 'revoked') {
      continue;
    }

    if (entry.status === 'blocked') {
      await recordLoginAuditEvent({
        tenantId,
        loginType: portalType === 'client' ? 'client_portal' : 'relative_portal',
        accountId: entry.id,
        usernameOrCodeHint: `${normalized.slice(0, 2)}****`,
        success: false,
        failureReason: 'Code gesperrt.',
      });
      return { ok: false, error: 'Zugang gesperrt. Bitte wenden Sie sich an die Verwaltung.' };
    }

    if (entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: 'Code ungültig oder abgelaufen.' };
    }

    entry.lastUsedAt = nowIso();
    saveClientPortalCode(entry);

    await recordLoginAuditEvent({
      tenantId,
      loginType: portalType === 'client' ? 'client_portal' : 'relative_portal',
      accountId: entry.id,
      usernameOrCodeHint: `${normalized.slice(0, 2)}****`,
      success: true,
      failureReason: null,
    });

    return {
      ok: true,
      data: {
        portalAccountId: entry.id,
        tenantId,
      },
    };
  }

  await recordLoginAuditEvent({
    tenantId,
    loginType: portalType === 'client' ? 'client_portal' : 'relative_portal',
    accountId: null,
    usernameOrCodeHint: `${normalized.slice(0, 2)}****`,
    success: false,
    failureReason: 'Code unbekannt.',
  });

  return { ok: false, error: 'Code ungültig oder abgelaufen.' };
}

export async function regeneratePortalCode(
  codeId: string,
  portalType: PortalAccessType,
): Promise<ServiceResult<AccessCredentialsReveal>> {
  const tenantId = DEMO_TENANT_ID;
  const codes = getClientPortalCodes(tenantId);
  const entry = codes.find((item) => item.id === codeId);
  if (!entry) {
    return { ok: false, error: 'Portal-Code nicht gefunden.' };
  }

  entry.status = 'regenerated';
  entry.regeneratedAt = nowIso();
  entry.updatedAt = nowIso();
  saveClientPortalCode(entry);
  await setPortalCodeHash(codeId, '');

  const regenerated =
    portalType === 'client'
      ? await generateClientPortalCode({
          tenantId,
          clientId: entry.clientId,
          createdBy: null,
          expiresAt: entry.expiresAt,
        })
      : await generateClientPortalCode({
          tenantId,
          clientId: entry.clientId,
          createdBy: null,
          expiresAt: entry.expiresAt,
        });

  if (!regenerated.ok) {
    return regenerated;
  }

  return {
    ok: true,
    data: regenerated.data.credentials,
  };
}

export async function blockPortalCode(codeId: string, actorId: string | null, reason: string) {
  const tenantId = DEMO_TENANT_ID;
  const entry = getClientPortalCodes(tenantId).find((item) => item.id === codeId);
  if (!entry) {
    return { ok: false as const, error: 'Portal-Code nicht gefunden.' };
  }

  entry.status = 'blocked';
  entry.blockedAt = nowIso();
  entry.blockedBy = actorId;
  entry.blockedReason = reason;
  entry.updatedAt = nowIso();
  saveClientPortalCode(entry);
  return { ok: true as const, data: entry };
}

export async function unblockPortalCode(codeId: string) {
  const tenantId = DEMO_TENANT_ID;
  const entry = getClientPortalCodes(tenantId).find((item) => item.id === codeId);
  if (!entry) {
    return { ok: false as const, error: 'Portal-Code nicht gefunden.' };
  }

  entry.status = 'active';
  entry.blockedAt = null;
  entry.blockedBy = null;
  entry.blockedReason = null;
  entry.updatedAt = nowIso();
  saveClientPortalCode(entry);
  return { ok: true as const, data: entry };
}
