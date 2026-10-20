export type AddressParts = {
  street?: string | null;
  zip?: string | null;
  city?: string | null;
};

export function formatDocumentAddress(parts: AddressParts): string {
  const street = parts.street?.trim() ?? '';
  const zip = parts.zip?.trim() ?? '';
  const city = parts.city?.trim() ?? '';
  const line2 = [zip, city].filter(Boolean).join(' ');
  return [street, line2].filter(Boolean).join(', ');
}

export function isAddressComplete(parts: AddressParts): boolean {
  return Boolean(parts.street?.trim() && parts.zip?.trim() && parts.city?.trim());
}
