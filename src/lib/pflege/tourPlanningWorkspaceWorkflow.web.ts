import { sameWoundJson, woundUuid } from './woundCareDomain.ts';
import { decodeTourPlanningReceipt, tourPlanningObject, tourPlanningVersion, tourPlanningLegacyVersion, validateTourPlanningCommand, type TourPlanningCommand, type TourPlanningReceipt } from './tourPlanningWorkspaceDomain.web.ts';

export type TourPlanningJournalScope = { tenantId: string; planId: string; actorId: string };
export type TourPlanningResult<T> = { ok: true; data: T } | { ok: false; error: string; rejected?: boolean; uncertain?: boolean };
export type TourPlanningJournal = { version: typeof tourPlanningVersion | typeof tourPlanningLegacyVersion; scope: TourPlanningJournalScope; phase: 'prepared' | 'dispatched' | 'confirmed' | 'rejected'; command: TourPlanningCommand; receipt: TourPlanningReceipt | null; rejection: string | null };
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type TourPlanningLock = <T>(key: string, action: () => Promise<T>) => Promise<T>;
type Dependencies = { storage: Store; lock: TourPlanningLock; isCurrent(): boolean; commit(command: TourPlanningCommand): Promise<TourPlanningResult<TourPlanningReceipt>>; confirm(command: TourPlanningCommand): Promise<TourPlanningResult<TourPlanningReceipt>> };
export function tourPlanningJournalKey(scope: TourPlanningJournalScope) { if (!Object.values(scope).every((value) => woundUuid(value) && value === value.toLowerCase())) throw Error('Der lokale Tourenplanungskontext ist ungültig.'); return `caresuite.tour-planning-workspace.v1:${scope.tenantId}:${scope.actorId}:${scope.planId}`; }
export function decodeTourPlanningJournal(raw: string, scope: TourPlanningJournalScope): TourPlanningJournal {
  const value: unknown = JSON.parse(raw);
  if (!tourPlanningObject(value) || Object.keys(value).sort().join(',') !== 'command,phase,receipt,rejection,scope,version' || ![tourPlanningVersion, tourPlanningLegacyVersion].includes(value.version as typeof tourPlanningVersion) || !sameWoundJson(value.scope, scope) || !['prepared', 'dispatched', 'confirmed', 'rejected'].includes(String(value.phase))) throw Error('Der gesicherte Planungsvorgang ist beschädigt. Neue Übertragung bleibt gesperrt.');
  validateTourPlanningCommand(value.command); const command = value.command;
  if (command.tenantId !== scope.tenantId || command.planId !== scope.planId || command.actorId !== scope.actorId) throw Error('Der gesicherte Vorgang gehört zu einem anderen Konto oder Plan.');
  if (value.phase === 'confirmed') decodeTourPlanningReceipt(value.receipt, command); else if (value.receipt !== null) throw Error('Die lokale Planungsbestätigung ist widersprüchlich.');
  if (value.phase === 'rejected' ? typeof value.rejection !== 'string' || !value.rejection : value.rejection !== null) throw Error('Der lokale Speicherstatus ist widersprüchlich.');
  return structuredClone(value) as TourPlanningJournal;
}
export class TourPlanningWorkflow {
  private key: string; private inFlight = false; private scope: TourPlanningJournalScope; private dependencies: Dependencies;
  constructor(scope: TourPlanningJournalScope, dependencies: Dependencies) { this.scope = structuredClone(scope); this.dependencies = dependencies; this.key = tourPlanningJournalKey(scope); }
  read() { const raw = this.dependencies.storage.getItem(this.key); return raw === null ? null : decodeTourPlanningJournal(raw, this.scope); }
  private current() { if (!this.dependencies.isCurrent()) throw Error('Konto, Plan oder Berechtigung wurde geändert. Vorgang neu öffnen.'); }
  private persist(value: TourPlanningJournal) { const raw = JSON.stringify(value); this.dependencies.storage.setItem(this.key, raw); if (this.dependencies.storage.getItem(this.key) !== raw) throw Error('Der Planungsvorgang konnte nicht zuverlässig gesichert werden.'); decodeTourPlanningJournal(raw, this.scope); }
  private async exclusive<T>(action: () => Promise<T>) { if (this.inFlight) throw Error('Ein Planungsvorgang wird bereits geprüft.'); this.inFlight = true; try { return await this.dependencies.lock(this.key, async () => { this.current(); return action(); }); } finally { this.inFlight = false; } }
  async dispatch(command: TourPlanningCommand): Promise<TourPlanningResult<TourPlanningReceipt>> {
    const copy = structuredClone(command); validateTourPlanningCommand(copy);
    if (copy.version !== tourPlanningVersion) throw Error('Ältere Originalanfragen ausschließlich lesend wiederaufnehmen oder ungesendeten Entwurf neu erfassen.');
    if (copy.tenantId !== this.scope.tenantId || copy.planId !== this.scope.planId || copy.actorId !== this.scope.actorId) throw Error('Die Anfrage gehört zu einem anderen Planungskontext.');
    return this.exclusive(async () => {
      if (this.read()) throw Error('Zuerst den gesicherten Vorgang prüfen und mit dem Originalverlauf abgleichen.');
      const prepared: TourPlanningJournal = { version: tourPlanningVersion, scope: structuredClone(this.scope), phase: 'prepared', command: copy, receipt: null, rejection: null };
      this.persist(prepared); this.current(); const dispatched = { ...prepared, phase: 'dispatched' as const }; this.persist(dispatched); this.current();
      let result: TourPlanningResult<TourPlanningReceipt>;
      try { result = await this.dependencies.commit(structuredClone(copy)); } catch { result = { ok: false, uncertain: true, error: 'Die Speicherantwort fehlt. Nur die native Quittung der gesicherten Anfrage prüfen.' }; }
      this.current();
      if (result.ok) { const receipt = decodeTourPlanningReceipt(result.data, copy); this.persist({ ...dispatched, phase: 'confirmed', receipt }); return { ok: true, data: receipt }; }
      if (result.rejected === true && result.uncertain !== true) this.persist({ ...dispatched, phase: 'rejected', rejection: result.error });
      return result;
    });
  }
  async confirm(): Promise<TourPlanningResult<TourPlanningReceipt>> { return this.exclusive(async () => { const saved = this.read(); if (!saved) throw Error('Kein gesicherter Planungsvorgang vorhanden.'); if (saved.phase === 'confirmed') return { ok: true, data: structuredClone(saved.receipt!) }; if (saved.phase !== 'dispatched') throw Error('Dieser Vorgang wurde nicht unklar übertragen.'); const result = await this.dependencies.confirm(structuredClone(saved.command)); this.current(); if (!result.ok) return { ok: false, uncertain: true, error: result.error }; const receipt = decodeTourPlanningReceipt(result.data, saved.command); this.persist({ ...saved, phase: 'confirmed', receipt }); return { ok: true, data: receipt }; }); }
  async releaseConfirmed(events: unknown[]) { return this.exclusive(async () => { const saved = this.read(); if (!saved || saved.phase !== 'confirmed' || !saved.receipt || !events.some((event) => sameWoundJson(event, saved.receipt!.event))) throw Error('Der bestätigte Originalbeleg fehlt im vollständig neu geladenen Verlauf.'); this.dependencies.storage.removeItem(this.key); if (this.dependencies.storage.getItem(this.key) !== null) throw Error('Der bestätigte Planungsvorgang konnte lokal nicht freigegeben werden.'); }); }
  async discardUnsentOrRejected() { return this.exclusive(async () => { const saved = this.read(); if (!saved || !['prepared', 'rejected'].includes(saved.phase)) throw Error('Ein möglicherweise gespeicherter Vorgang darf nicht verworfen werden.'); this.dependencies.storage.removeItem(this.key); if (this.dependencies.storage.getItem(this.key) !== null) throw Error('Der lokale Planungsvorgang konnte nicht freigegeben werden.'); }); }
}
export const browserTourPlanningLock: TourPlanningLock = async (key, action) => { if (typeof navigator === 'undefined' || !navigator.locks) throw Error('Dieser Browser kann gleichzeitige Planungsvorgänge nicht sicher sperren.'); return navigator.locks.request(key, { mode: 'exclusive', ifAvailable: true }, async (lock) => { if (!lock) throw Error('Der Planungsvorgang wird in einem anderen Fenster bearbeitet.'); return action(); }); };
