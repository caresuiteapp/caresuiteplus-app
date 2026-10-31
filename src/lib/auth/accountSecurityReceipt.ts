import type { AccountSecurityState } from './accountSecurityService';

/** Used only to bind a local, server-confirmed receipt to its original session.
 * Decoding a JWT is never used to authorize a server operation. */
export function matchesOfflineSecurityReceipt(raw: string | null, accessToken: string, now = Date.now()): AccountSecurityState | null {
  try {
    if (!raw) return null;
    const receipt = JSON.parse(raw) as AccountSecurityState & { validUntil: number };
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as { session_id?: unknown; aal?: unknown };
    if (receipt.active !== true || typeof receipt.mfaRequired !== 'boolean' || !Number.isFinite(receipt.validUntil)
      || receipt.validUntil <= now || receipt.validUntil > now + 24 * 60 * 60_000
      || typeof claims.session_id !== 'string' || claims.session_id !== receipt.sessionId
      || (receipt.mfaRequired && (receipt.aal !== 'aal2' || claims.aal !== 'aal2'))) return null;
    return receipt;
  } catch { return null; }
}
