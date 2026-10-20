import { USERNAME_MAX_LENGTH } from './auth.types';

const LEGAL_SUFFIXES = [
  'gmbh & co. kg',
  'gmbh & co kg',
  'gmbh',
  'ug (haftungsbeschränkt)',
  'ug',
  'e.k.',
  'e.k',
  'ek',
  'gbr',
  'ag',
  'ohg',
  'kg',
  'mbh',
];

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

function normalizeSegment(value: string): string {
  let normalized = value.trim().toLowerCase();

  for (const [from, to] of Object.entries(DIACRITIC_MAP)) {
    normalized = normalized.replaceAll(from, to);
  }

  normalized = normalized.replace(/\band\b/g, 'und');
  normalized = normalized.replace(/\+/g, '');
  normalized = normalized.replace(/&/g, '');

  for (const suffix of LEGAL_SUFFIXES) {
    const pattern = new RegExp(`\\b${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    normalized = normalized.replace(pattern, '');
  }

  return normalized
    .replace(/[^a-z0-9]/g, '')
    .replace(/\.+/g, '')
    .trim();
}

function trimSegment(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

function extractPrimaryCompanyToken(companyName: string): string {
  const raw = companyName.trim().toLowerCase();
  const firstToken = raw.split(/\s+/)[0] ?? raw;
  return normalizeSegment(firstToken);
}

function extractPrimaryLastNameToken(lastName: string): string {
  const words = lastName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => normalizeSegment(word))
    .filter(Boolean);

  if (words.length === 0) {
    return normalizeSegment(lastName);
  }

  return words.sort((left, right) => right.length - left.length)[0] ?? normalizeSegment(lastName);
}

function resolveCompanyLength(companyRaw: string): number {
  if (companyRaw.length > 11) return 4;
  if (companyRaw.length >= 8 && companyRaw.length <= 10) return 4;
  if (companyRaw.length >= 7) return 5;
  return 4;
}

export function buildUsernameSegments(
  companyName: string,
  firstName: string,
  lastName: string,
): { company: string; first: string; last: string } {
  const companyRaw = extractPrimaryCompanyToken(companyName);
  const firstRaw = normalizeSegment(firstName);
  const lastRaw = extractPrimaryLastNameToken(lastName);

  const company = trimSegment(companyRaw, resolveCompanyLength(companyRaw)) || 'firma';
  const firstLength = firstRaw.length >= 8 ? 4 : firstRaw.length >= 7 ? 5 : 4;
  const first = trimSegment(firstRaw, firstLength) || 'user';
  const maxLast = Math.max(1, USERNAME_MAX_LENGTH - company.length - first.length - 2);
  const preferredLastLength = Math.min(6, maxLast);
  let last = trimSegment(lastRaw, preferredLastLength) || 'x';

  if (lastRaw.length === 9 && maxLast >= 7) {
    last = trimSegment(lastRaw, 7);
  }

  return { company, first, last };
}

export function generateUsername(
  companyName: string,
  firstName: string,
  lastName: string,
): string {
  const { company, first, last } = buildUsernameSegments(companyName, firstName, lastName);
  let username = `${company}.${first}.${last}`;

  if (username.length > USERNAME_MAX_LENGTH) {
    const overflow = username.length - USERNAME_MAX_LENGTH;
    const trimmedLast = last.slice(0, Math.max(1, last.length - overflow));
    username = `${company}.${first}.${trimmedLast}`;
  }

  return sanitizeUsername(username);
}

export function resolveUsernameCollision(baseUsername: string, attempt: number): string {
  const suffix = String(Math.max(2, attempt));
  const lastDot = baseUsername.lastIndexOf('.');

  if (lastDot >= 0) {
    const prefix = baseUsername.slice(0, lastDot + 1);
    const lastSegment = baseUsername.slice(lastDot + 1);
    const allowedLast = Math.max(1, lastSegment.length - suffix.length);
    const trimmedBase = `${prefix}${lastSegment.slice(0, allowedLast)}`;
    return `${trimmedBase.replace(/[.-]+$/g, '')}${suffix}`;
  }

  const maxBaseLength = USERNAME_MAX_LENGTH - suffix.length;
  const trimmedBase = baseUsername.slice(0, maxBaseLength).replace(/[.-]+$/g, '');
  return `${trimmedBase}${suffix}`;
}

export function pickUniqueUsername(
  companyName: string,
  firstName: string,
  lastName: string,
  existingUsernames: string[],
): string {
  const base = generateUsername(companyName, firstName, lastName);
  const existing = new Set(existingUsernames.map((entry) => entry.toLowerCase()));

  if (!existing.has(base)) {
    return base;
  }

  for (let attempt = 2; attempt <= 99; attempt += 1) {
    const candidate = resolveUsernameCollision(base, attempt);
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return resolveUsernameCollision(base, Date.now() % 90 + 10);
}

export function sanitizeUsername(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/\.+/g, '.')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, USERNAME_MAX_LENGTH);
}

export function validateUsername(value: string, existingUsernames: string[] = []): string | null {
  const raw = value.trim().toLowerCase();
  const username = sanitizeUsername(value);

  if (!username) {
    return 'Benutzername ist erforderlich.';
  }
  if (/^[.-]|[.-]$/.test(raw)) {
    return 'Benutzername darf nicht mit Punkt oder Bindestrich beginnen oder enden.';
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
