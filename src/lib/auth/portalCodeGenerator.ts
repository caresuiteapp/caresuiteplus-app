import { PORTAL_CODE_CHARSET, PORTAL_CODE_LENGTH } from './auth.types';
import { hashSecret, verifySecret } from './passwordHash';

function randomCharsetIndex(max: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bucket = new Uint32Array(1);
    crypto.getRandomValues(bucket);
    return (bucket[0] ?? 0) % max;
  }
  return Math.floor(Math.random() * max);
}

export function generatePortalCode(length = PORTAL_CODE_LENGTH): string {
  let code = '';
  for (let index = 0; index < length; index += 1) {
    const charIndex = randomCharsetIndex(PORTAL_CODE_CHARSET.length);
    code += PORTAL_CODE_CHARSET[charIndex] ?? 'A';
  }
  return code;
}

export function normalizePortalCodeInput(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, PORTAL_CODE_LENGTH);
}

export function validatePortalCodeFormat(value: string): string | null {
  const normalized = normalizePortalCodeInput(value);
  if (normalized.length !== PORTAL_CODE_LENGTH) {
    return 'Bitte geben Sie einen 6-stelligen Code ein.';
  }
  if (!/^[A-Z0-9]{6}$/.test(normalized)) {
    return 'Der Code darf nur Großbuchstaben und Zahlen enthalten.';
  }
  return null;
}

export async function hashPortalCode(code: string): Promise<string> {
  return hashSecret(normalizePortalCodeInput(code), 'portal-code');
}

export async function verifyPortalCode(code: string, storedHash: string): Promise<boolean> {
  return verifySecret(normalizePortalCodeInput(code), storedHash);
}

export function pickUniquePortalCode(existingCodes: string[]): string {
  const existing = new Set(existingCodes.map((entry) => normalizePortalCodeInput(entry)));

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = generatePortalCode();
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return generatePortalCode();
}

export function maskPortalCodeHint(code: string): string {
  const normalized = normalizePortalCodeInput(code);
  if (normalized.length < 2) {
    return '******';
  }
  return `${normalized.slice(0, 2)}****`;
}
