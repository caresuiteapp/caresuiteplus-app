import { supplyVersion, decodeSupplyReceipt, supplyObject, validateSupplyCommand, type SupplyCommand, type SupplyReceipt } from './supplyWorkspaceDomain.web.ts';
import { sameWoundJson, woundUuid } from './woundCareDomain.ts';

export type SupplyJournalScope = { tenantId: string; clientId: string; actorId: string };
export type SupplyWorkflowResult<T> = { ok: true; data: T } | { ok: false; error: string; rejected?: boolean; uncertain?: boolean };
export type SupplyJournal = {
  version: typeof supplyVersion; scope: SupplyJournalScope; phase: 'prepared' | 'dispatched' | 'confirmed' | 'rejected';
  command: SupplyCommand; receipt: SupplyReceipt | null; rejection: string | null;
};
export type JournalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type SupplyJournalLock = <T>(key: string, action: () => Promise<T>) => Promise<T>;
type Dependencies = {
  storage: JournalStorage; lock: SupplyJournalLock; isCurrent(): boolean;
  commit(command: SupplyCommand): Promise<SupplyWorkflowResult<SupplyReceipt>>;
  confirm(command: SupplyCommand): Promise<SupplyWorkflowResult<SupplyReceipt>>;
};

/** The key contains scope IDs only. Access tokens are never persisted. */
export function supplyJournalKey(scope: SupplyJournalScope) {
  if (!Object.values(scope).every(v => woundUuid(v) && v === v.toLowerCase())) throw Error('Der lokale Materialkontext ist ungültig.');
  return `caresuite.case-supply.v1:${scope.tenantId}:${scope.actorId}:${scope.clientId}`;
}
export function decodeSupplyJournal(raw: string, scope: SupplyJournalScope): SupplyJournal {
  const value: unknown = JSON.parse(raw);
  if (!supplyObject(value) || Object.keys(value).sort().join(',') !== 'command,phase,receipt,rejection,scope,version' ||
    value.version !== supplyVersion || !sameWoundJson(value.scope, scope) || !['prepared', 'dispatched', 'confirmed', 'rejected'].includes(String(value.phase))) throw Error('Der gesicherte Materialvorgang ist beschädigt. Neue Übertragung bleibt gesperrt.');
  validateSupplyCommand(value.command);
  const c = value.command;
  if (c.tenantId !== scope.tenantId || c.clientId !== scope.clientId || c.actorId !== scope.actorId) throw Error('Der gesicherte Materialvorgang gehört zu einem anderen Konto oder Fall.');
  if (value.phase === 'confirmed') decodeSupplyReceipt(value.receipt, c);
  else if (value.receipt !== null) throw Error('Die lokale Bestätigung ist widersprüchlich.');
  if (value.phase === 'rejected' ? typeof value.rejection !== 'string' || !value.rejection : value.rejection !== null) throw Error('Der lokale Speicherstatus ist widersprüchlich.');
  return structuredClone(value) as SupplyJournal;
}

