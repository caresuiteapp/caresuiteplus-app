import type { MedicationPackageOption } from './medicationMasterData';
import { isValidPzn } from './medicationMasterDataValidation';
import type { BfarmComponent } from './bfarmCatalogImport';

export const BFARM_SOURCE = 'bfarm-31b';
export const BFARM_SOURCE_URL = 'https://www.bfarm.de/DE/';
export type BfarmReference = {
  product: MedicationPackageOption; components: BfarmComponent[];
  nextExpectedOn: string; checkedAt: string; stale: boolean;
};

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function date(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = new Date(value + 'T00:00:00Z');
  return Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === value;
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
}

export function nextBfarmDeliveryOn(sourceVersion: string): string | null {
  if (!date(sourceVersion)) return null;
  const time = new Date(sourceVersion + 'T00:00:00Z');
  if (time.getUTCDate() < 15) time.setUTCDate(15);
  else { time.setUTCDate(1); time.setUTCMonth(time.getUTCMonth() + 1); }
  return time.toISOString().slice(0, 10);
}

export function bfarmReferenceIsStale(sourceVersion: string, now = new Date()): boolean {
  const next = nextBfarmDeliveryOn(sourceVersion);
  if (!next || !Number.isFinite(now.getTime())) return true;
  const berlinDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return berlinDate >= next;
}

/** Accept one exact requested PZN. Arrays, another record and mixed deliveries fail closed. */
export function decodeBfarmReference(value: unknown, pzn: string): BfarmReference | null {
  if (!object(value) || !object(value.product) || !isValidPzn(pzn)) return null;
  const p = value.product;
  if (p.pzn !== pzn || p.source !== BFARM_SOURCE || !date(p.sourceVersion) || !text(p.name, 400)) return null;
  if (!Object.entries({ ingredient: 2000, strength: 500, dosageForm: 200, brand: 160, manufacturer: 240, packageSize: 120 })
    .every(([key, max]) => p[key] === null || text(p[key], max))) return null;
  if (!date(value.nextExpectedOn) || value.nextExpectedOn !== nextBfarmDeliveryOn(p.sourceVersion) || typeof value.stale !== 'boolean'
    || typeof value.checkedAt !== 'string' || !Number.isFinite(Date.parse(value.checkedAt))) return null;
  if (!Array.isArray(value.components) || !value.components.length || value.components.length > 100) return null;
  const numbers = new Set<number>();
  for (const c of value.components) {
    if (!object(c) || !Number.isInteger(c.number) || Number(c.number) < 1 || Number(c.number) > 999 || numbers.has(Number(c.number))
      || !(c.dosageForm === null || text(c.dosageForm, 200)) || !(c.description === null || text(c.description, 500))
      || !Array.isArray(c.substances) || c.substances.length > 200) return null;
    numbers.add(Number(c.number));
    const ranks = new Set<number>();
    for (const s of c.substances) {
      if (!object(s) || !text(s.name, 500) || !(s.strength === null || text(s.strength, 500))
        || typeof s.id !== 'string' || s.id.length > 30 || !Number.isInteger(s.rank) || Number(s.rank) < 0 || Number(s.rank) > 999
        || ranks.has(Number(s.rank))) return null;
      ranks.add(Number(s.rank));
    }
  }
  return value as unknown as BfarmReference;
}
