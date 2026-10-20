import type { ServiceResult } from '@/types';
import type { CareDiagnosis } from '@/types/modules/pflege';
import {
  confirmCareDiagnosisAtomicWrite,
  recordCareDiagnosisAtomically,
  type CareDiagnosisAtomicOriginal,
} from './careDiagnosisAtomicRepository.supabase.web';

const key = (tenantId: string, clientId: string) => `caresuite:care-diagnosis-atomic:v1:${tenantId}:${clientId}`;
const clone = (value: CareDiagnosisAtomicOriginal): CareDiagnosisAtomicOriginal => JSON.parse(JSON.stringify(value)) as CareDiagnosisAtomicOriginal;
function read(tenantId: string, clientId: string): CareDiagnosisAtomicOriginal | null {
  try {
    const raw = window.localStorage.getItem(key(tenantId, clientId));
    return raw ? clone(JSON.parse(raw) as CareDiagnosisAtomicOriginal) : null;
  } catch { return null; }
}
function write(original: CareDiagnosisAtomicOriginal): boolean {
  try { window.localStorage.setItem(key(original.tenantId, original.clientId), JSON.stringify(original)); return true; } catch { return false; }
}
function clear(original: CareDiagnosisAtomicOriginal) {
  try { window.localStorage.removeItem(key(original.tenantId, original.clientId)); } catch { /* bleibt sicher gesperrt */ }
}

export async function recordCareDiagnosisDurably(input: CareDiagnosisAtomicOriginal): Promise<ServiceResult<CareDiagnosis>> {
  const original = clone(input);
  if (read(original.tenantId, original.clientId)) return { ok: false, error: 'Für diese Akte ist bereits eine ungeklärte Diagnoseanfrage gespeichert.' };
  if (!write(original)) return { ok: false, error: 'Die Diagnoseanfrage konnte vor dem Serverzugriff nicht dauerhaft gesichert werden.' };
  const result = await recordCareDiagnosisAtomically(original);
  if (result.ok) clear(original);
  return result;
}

export async function recoverCareDiagnosisJournal(
  tenantId: string, clientId: string, actorId: string,
): Promise<ServiceResult<CareDiagnosis> | null> {
  const original = read(tenantId, clientId);
  if (!original) return null;
  if (original.tenantId !== tenantId || original.clientId !== clientId || original.actorId !== actorId) {
    return { ok: false, error: 'Die offene Diagnoseanfrage gehört zu einer anderen Sitzung oder Akte.' };
  }
  const result = await confirmCareDiagnosisAtomicWrite(original);
  if (result.ok) clear(original);
  return result;
}

export const careDiagnosisAtomicJournal = Object.freeze({ key, read, write, clear });
