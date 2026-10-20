import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isGoogleWorkspaceAdminRole,
  normalizeGoogleWorkspaceRole,
} from './googleWorkspaceRole.ts';

export class WorkspaceError extends Error {
  constructor(message: string, readonly statusCode = 500, readonly code = 'workspace_error') { super(message); }
}
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const GOOGLE_WORKSPACE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.create',
] as const;

export const GOOGLE_WORKSPACE_CAPABILITIES = {
  gmail: ['https://www.googleapis.com/auth/gmail.modify'],
  calendar: ['https://www.googleapis.com/auth/calendar'],
  meet: ['https://www.googleapis.com/auth/calendar'],
  drive: ['https://www.googleapis.com/auth/drive'],
  docs: ['https://www.googleapis.com/auth/documents'],
  sheets: ['https://www.googleapis.com/auth/spreadsheets'],
  slides: ['https://www.googleapis.com/auth/presentations'],
  tasks: ['https://www.googleapis.com/auth/tasks'],
  contacts: ['https://www.googleapis.com/auth/contacts'],
  chat: [
    'https://www.googleapis.com/auth/chat.spaces.readonly',
    'https://www.googleapis.com/auth/chat.messages.create',
  ],
} as const;

export type GoogleWorkspaceConnection = {
  id: string;
  connected_at: string;
  last_sync_at: string | null;
  last_health_check_at: string | null;
  last_error_code: string | null;
  tenant_id: string;
  connected_user_id: string | null;
  connection_status: string;
  granted_scopes: string[];
  access_token_cipher: string | null;
  refresh_token_cipher: string | null;
  token_expires_at: string | null;
  primary_email: string | null;
  hosted_domain: string | null;
  capabilities: Record<string, boolean>;
};

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY')?.trim();
  if (!raw) throw new Error('GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY fehlt.');
  const bytes = fromBase64(raw);
  if (bytes.byteLength !== 32) {
    throw new Error('GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY muss 32 Byte Base64 sein.');
  }
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptWorkspaceSecret(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(),
    encoder.encode(value),
  );
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
}

export async function decryptWorkspaceSecret(value: string): Promise<string> {
  const [version, iv, cipher] = value.split('.');
  if (version !== 'v1' || !iv || !cipher) throw new Error('Ungültiges Tokenformat.');
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    await encryptionKey(),
    fromBase64(cipher),
  );
  return decoder.decode(clear);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function randomBase64Url(bytes = 48): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  return toBase64(new Uint8Array(digest))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export function buildCapabilities(scopes: string[]): Record<string, boolean> {
  const granted = new Set(scopes);
  return Object.fromEntries(
    Object.entries(GOOGLE_WORKSPACE_CAPABILITIES).map(([key, required]) => [
      key,
      required.every((scope) => granted.has(scope)),
    ]),
  );
}

export function publicConnection(connection: GoogleWorkspaceConnection | null) {
  if (!connection) {
    return {
      status: 'not_connected',
      connectedAt: null, lastSyncAt: null, lastHealthCheckAt: null, lastErrorCode: null,
      email: null,
      domain: null,
      expiresAt: null,
      scopes: [],
      capabilities: buildCapabilities([]),
    };
  }
  return {
    status: connection.connection_status,
    connectedAt: connection.connected_at,
    lastSyncAt: connection.last_sync_at,
    lastHealthCheckAt: connection.last_health_check_at,
    lastErrorCode: connection.last_error_code,
    email: connection.primary_email,
    domain: connection.hosted_domain,
    expiresAt: connection.token_expires_at,
    scopes: connection.granted_scopes ?? [],
    capabilities: buildCapabilities(connection.connection_status === 'connected' ? connection.granted_scopes ?? [] : []),
  };
}

export async function resolveWorkspaceActor(
  authHeader: string,
  service: SupabaseClient,
): Promise<{ tenantId: string; profileId: string; authUserId: string; role: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await userClient.auth.getUser();
  if (!data.user) throw new Error('Nicht autorisiert.');
  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id, tenant_id, role_id, auth_user_id')
    .or(`auth_user_id.eq.${data.user.id},id.eq.${data.user.id}`)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.tenant_id || !profile?.id) throw new Error('Mandantenprofil fehlt.');
  if (!profile.role_id) throw new Error('Benutzerrolle fehlt.');
  const { data: role, error: roleError } = await service
    .from('roles')
    .select('key')
    .eq('id', profile.role_id)
    .maybeSingle();
  if (roleError) throw roleError;
  if (!role?.key) throw new Error('Benutzerrolle fehlt.');
  return {
    tenantId: profile.tenant_id,
    profileId: profile.id,
    authUserId: profile.auth_user_id ?? data.user.id,
    role: normalizeGoogleWorkspaceRole(role.key),
  };
}

export function assertWorkspaceAdmin(role: string): void {
  if (!isGoogleWorkspaceAdminRole(role)) {
    throw new WorkspaceError('Google Workspace steht nur der Geschäftsführung und Verwaltung zur Verfügung.', 403, 'workspace_access_denied');
  }
}

export async function exchangeRefreshToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  scope?: string;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_WORKSPACE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_WORKSPACE_CLIENT_SECRET') ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new WorkspaceError(payload.error === 'invalid_grant' ? 'Google-Anmeldung abgelaufen. Bitte Konto erneut verbinden.' : 'Google-Anmeldung konnte nicht erneuert werden. Bitte später erneut versuchen.', payload.error === 'invalid_grant' ? 409 : 503, payload.error === 'invalid_grant' ? 'google_authorization_required' : 'google_unavailable');
  }
  return payload;
}

export async function getValidAccessToken(
  service: SupabaseClient,
  connection: GoogleWorkspaceConnection,
): Promise<string> {
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;
  if (connection.access_token_cipher && expiresAt > Date.now() + 90_000) {
    return decryptWorkspaceSecret(connection.access_token_cipher);
  }
  if (!connection.refresh_token_cipher) throw new Error('Google-Refresh-Token fehlt.');
  let refreshed: Awaited<ReturnType<typeof exchangeRefreshToken>>;
  try { refreshed = await exchangeRefreshToken(await decryptWorkspaceSecret(connection.refresh_token_cipher)); }
  catch (error) {
    if (error instanceof WorkspaceError && error.code === 'google_authorization_required') {
      await service.from('google_workspace_connections').update({ connection_status: 'degraded', last_error_code: error.code, last_error_message: error.message, updated_at: new Date().toISOString() }).eq('id', connection.id).eq('connected_at', connection.connected_at).eq('connection_status', 'connected');
    }
    throw error;
  }
  const scopes = typeof refreshed.scope === 'string' ? refreshed.scope.split(' ').filter(Boolean) : connection.granted_scopes;
  const encrypted = await encryptWorkspaceSecret(refreshed.access_token);
  const nextExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  const { data: saved, error } = await service
    .from('google_workspace_connections')
    .update({
      access_token_cipher: encrypted,
      granted_scopes: scopes, capabilities: buildCapabilities(scopes),
      token_expires_at: nextExpiry,
      connection_status: 'connected',
      last_health_check_at: new Date().toISOString(),
      last_error_code: null,
      last_error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)
    .eq('connected_at', connection.connected_at)
    .eq('connection_status', 'connected')
    .select('id').maybeSingle();
  if (error || !saved) throw new Error('Die Google-Verbindung wurde inzwischen geändert. Bitte erneut laden.');
  return refreshed.access_token;
}