/** One durable exact request per account/case. Recovery only reads native receipts. */
export class SupplyWorkflow {
  private readonly key: string;
  private readonly scope: SupplyJournalScope;
  private readonly deps: Dependencies;
  private inFlight = false;
  constructor(scope: SupplyJournalScope, deps: Dependencies) { this.scope = structuredClone(scope); this.deps = deps; this.key = supplyJournalKey(scope); }
  read(): SupplyJournal | null {
    const raw = this.deps.storage.getItem(this.key);
    return raw === null ? null : decodeSupplyJournal(raw, this.scope);
  }
  private current() { if (!this.deps.isCurrent()) throw Error('Konto, Pflegefall oder Berechtigung wurde geändert. Vorgang im aktuellen Kontext neu öffnen.'); }
  private persist(value: SupplyJournal) {
    const raw = JSON.stringify(value);
    this.deps.storage.setItem(this.key, raw);
    if (this.deps.storage.getItem(this.key) !== raw) throw Error('Der Vorgang konnte auf diesem Gerät nicht zuverlässig gesichert werden.');
    decodeSupplyJournal(raw, this.scope);
  }
  private async exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (this.inFlight) throw Error('Ein Materialvorgang wird bereits geprüft.');
    this.inFlight = true;
    try { return await this.deps.lock(this.key, async () => { this.current(); return action(); }); }
    finally { this.inFlight = false; }
  }
  async dispatch(command: SupplyCommand): Promise<SupplyWorkflowResult<SupplyReceipt>> {
    const captured = structuredClone(command);
    validateSupplyCommand(captured);
    if (captured.tenantId !== this.scope.tenantId || captured.clientId !== this.scope.clientId || captured.actorId !== this.scope.actorId) throw Error('Die Anfrage gehört zu einem anderen Materialkontext.');
    return this.exclusive(async () => {
      if (this.read()) throw Error('Zuerst den gesicherten Vorgang prüfen und dessen Ergebnis im Verlauf abgleichen.');
      const prepared: SupplyJournal = { version: supplyVersion, scope: structuredClone(this.scope), phase: 'prepared', command: captured, receipt: null, rejection: null };
      this.persist(prepared); this.current();
      // This durable marker precedes the RPC. A crash here must never cause an automatic replay.
      const dispatched: SupplyJournal = { ...prepared, phase: 'dispatched' };
      this.persist(dispatched); this.current();
      let result: SupplyWorkflowResult<SupplyReceipt>;
      try { result = await this.deps.commit(structuredClone(captured)); }
      catch { result = { ok: false, uncertain: true, error: 'Die Speicherantwort fehlt. Nur die native Quittung für den gesicherten Vorgang prüfen.' }; }
      // Even a revoked current UI keeps its durable dispatched marker. It cannot expose a late result.
      this.current();
      if (result.ok) {
        const receipt = decodeSupplyReceipt(result.data, captured);
        this.persist({ ...dispatched, phase: 'confirmed', receipt });
        return { ok: true, data: receipt };
      }
      if (result.rejected === true && result.uncertain !== true) this.persist({ ...dispatched, phase: 'rejected', rejection: result.error });
      return result;
    });
  }
  async confirm(): Promise<SupplyWorkflowResult<SupplyReceipt>> {
    return this.exclusive(async () => {
      const pending = this.read();
      if (!pending) throw Error('Kein gesicherter Materialvorgang vorhanden.');
      if (pending.phase === 'confirmed') return { ok: true, data: structuredClone(pending.receipt!) };
      if (pending.phase !== 'dispatched') throw Error('Dieser Vorgang wurde nicht unklar übertragen.');
      const result = await this.deps.confirm(structuredClone(pending.command));
      this.current();
      if (!result.ok) return { ok: false, uncertain: true, error: result.error };
      const receipt = decodeSupplyReceipt(result.data, pending.command);
      this.persist({ ...pending, phase: 'confirmed', receipt });
      return { ok: true, data: receipt };
    });
  }
  /** Explicit clearing only after native history proves the exact confirmed event. */
  async releaseConfirmed(events: unknown[]) {
    return this.exclusive(async () => {
      const saved = this.read();
      if (!saved || saved.phase !== 'confirmed' || !saved.receipt || !events.some(e => sameWoundJson(e, saved.receipt!.event))) throw Error('Der bestätigte Originalbeleg fehlt im neu geladenen Verlauf.');
      this.deps.storage.removeItem(this.key);
      if (this.deps.storage.getItem(this.key) !== null) throw Error('Der bestätigte Vorgang konnte lokal nicht freigegeben werden.');
    });
  }
  /** A prepared request never reached the transport; an explicit SQL rollback proves rejection. */
  async discardUnsentOrRejected() {
    return this.exclusive(async () => {
      const saved = this.read();
      if (!saved || !['prepared', 'rejected'].includes(saved.phase)) throw Error('Ein möglicherweise gespeicherter Vorgang darf nicht verworfen werden.');
      this.deps.storage.removeItem(this.key);
      if (this.deps.storage.getItem(this.key) !== null) throw Error('Der lokale Vorgang konnte nicht freigegeben werden.');
    });
  }
}

export const browserSupplyLock: SupplyJournalLock = async (key, action) => {
  if (typeof navigator === 'undefined' || !navigator.locks) throw Error('Dieser Browser kann die gleichzeitige Übertragung in mehreren Fenstern nicht sicher sperren.');
  return navigator.locks.request(key, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) throw Error('Der Materialvorgang wird in einem anderen Fenster bearbeitet.');
    return action();
  });
};
