import { USERNAME_MAX_LENGTH } from './auth.types';
import { resolveUsernameCollision, sanitizeUsername } from './usernameGenerator';

/**
 * Client portal username algorithm (tenant-unique):
 *
 * 1. Normalize first and last name: lowercase, trim, umlauts → ae/oe/ue/ss.
 * 2. First name keeps internal hyphens (e.g. Heinz-Peter → heinz-peter).
 * 3. Last name uses the longest word token (e.g. Do Nascimento → nascimento).
 * 4. Primary form: `{firstname}.{lastname}` (e.g. heinz-peter.reinhardt).
 * 5. If longer than 20 chars: compact `{firstInitial}{lastname}` (e.g. hreinhardt).
 * 6. On tenant collision: append numeric suffix 2, 3, … (trim last segment if needed).
 * 7. Final sanitize: [a-z0-9.-], max 20 chars, no leading/trailing punctuation.
 */

const DIACRITIC_MAP: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  é: 'e',
  è: 'e',
  ê: 'e',
  á: 'a',
  à: 'a',
  â: 'a',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  ç: 'c',
  ñ: 'n',
};

function applyDiacritics(value: string): string {
  let normalized = value;
  for (const [from, to] of Object.entries(DIACRITIC_MAP)) {
    normalized = normalized.replaceAll(from, to);
  }
  return normalized;
}

function normalizeFirstNameSegment(value: string): string {
  const lowered = applyDiacritics(value.trim().toLowerCase());
  return lowered
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeLastNameToken(value: string): string {
  const words = value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => applyDiacritics(word).replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);

  if (words.length === 0) {
    return applyDiacritics(value).replace(/[^a-z0-9]/g, '') || 'klient';
  }

  return words.sort((left, right) => right.length - left.length)[0] ?? 'klient';
}

function firstInitial(firstName: string): string {
  const compact = firstName.replace(/-/g, '');
  return compact.charAt(0) || 'k';
}

export function buildClientPortalUsernameCandidates(firstName: string, lastName: string): string[] {
  const first = normalizeFirstNameSegment(firstName) || 'klient';
  const last = normalizeLastNameToken(lastName) || 'x';
  const dottedRaw = `${first}.${last}`;
  const compactRaw = `${firstInitial(first)}${last}`;
  const dotted = sanitizeUsername(dottedRaw);
  const compact = sanitizeUsername(compactRaw);

  const candidates: string[] = [];
  if (dottedRaw.length <= USERNAME_MAX_LENGTH) {
    candidates.push(dotted);
  }
  if (compact !== dotted) {
    candidates.push(compact);
  }
  if (!candidates.includes(dotted)) {
    candidates.push(dotted);
  }
  return candidates.filter(Boolean);
}

export function generateClientPortalUsername(firstName: string, lastName: string): string {
  const candidates = buildClientPortalUsernameCandidates(firstName, lastName);
  const fitting = candidates.find((candidate) => candidate.length <= USERNAME_MAX_LENGTH);
  return fitting ?? candidates[candidates.length - 1]?.slice(0, USERNAME_MAX_LENGTH) ?? sanitizeUsername('klient.x');
}

export function pickUniqueClientPortalUsername(
  firstName: string,
  lastName: string,
  existingUsernames: string[],
): string {
  const existing = new Set(existingUsernames.map((entry) => entry.toLowerCase()));
  const candidates = buildClientPortalUsernameCandidates(firstName, lastName);

  for (const candidate of candidates) {
    if (candidate.length <= USERNAME_MAX_LENGTH && !existing.has(candidate)) {
      return candidate;
    }
  }

  const base = candidates[0] ?? sanitizeUsername('klient.x');
  if (!existing.has(base)) {
    return base.slice(0, USERNAME_MAX_LENGTH);
  }

  for (let attempt = 2; attempt <= 99; attempt += 1) {
    const candidate = resolveUsernameCollision(base, attempt);
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return resolveUsernameCollision(base, Date.now() % 90 + 10);
}

export function validateClientPortalUsername(
  value: string,
  existingUsernames: string[] = [],
): string | null {
  const username = sanitizeUsername(value);
  if (!username) {
    return 'Benutzername ist erforderlich.';
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Benutzername darf maximal ${USERNAME_MAX_LENGTH} Zeichen haben.`;
  }
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(username) && username.length > 1) {
    return 'Benutzername darf nur Kleinbuchstaben, Zahlen, Punkt oder Bindestrich enthalten.';
  }
  if (existingUsernames.some((entry) => entry.toLowerCase() === username)) {
    return 'Benutzername ist bereits vergeben.';
  }
  return null;
}
