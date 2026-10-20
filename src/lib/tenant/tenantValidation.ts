export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  return ok ? null : 'Ungültige E-Mail-Adresse.';
}

export function validateIban(value: string): string | null {
  const normalized = value.replace(/\s+/g, '').toUpperCase();
  if (!normalized) return null;
  if (!/^DE\d{20}$/.test(normalized) && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(normalized)) {
    return 'Ungültiges IBAN-Format.';
  }
  const rearranged = `${normalized.slice(4)}${normalized.slice(0, 4)}`;
  let numeric = '';
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numeric += String(code - 55);
    } else if (char >= '0' && char <= '9') {
      numeric += char;
    } else {
      return 'Ungültiges IBAN-Format.';
    }
  }
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number(`${remainder}${numeric.slice(i, i + 7)}`) % 97;
  }
  return remainder === 1 ? null : 'IBAN-Prüfziffer ungültig.';
}

export function validateVatId(value: string): string | null {
  const normalized = value.replace(/\s+/g, '').toUpperCase();
  if (!normalized) return null;
  if (!/^DE\d{9}$/.test(normalized)) {
    return 'USt-IdNr. muss dem Format DE123456789 entsprechen.';
  }
  return null;
}

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export function normalizeVatId(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}
