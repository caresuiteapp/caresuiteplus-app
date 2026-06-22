import type { ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';
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
  getRelativePortalCodes,
  listClientPortalUsernames,
  saveClientPortalCode,
  savePortalPermissions,
  saveRelativePortalCode,
  setPortalCodeHash,
} from './accessStore';
import { recordLoginAuditEvent } from './loginAuditService';
import {
  pickUniqueClientPortalUsername,
} from './clientPortalUsernameGenerator';
import { formatClientPortalDisplayName } from '@/lib/portal/clientPortalDisplayName';
import { demoClients } from '@/data/demo/clients';
import {
  hashPortalCode,
  maskPortalCodeHint,
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
  firstName: string;
  lastName: string;
  createdBy: string | null;
  expiresAt?: string | null;
}): Promise<ServiceResult<{ code: ClientPortalCode; credentials: AccessCredentialsReveal }>> {
  const username = pickUniqueClientPortalUsername(
    input.firstName,
    input.lastName,
    listClientPortalUsernames(input.tenantId),
  );
  const plainCode = pickUniquePortalCode([]);
  const code: ClientPortalCode = {
    id: createId('cpc'),
    tenantId: input.tenantId,
    clientId: input.clientId,
    username,
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
        username,
        portalCode: plainCode,
        expiresAt: code.expiresAt,
      },
    },
  };
}

export type ClientPortalLoginResult = {
  portalAccountId: string;
  tenantId: string;
  portalSession?: PortalSessionRecord;
  supabaseAccessToken?: string;
  supabaseRefreshToken?: string;
};

export async function loginClientPortal(
  usernameInput: string,
  codeInput: string,
): Promise<ServiceResult<ClientPortalLoginResult>> {
  const username = usernameInput.trim().toLowerCase();
  if (!username) {
    return { ok: false, error: 'Benutzername ist erforderlich.' };
  }

  const formatError = validatePortalCodeFormat(codeInput);
  if (formatError) {
    return { ok: false, error: formatError };
  }

  if (getServiceMode() === 'supabase') {
    const login = await invokeEdgeFunction<{
      portalAccountId: string;
      tenantId: string;
      clientId: string;
      portalType: PortalAccessType;
      displayName?: string;
      tenantName?: string | null;
      sessionToken: string;
      expiresAt: string;
      supabaseAccessToken?: string;
      supabaseRefreshToken?: string;
    }>('client-portal-login', { username, code: codeInput });

    if (!login.ok) {
      return { ok: false, error: login.error };
    }

    const portalSession: PortalSessionRecord = {
      sessionToken: login.data.sessionToken,
      tenantId: login.data.tenantId,
      loginType: 'client_portal',
      roleKey: 'client_portal',
      expiresAt: login.data.expiresAt,
      accountId: login.data.portalAccountId,
      clientId: login.data.clientId ?? null,
      displayName: login.data.displayName?.trim() || undefined,
      tenantName: login.data.tenantName?.trim() || null,
    };

    return {
      ok: true,
      data: {
        portalAccountId: login.data.portalAccountId,
        tenantId: login.data.tenantId,
        portalSession,
        supabaseAccessToken: login.data.supabaseAccessToken,
        supabaseRefreshToken: login.data.supabaseRefreshToken,
      },
    };
  }

  if (!isDemoMode()) {
    return {
      ok: false,
      error:
        'Live-Anmeldung erfordert Supabase-Konfiguration. Bitte EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (oder EXPO_PUBLIC_SUPABASE_ANON_KEY) setzen.',
    };
  }

  const tenantId = DEMO_TENANT_ID;
  const normalized = normalizePortalCodeInput(codeInput);
  const codes = getClientPortalCodes(tenantId).filter(
    (entry) => entry.username.toLowerCase() === username,
  );

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
        loginType: 'client_portal',
        accountId: entry.id,
        usernameOrCodeHint: `${username} / ${maskPortalCodeHint(normalized)}`,
        success: false,
        failureReason: 'Code gesperrt.',
      });
      return { ok: false, error: 'Zugang gesperrt. Bitte wenden Sie sich an die Verwaltung.' };
    }

    if (entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: 'Zugangscode ungültig oder abgelaufen.' };
    }

    entry.lastUsedAt = nowIso();
    saveClientPortalCode(entry);

    await recordLoginAuditEvent({
      tenantId,
      loginType: 'client_portal',
      accountId: entry.id,
      usernameOrCodeHint: `${username} / ${maskPortalCodeHint(normalized)}`,
      success: true,
      failureReason: null,
    });

    const demoClient = demoClients.find((client) => client.id === entry.clientId);
    const clientDisplayName = demoClient
      ? formatClientPortalDisplayName({
          firstName: demoClient.firstName,
          lastName: demoClient.lastName,
        })
      : null;

    return {
      ok: true,
      data: {
        portalAccountId: entry.id,
        tenantId,
        portalSession: {
          sessionToken: createId('ps'),
          tenantId,
          loginType: 'client_portal',
          roleKey: 'client_portal',
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          accountId: entry.id,
          clientId: entry.clientId,
          displayName: clientDisplayName ?? undefined,
        },
      },
    };
  }

  await recordLoginAuditEvent({
    tenantId,
    loginType: 'client_portal',
    accountId: null,
    usernameOrCodeHint: `${username} / ${maskPortalCodeHint(normalized)}`,
    success: false,
    failureReason: 'Zugangsdaten unbekannt.',
  });

  return { ok: false, error: 'Benutzername oder Zugangscode ist falsch.' };
}

export async function validatePortalCodeLogin(
  codeInput: string,
  portalType: PortalAccessType,
  usernameInput?: string,
): Promise<ServiceResult<ClientPortalLoginResult>> {
  if (portalType === 'client') {
    return loginClientPortal(usernameInput ?? '', codeInput);
  }

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
      loginType: 'relative_portal',
      roleKey: 'family_portal',
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
  const codes = getRelativePortalCodes(tenantId);

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
        loginType: 'relative_portal',
        accountId: entry.id,
        usernameOrCodeHint: maskPortalCodeHint(normalized),
        success: false,
        failureReason: 'Code gesperrt.',
      });
      return { ok: false, error: 'Zugang gesperrt. Bitte wenden Sie sich an die Verwaltung.' };
    }

    if (entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: 'Code ungültig oder abgelaufen.' };
    }

    entry.lastUsedAt = nowIso();
    saveRelativePortalCode(entry);

    await recordLoginAuditEvent({
      tenantId,
      loginType: 'relative_portal',
      accountId: entry.id,
      usernameOrCodeHint: maskPortalCodeHint(normalized),
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
    loginType: 'relative_portal',
    accountId: null,
    usernameOrCodeHint: maskPortalCodeHint(normalized),
    success: false,
    failureReason: 'Code unbekannt.',
  });

  return { ok: false, error: 'Code ungültig oder abgelaufen.' };
}

export async function regeneratePortalCode(
  codeId: string,
  portalType: PortalAccessType,
  firstName?: string,
  lastName?: string,
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
          firstName: firstName ?? entry.username.split('.')[0] ?? 'Klient',
          lastName: lastName ?? entry.username.split('.').slice(1).join('.') ?? 'X',
          createdBy: null,
          expiresAt: entry.expiresAt,
        })
      : await generateClientPortalCode({
          tenantId,
          clientId: entry.clientId,
          firstName: firstName ?? 'Angehoerige',
          lastName: lastName ?? 'X',
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
