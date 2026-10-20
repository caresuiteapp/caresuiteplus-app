/** Partial mask for IBAN display in employee portal (read-only). */
export function maskPortalIban(iban: string | null | undefined): string | null {
  const trimmed = iban?.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/\s/g, '').toUpperCase();
  if (compact.length < 4) return '•••• •••• •••• ••••';

  const country = compact.startsWith('DE') ? 'DE' : compact.slice(0, 2);
  const last4 = compact.slice(-4);
  return `${country}•• •••• •••• •••• ${last4}`;
}

/** Mask tax identification number for portal display. */
export function maskPortalTaxId(taxId: string | null | undefined): string | null {
  const trimmed = taxId?.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/\s/g, '');
  if (compact.length <= 4) return '••••';
  return `•••• •••• ${compact.slice(-4)}`;
}

/** Mask social security / insurance number for portal display. */
export function maskPortalInsuranceNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/\s/g, '');
  if (compact.length <= 4) return '••••';
  return `•••• ••• ${compact.slice(-3)}`;
}
