import type { ServiceResult } from '@/types';
import type { ClientClinicalHistoryEntry } from '@/types/modules/clientClinicalHistory';
import {
  confirmClientClinicalHistoryWrite,
  recordClientClinicalHistory,
  type ClientClinicalWriteOriginal,
} from './clientClinicalHistoryRepository.supabase.web';

type Journal = Readonly<{ phase: 'record'; original: ClientClinicalWriteOriginal }>;
const prefix = 'caresuite:client-clinical-history:v1:';
const key = (tenantId: string, clientId: string) => `${prefix}${tenantId}:${clientId}`;
function storage(): Storage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
function writeJournal(original: ClientClinicalWriteOriginal): boolean {
  try { const target = storage(); if (!target) return false; target.setItem(key(original.tenantId, original.clientId), JSON.stringify({ phase: 'record', original })); return true; }
  catch { return false; }
}
function readJournal(tenantId: string, clientId: string): Journal | null {
  try { const raw = storage()?.getItem(key(tenantId, clientId)); if (!raw) return null; const value = JSON.parse(raw); return value?.phase === 'record' && value.original ? value : null; }
  catch { return null; }
}
function clearJournal(tenantId: string, clientId: string): void { try { storage()?.removeItem(key(tenantId, clientId)); } catch { /* closed */ } }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function capture(original: ClientClinicalWriteOriginal): ClientClinicalWriteOriginal {
  return freeze(structuredClone({ ...original, legacyOrigin: original.legacyOrigin ?? null }));
}

export async function recordClientClinicalHistoryDurably(original: ClientClinicalWriteOriginal): Promise<ServiceResult<ClientClinicalHistoryEntry>> {
  const captured = capture(original);
  if (!writeJournal(captured)) return { ok: false, error: 'Das Versandjournal konnte nicht dauerhaft gespeichert werden; es wurde nichts gesendet.' };
  const result = await recordClientClinicalHistory(captured);
  if (result.ok) clearJournal(captured.tenantId, captured.clientId);
  return result;
}

export async function recoverClientClinicalHistoryJournal(tenantId: string, clientId: string, actorId: string): Promise<ServiceResult<ClientClinicalHistoryEntry> | null> {
  const journal = readJournal(tenantId, clientId); if (!journal) return null;
  if (journal.original.tenantId !== tenantId || journal.original.clientId !== clientId || journal.original.actorId !== actorId) {
    return { ok: false, error: 'Ein fremder oder veralteter klinischer Schreibvorgang bleibt gesperrt.' };
  }
  const result = await confirmClientClinicalHistoryWrite({ tenantId, clientId, actorId, requestId: journal.original.requestId,
    expectedLegacyOrigin: journal.original.legacyOrigin ?? null });
  if (result.ok) clearJournal(tenantId, clientId);
  return result;
}

export const clientClinicalHistoryJournal = Object.freeze({ readJournal, clearJournal, capture });
