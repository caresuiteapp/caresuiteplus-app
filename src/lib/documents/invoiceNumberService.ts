import type { RoleKey, ServiceResult } from '@/types';

const USED_NUMBERS = new Map<string, Set<string>>();

export function allocateInvoiceNumber(tenantId: string, year?: number): ServiceResult<string> {
  const y = year ?? new Date().getFullYear();
  const key = `${tenantId}:${y}`;
  const used = USED_NUMBERS.get(key) ?? new Set<string>();
  const n = used.size + 1;
  const number = `RE-${y}-${String(n).padStart(4, '0')}`;

  if (used.has(number)) {
    return { ok: false, error: `Rechnungsnummer ${number} bereits vergeben.` };
  }

  used.add(number);
  USED_NUMBERS.set(key, used);
  return { ok: true, data: number };
}

export function reserveInvoiceNumber(tenantId: string, invoiceNumber: string): ServiceResult<void> {
  const match = invoiceNumber.match(/^RE-(\d{4})-/);
  const year = match ? Number(match[1]) : new Date().getFullYear();
  const key = `${tenantId}:${year}`;
  const used = USED_NUMBERS.get(key) ?? new Set<string>();

  if (used.has(invoiceNumber)) {
    return { ok: false, error: `Rechnungsnummer ${invoiceNumber} ist bereits vergeben.` };
  }

  used.add(invoiceNumber);
  USED_NUMBERS.set(key, used);
  return { ok: true, data: undefined };
}

export function isInvoiceNumberUsed(tenantId: string, invoiceNumber: string): boolean {
  const match = invoiceNumber.match(/^RE-(\d{4})-/);
  const year = match ? Number(match[1]) : new Date().getFullYear();
  const used = USED_NUMBERS.get(`${tenantId}:${year}`);
  return used?.has(invoiceNumber) ?? false;
}

export function resetInvoiceNumberRegistry(): void {
  USED_NUMBERS.clear();
}

export function seedInvoiceNumber(tenantId: string, invoiceNumber: string): void {
  reserveInvoiceNumber(tenantId, invoiceNumber);
}
