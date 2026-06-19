const textEncoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashSecret(value: string, salt?: string): Promise<string> {
  const effectiveSalt = salt ?? `cs-${Date.now().toString(36)}`;
  const payload = `${effectiveSalt}:${value}`;
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(payload));
  return `sha256:${effectiveSalt}:${toHex(digest)}`;
}

export async function verifySecret(value: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith('sha256:')) return false;
  const [, salt, digest] = storedHash.split(':');
  if (!salt || !digest) return false;
  const candidate = await hashSecret(value, salt);
  return candidate.split(':')[2] === digest;
}

export function normalizePortalCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export async function hashPortalCode(code: string): Promise<string> {
  return hashSecret(normalizePortalCode(code), 'portal-code');
}

export async function verifyPortalCode(code: string, storedHash: string): Promise<boolean> {
  return verifySecret(normalizePortalCode(code), storedHash);
}

export function maskCodeHint(code: string): string {
  const normalized = normalizePortalCode(code);
  return normalized.length >= 2 ? `${normalized.slice(0, 2)}****` : '******';
}

/** Stable OpenAI safety id for tenant+user (max 64 chars per OpenAI API). */
export async function openAiSafetyIdentifier(tenantId: string, userId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(`${tenantId}:${userId}`),
  );
  return toHex(digest);
}
