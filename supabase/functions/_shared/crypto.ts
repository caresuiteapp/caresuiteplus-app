const textEncoder = new TextEncoder();

const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_BYTES = 32;
const RANDOM_SALT_BYTES = 16;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(value: string): Uint8Array | null {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

async function derivePbkdf2(
  value: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(value),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    PBKDF2_BYTES * 8,
  );
  return toHex(bits);
}

async function verifyLegacySha256(value: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'sha256') return false;
  const [, salt, digest] = parts;
  if (!salt || !/^[a-f0-9]{64}$/i.test(digest)) return false;
  const candidate = await crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(`${salt}:${value}`),
  );
  return constantTimeEqual(toHex(candidate), digest.toLowerCase());
}

export async function hashSecret(value: string, salt?: string): Promise<string> {
  const saltBytes = salt
    ? textEncoder.encode(salt)
    : crypto.getRandomValues(new Uint8Array(RANDOM_SALT_BYTES));
  const digest = await derivePbkdf2(value, saltBytes, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256:${PBKDF2_ITERATIONS}:${toHex(saltBytes)}:${digest}`;
}

export async function verifySecret(value: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('sha256:')) {
    return verifyLegacySha256(value, storedHash);
  }

  const [algorithm, iterationsRaw, saltHex, expected] = storedHash.split(':');
  const iterations = Number(iterationsRaw);
  const salt = fromHex(saltHex ?? '');
  if (
    algorithm !== 'pbkdf2-sha256' ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 1_000_000 ||
    !salt ||
    salt.length < 4 ||
    !/^[a-f0-9]{64}$/i.test(expected ?? '')
  ) {
    return false;
  }

  const candidate = await derivePbkdf2(value, salt, iterations);
  return constantTimeEqual(candidate, expected.toLowerCase());
}

export function needsSecretRehash(storedHash: string): boolean {
  if (!storedHash.startsWith('pbkdf2-sha256:')) return true;
  const iterations = Number(storedHash.split(':')[1]);
  return !Number.isInteger(iterations) || iterations < PBKDF2_ITERATIONS;
}

export function normalizePortalCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export async function hashPortalCode(code: string): Promise<string> {
  return hashSecret(normalizePortalCode(code));
}

export async function verifyPortalCode(code: string, storedHash: string): Promise<boolean> {
  return verifySecret(normalizePortalCode(code), storedHash);
}

export function maskCodeHint(code: string): string {
  const normalized = normalizePortalCode(code);
  return normalized.length >= 2 ? `${normalized.slice(0, 2)}****` : '******';
}

export function createOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '');
}

export async function hashOpaqueToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(token));
  return `token-sha256:${toHex(digest)}`;
}

/** Stable OpenAI safety id for tenant+user (max 64 chars per OpenAI API). */
export async function openAiSafetyIdentifier(tenantId: string, userId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(`${tenantId}:${userId}`),
  );
  return toHex(digest);
}
