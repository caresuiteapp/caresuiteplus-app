import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type ZoomActor = {
  tenantId: string;
  profileId: string;
  authUserId: string;
  role: string;
};

export type ZoomConnectionRow = {
  id: string;
  tenant_id: string;
  zoom_account_id: string | null;
  zoom_user_id: string | null;
  primary_email: string | null;
  display_name: string | null;
  account_type: number | null;
  connection_status: string;
  granted_scopes: string[];
  access_token_cipher: string | null;
  refresh_token_cipher: string | null;
  token_expires_at: string | null;
  capabilities: Record<string, boolean>;
  settings: Record<string, unknown>;
};

export const ZOOM_ADMIN_ROLES = new Set([
  'business_admin',
  'business_manager',
  'admin',
  'tenant_admin',
  'owner',
  'manager',
]);

export const ZOOM_MEETING_ROLES = new Set([
  ...ZOOM_ADMIN_ROLES,
  'dispatch',
  'nurse',
  'caregiver',
  'counselor',
  'akademie_admin',
]);

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function base64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  return toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function encryptionKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('ZOOM_TOKEN_ENCRYPTION_KEY')?.trim();
  if (!raw) throw new Error('ZOOM_TOKEN_ENCRYPTION_KEY fehlt.');
  const bytes = fromBase64(raw);
  if (bytes.byteLength !== 32) throw new Error('ZOOM_TOKEN_ENCRYPTION_KEY muss 32 Byte Base64 sein.');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptZoomSecret(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(),
    encoder.encode(value),
  );
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
}

export async function decryptZoomSecret(value: string): Promise<string> {
  const [version, iv, cipher] = value.split('.');
  if (version !== 'v1' || !iv || !cipher) throw new Error('Ungültiges Zoom-Tokenformat.');
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
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
}

export async function hmacSha256(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

export async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function oauthScopes(): string[] {
  return (Deno.env.get('ZOOM_OAUTH_SCOPES')
    ?? 'meeting:read meeting:write user:read recording:read')
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function zoomCapabilities(scopes: string[]): Record<string, boolean> {
  const normalized = scopes.join(' ').toLowerCase();
  return {
    meetings: normalized.includes('meeting:'),
    recordings: normalized.includes('recording:'),
    users: normalized.includes('user:'),
    embeddedMeeting: Boolean(
      Deno.env.get('ZOOM_MEETING_SDK_KEY') && Deno.env.get('ZOOM_MEETING_SDK_SECRET'),
    ),
    webhooks: Boolean(Deno.env.get('ZOOM_WEBHOOK_SECRET_TOKEN')),
  };
}

export function publicZoomConnection(connection: ZoomConnectionRow | null) {
  if (!connection) {
    return {
      status: 'not_connected',
      email: null,
      displayName: null,
      accountType: null,
      scopes: [],
      capabilities: zoomCapabilities([]),
      settings: {},
    };
  }
  return {
    status: connection.connection_status,
    email: connection.primary_email,
    displayName: connection.display_name,
    accountType: connection.account_type,
    scopes: connection.granted_scopes ?? [],
    capabilities: connection.capabilities ?? zoomCapabilities(connection.granted_scopes ?? []),
    settings: connection.settings ?? {},
  };
}

export async function resolveZoomActor(
  authHeader: string,
  service: SupabaseClient,
): Promise<ZoomActor> {
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data } = await userClient.auth.getUser();
  if (!data.user) throw new Error('Nicht autorisiert.');

  const { data: profiles, error: profileError } = await service
    .from('profiles')
    .select('id, tenant_id, role_id, auth_user_id')
    .or(`auth_user_id.eq.${data.user.id},id.eq.${data.user.id}`)
    .limit(2);
  if (profileError) throw profileError;
  const profile = profiles?.[0];
  if (!profile?.tenant_id || !profile?.id || !profile.role_id) {
    throw new Error('Mandantenprofil oder Benutzerrolle fehlt.');
  }
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
    role: String(role.key).trim().toLowerCase(),
  };
}

export function assertZoomAdmin(actor: ZoomActor): void {
  if (!ZOOM_ADMIN_ROLES.has(actor.role)) {
    throw new Error('Nur Administrierende dürfen die Zoom-Verbindung verwalten.');
  }
}

export function assertZoomMeetingAccess(actor: ZoomActor): void {
  if (!ZOOM_MEETING_ROLES.has(actor.role)) {
    throw new Error('Für Zoom-Meetings fehlt die Berechtigung.');
  }
}

async function exchangeRefreshToken(refreshToken: string) {
  const basic = btoa(
    `${Deno.env.get('ZOOM_CLIENT_ID') ?? ''}:${Deno.env.get('ZOOM_CLIENT_SECRET') ?? ''}`,
  );
  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.reason ?? payload.error ?? 'Zoom-Token konnte nicht erneuert werden.');
  }
  return payload as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
}

export async function getValidZoomAccessToken(
  service: SupabaseClient,
  connection: ZoomConnectionRow,
): Promise<string> {
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (connection.access_token_cipher && expiresAt > Date.now() + 90_000) {
    return decryptZoomSecret(connection.access_token_cipher);
  }
  if (!connection.refresh_token_cipher) throw new Error('Zoom-Refresh-Token fehlt.');
  const refreshed = await exchangeRefreshToken(
    await decryptZoomSecret(connection.refresh_token_cipher),
  );
  const refreshCipher = refreshed.refresh_token
    ? await encryptZoomSecret(refreshed.refresh_token)
    : connection.refresh_token_cipher;
  await service.from('zoom_connections').update({
    access_token_cipher: await encryptZoomSecret(refreshed.access_token),
    refresh_token_cipher: refreshCipher,
    token_expires_at: new Date(Date.now() + Number(refreshed.expires_in ?? 3600) * 1000).toISOString(),
    connection_status: 'connected',
    last_health_check_at: new Date().toISOString(),
    last_error_code: null,
    last_error_message: null,
    updated_at: new Date().toISOString(),
  }).eq('id', connection.id);
  return refreshed.access_token;
}

export async function zoomApi<T>(
  service: SupabaseClient,
  connection: ZoomConnectionRow,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`https://api.zoom.us/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getValidZoomAccessToken(service, connection)}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message ?? payload.reason ?? `Zoom API fehlgeschlagen (${response.status}).`);
  }
  return payload as T;
}

export async function createMeetingSdkSignature(
  meetingNumber: string,
  role: 0 | 1,
): Promise<{ signature: string; sdkKey: string }> {
  const sdkKey = Deno.env.get('ZOOM_MEETING_SDK_KEY')?.trim();
  const sdkSecret = Deno.env.get('ZOOM_MEETING_SDK_SECRET')?.trim();
  if (!sdkKey || !sdkSecret) throw new Error('Zoom Meeting SDK ist nicht konfiguriert.');
  const issuedAt = Math.floor(Date.now() / 1000) - 30;
  const expiresAt = issuedAt + 60 * 60 * 2;
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify({
    sdkKey,
    mn: meetingNumber,
    role,
    iat: issuedAt,
    exp: expiresAt,
    appKey: sdkKey,
    tokenExp: expiresAt,
  }));
  const unsigned = `${header}.${body}`;
  return {
    signature: `${unsigned}.${base64Url(await hmacSha256(sdkSecret, unsigned))}`,
    sdkKey,
  };
}
