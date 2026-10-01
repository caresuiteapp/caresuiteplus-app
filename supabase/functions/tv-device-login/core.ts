/** Transport-independent device grant. Credentials are returned only after an atomic claim. */
export type DeviceRole = 'administration' | 'employee' | 'client';
export type DeviceStatus = 'pending' | 'approved' | 'consumed' | 'denied' | 'expired' | 'cancelled' | 'failed';
export type DeviceActor = {
  role: DeviceRole; tenantId: string; authUserId: string; authSessionId: string;
  portalSessionId?: string; accountId?: string;
};
export type DeviceRequest = {
  id: string; role: DeviceRole; status: DeviceStatus; device_secret_hash: string;
  user_code_hash: string; verification_code: string; expires_at: string;
  created_at: string; ip_hash: string; actor: DeviceActor | null;
};
export class DeviceError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) { super(message); this.code = code; this.status = status; }
}
export const DEVICE_TTL_MS = 5 * 60_000;
export const DEVICE_ROLES = ['administration', 'employee', 'client'] as const;
export const opaquePattern = /^[A-Za-z0-9_-]{43}$/;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function deviceStatus(row: DeviceRequest, now: number): DeviceStatus {
  return ['pending', 'approved'].includes(row.status) && Date.parse(row.expires_at) <= now
    ? 'expired' : row.status;
}
export function assertCanPairUser(user: { is_anonymous?: boolean; factors?: { status?: string }[] }, aal: unknown) {
  if (user.is_anonymous || aal !== 'aal1' || user.factors?.some((factor) => factor.status === 'verified')) {
    throw new DeviceError('mfa_required', 'Dieser Zugang erfordert eine direkte Anmeldung am Bildschirm mit der vorgesehenen Sicherheitsprüfung.', 403);
  }
}
export function assertApplicationMfaDisabled(flags: { mfa_enabled?: boolean; two_factor_enabled?: boolean }) {
  if (flags.mfa_enabled === true || flags.two_factor_enabled === true) {
    throw new DeviceError('mfa_required', 'Dieser Zugang erfordert eine direkte Anmeldung am Bildschirm mit der vorgesehenen Sicherheitsprüfung.', 403);
  }
}
export function assertEmployeeReady(account: { status?: string; must_change_password?: boolean; first_login_completed?: boolean }) {
  if (account.status !== 'active' || account.must_change_password !== false || account.first_login_completed !== true) {
    throw new DeviceError('password_setup_required', 'Bitte schließen Sie zuerst die Erstanmeldung und Passwortvergabe am Handy ab. Erzeugen Sie anschließend einen neuen QR-Code.', 403);
  }
}
export function assertBusinessProfileActive(profile: { is_active?: boolean; status?: string }) {
  if (profile.is_active !== true || profile.status !== 'active') {
    throw new DeviceError('not_authorized', 'Dieser Zugang ist nicht für eine Bildschirmanmeldung freigegeben.', 403);
  }
}
export function assertTenantActive(tenant: { status?: string }, platform: { status?: string; lifecycle_status?: string } | null) {
  if (tenant.status !== 'active' || (platform && (platform.status !== 'active'
    || ['paused', 'offboarding', 'terminated'].includes(platform.lifecycle_status ?? '')))) {
    throw new DeviceError('not_authorized', 'Dieser Zugang ist nicht für eine Bildschirmanmeldung freigegeben.', 403);
  }
}
export interface DeviceDependencies {
  now(): number; randomToken(): string; randomId(): string; verificationCode(): string;
  hash(value: string): Promise<string>;
  rateLimit(key: string, maximum: number, windowSeconds: number): Promise<boolean>;
  create(row: DeviceRequest): Promise<void>;
  find(field: 'id' | 'user_code_hash', value: string): Promise<DeviceRequest | null>;
  transition(id: string, from: DeviceStatus[], to: DeviceStatus, actor?: DeviceActor): Promise<boolean>;
  authenticate(req: Request, role: DeviceRole, portalSessionToken?: string): Promise<DeviceActor>;
  revalidate(actor: DeviceActor): Promise<void>;
  issue(actor: DeviceActor, req: Request): Promise<Record<string, unknown>>;
}
export function createDeviceHandler(deps: DeviceDependencies, allowedOrigins: string[]) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get('origin');
    const originAllowed = !origin || allowedOrigins.includes(origin);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin',
      ...(origin && originAllowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    };
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    try {
      if (!originAllowed) throw new DeviceError('origin_not_allowed', 'Diese Anmeldeseite ist nicht freigegeben.', 403);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (req.method !== 'POST') throw new DeviceError('method_not_allowed', 'Methode nicht erlaubt.', 405);
      const raw = await req.text();
      if (raw.length > 4096) throw new DeviceError('invalid_request', 'Anfrage ungültig.', 400);
      let body: Record<string, unknown>;
      try { body = JSON.parse(raw); } catch { throw new DeviceError('invalid_request', 'Anfrage ungültig.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new DeviceError('invalid_request', 'Anfrage ungültig.');
      const action = body.action;
      if (!['create', 'inspect', 'approve', 'deny', 'poll', 'consume', 'cancel'].includes(String(action))) {
        throw new DeviceError('invalid_request', 'Anfrage ungültig.');
      }
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      // Only a hashed rate-limit key is persisted. No raw IP, JWT, code or device secret.
      const ipHash = await deps.hash(`tv-device-ip:${ip}`);
      const group = action === 'create' ? 'create' : ['poll', 'consume', 'cancel'].includes(String(action)) ? 'device' : 'phone';
      const limit = group === 'create' ? 20 : group === 'device' ? 2400 : 60;
      if (!(await deps.rateLimit(`${group}:${ipHash}`, limit, 300))) {
        throw new DeviceError('rate_limited', 'Zu viele Anfragen. Bitte warten Sie fünf Minuten und versuchen Sie es erneut.', 429);
      }
      if (action === 'create') {
        if (!DEVICE_ROLES.includes(body.role as DeviceRole)) throw new DeviceError('invalid_role', 'Bitte wählen Sie einen Zugang.');
        const now = deps.now(); const userCode = deps.randomToken(); const deviceSecret = deps.randomToken();
        const row: DeviceRequest = {
          id: deps.randomId(), role: body.role as DeviceRole, status: 'pending',
          device_secret_hash: await deps.hash(deviceSecret), user_code_hash: await deps.hash(userCode),
          verification_code: deps.verificationCode(), expires_at: new Date(now + DEVICE_TTL_MS).toISOString(),
          created_at: new Date(now).toISOString(), ip_hash: ipHash, actor: null,
        };
        await deps.create(row);
        return reply({ ok: true, id: row.id, deviceSecret, userCode, verificationCode: row.verification_code, expiresAt: row.expires_at });
      }
      const isPhone = ['inspect', 'approve', 'deny'].includes(String(action));
      if (isPhone ? !opaquePattern.test(String(body.userCode ?? '')) :
        !idPattern.test(String(body.id ?? '')) || !opaquePattern.test(String(body.deviceSecret ?? ''))) {
        throw new DeviceError('invalid_code', 'Dieser QR-Code ist ungültig oder nicht mehr verfügbar.', 404);
      }
      const row = await deps.find(isPhone ? 'user_code_hash' : 'id', isPhone ? await deps.hash(String(body.userCode)) : String(body.id));
      if (!row || (!isPhone && row.device_secret_hash !== await deps.hash(String(body.deviceSecret)))) {
        throw new DeviceError('invalid_code', 'Dieser QR-Code ist ungültig oder nicht mehr verfügbar.', 404);
      }
      if (!isPhone && !(await deps.rateLimit(`grant:${row.id}`, 150, 300))) {
        throw new DeviceError('rate_limited', 'Zu viele Statusabfragen. Bitte warten Sie kurz und erzeugen Sie anschließend einen neuen Code.', 429);
      }
      const status = deviceStatus(row, deps.now());
      const publicState = { ok: true, role: row.role, status, expiresAt: row.expires_at };
      if (action === 'poll') return reply(publicState);
      if (action === 'inspect') return reply({ ...publicState, verificationCode: row.verification_code });
      if (action === 'cancel') {
        if (['pending', 'approved'].includes(status)) {
          const changed = await deps.transition(row.id, ['pending', 'approved'], 'cancelled');
          if (!changed) throw new DeviceError('already_used', 'Diese Anfrage wurde bereits abgeschlossen.', 409);
          return reply({ ...publicState, status: 'cancelled' });
        }
        return reply(publicState);
      }
      if (status === 'expired') throw new DeviceError('expired', 'Der QR-Code ist abgelaufen. Bitte erzeugen Sie am Bildschirm einen neuen Code.', 410);
      if (action === 'approve' || action === 'deny') {
        if (status !== 'pending') throw new DeviceError('already_used', 'Diese Anfrage wurde bereits abgeschlossen.', 409);
        if (body.confirmed !== true || body.verificationCode !== row.verification_code) {
          throw new DeviceError('confirmation_required', 'Bitte vergleichen Sie den Code und bestätigen Sie die Anmeldung ausdrücklich.', 400);
        }
        const actor = await deps.authenticate(req, row.role, typeof body.portalSessionToken === 'string' ? body.portalSessionToken : undefined);
        if (actor.role !== row.role) throw new DeviceError('wrong_role', 'Ihr angemeldeter Zugang passt nicht zu diesem QR-Code.', 403);
        const target = action === 'approve' ? 'approved' : 'denied';
        if (!(await deps.transition(row.id, ['pending'], target, actor))) throw new DeviceError('already_used', 'Diese Anfrage wurde bereits abgeschlossen.', 409);
        return reply({ ...publicState, status: target });
      }
      if (status !== 'approved' || !row.actor) throw new DeviceError('not_approved', 'Die Anmeldung wurde noch nicht freigegeben oder ist bereits abgeschlossen.', 409);
      // Claim before minting. A lost response cannot mint a second session: restart with a fresh QR.
      if (!(await deps.transition(row.id, ['approved'], 'consumed'))) throw new DeviceError('already_used', 'Diese Anfrage wurde bereits abgeschlossen.', 409);
      try {
        await deps.revalidate(row.actor);
        const credentials = await deps.issue(row.actor, req);
        return reply({ ok: true, status: 'consumed', role: row.role, ...credentials });
      } catch (error) {
        await deps.transition(row.id, ['consumed'], 'failed').catch(() => undefined);
        throw error;
      }
    } catch (error) {
      if (error instanceof DeviceError) return reply({ ok: false, code: error.code, error: error.message }, error.status);
      // Do not log auth responses, request bodies, or errors that could contain bearer credentials.
      return reply({ ok: false, code: 'temporarily_unavailable', error: 'Die QR-Anmeldung ist vorübergehend nicht verfügbar. Bitte versuchen Sie es erneut oder nutzen Sie die direkte Anmeldung.' }, 503);
    }
  };
}
