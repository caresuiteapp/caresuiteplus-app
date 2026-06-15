const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function fallbackHash(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return `fallback:${Math.abs(hash).toString(16)}`;
}

export async function hashSecret(value: string, salt?: string): Promise<string> {
  const effectiveSalt = salt ?? `cs-${Date.now().toString(36)}`;
  const payload = `${effectiveSalt}:${value}`;

  if (typeof crypto !== 'undefined' && crypto.subtle && textEncoder) {
    const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(payload));
    return `sha256:${effectiveSalt}:${toHex(digest)}`;
  }

  return `sha256:${effectiveSalt}:${fallbackHash(payload)}`;
}

export async function verifySecret(value: string, storedHash: string): Promise<boolean> {
  if (!storedHash.startsWith('sha256:')) {
    return false;
  }

  const [, salt, digest] = storedHash.split(':');
  if (!salt || !digest) {
    return false;
  }

  const candidate = await hashSecret(value, salt);
  const candidateDigest = candidate.split(':')[2];
  return candidateDigest === digest;
}
