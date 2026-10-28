// Generated native presentation from src/lib/careAssessment/carePlanPathWorkspaceWorkflow.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone,nativeNavigator as navigator} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { carePlanPathVersion, decodeCarePlanPathReceipt, validateCarePlanPathCommand, type CarePlanPathCommand, type CarePlanPathReceipt } from "./carePlanPathWorkspaceDomain.native.ts";
import type { CarePlanPathResult } from "./carePlanPathWorkspaceRepository.native.ts";
type Scope = {
    tenantId: string;
    assessmentId: string;
    actorId: string;
};
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type CarePlanPathJournal = {
    version: typeof carePlanPathVersion;
    scope: Scope;
    phase: 'prepared' | 'dispatched' | 'confirmed' | 'rejected';
    command: CarePlanPathCommand;
    receipt: CarePlanPathReceipt | null;
    rejection: string | null;
};
type Lock = <T>(key: string, action: () => Promise<T>) => Promise<T>;
type Dependencies = {
    storage: Store;
    lock: Lock;
    isCurrent(): boolean;
    commit(command: CarePlanPathCommand): Promise<CarePlanPathResult<CarePlanPathReceipt>>;
    confirm(command: CarePlanPathCommand): Promise<CarePlanPathResult<CarePlanPathReceipt>>;
};
const key = (scope: Scope) => `caresuite.carePlanPath-workspace-journal.v1:${scope.tenantId}:${scope.assessmentId}:${scope.actorId}`;
export function decodeCarePlanPathJournal(raw: string, scope: Scope) { const value: unknown = JSON.parse(raw); if (typeof value !== 'object' || value === null)
    throw Error('Gesicherter Pflegeplanpfadvorgang ist beschädigt.'); const journal = value as CarePlanPathJournal; if (journal.version !== carePlanPathVersion || JSON.stringify(journal.scope) !== JSON.stringify(scope) || !['prepared', 'dispatched', 'confirmed', 'rejected'].includes(journal.phase))
    throw Error('Gesicherter Pflegeplanpfadvorgang ist beschädigt.'); validateCarePlanPathCommand(journal.command); if (journal.phase === 'confirmed')
    decodeCarePlanPathReceipt(journal.receipt, journal.command);
else if (journal.receipt !== null)
    throw Error('Lokale Pflegeplanpfadbestätigung ist widersprüchlich.'); return structuredClone(journal); }
export class CarePlanPathWorkflow {
    private busy = false;
    private journalKey: string;
    private scope: Scope;
    private deps: Dependencies;
    constructor(scope: Scope, deps: Dependencies) { this.scope = scope; this.deps = deps; this.journalKey = key(scope); }
    read() { const raw = this.deps.storage.getItem(this.journalKey); return raw === null ? null : decodeCarePlanPathJournal(raw, this.scope); }
    private current() { if (!this.deps.isCurrent())
        throw Error('Konto, Mandant oder Pflegeplanpfadrechte wurden geändert. Vorgang neu öffnen.'); }
    private persist(value: CarePlanPathJournal) { const raw = JSON.stringify(value); this.deps.storage.setItem(this.journalKey, raw); if (this.deps.storage.getItem(this.journalKey) !== raw)
        throw Error('Pflegeplanpfadvorgang konnte nicht zuverlässig gesichert werden.'); decodeCarePlanPathJournal(raw, this.scope); }
    private async exclusive<T>(action: () => Promise<T>) { if (this.busy)
        throw Error('Ein Pflegeplanpfadvorgang wird bereits geprüft.'); this.busy = true; try {
        return await this.deps.lock(this.journalKey, async () => { this.current(); return action(); });
    }
    finally {
        this.busy = false;
    } }
    async dispatch(command: CarePlanPathCommand) { const copy = structuredClone(command); validateCarePlanPathCommand(copy); return this.exclusive(async () => { if (this.read())
        throw Error('Zuerst den gesicherten Pflegeplanpfadvorgang abgleichen.'); const prepared: CarePlanPathJournal = { version: carePlanPathVersion, scope: structuredClone(this.scope), phase: 'prepared', command: copy, receipt: null, rejection: null }; this.persist(prepared); const sent = { ...prepared, phase: 'dispatched' as const }; this.persist(sent); let result: CarePlanPathResult<CarePlanPathReceipt>; try {
        result = await this.deps.commit(structuredClone(copy));
    }
    catch {
        result = { ok: false, uncertain: true, error: 'Speicherantwort fehlt. Nur native Quittung prüfen.' };
    } this.current(); if (result.ok) {
        this.persist({ ...sent, phase: 'confirmed', receipt: decodeCarePlanPathReceipt(result.data, copy) });
        return result;
    } if (result.rejected === true && result.uncertain !== true)
        this.persist({ ...sent, phase: 'rejected', rejection: result.error }); return result; }); }
    async confirm() { return this.exclusive(async () => { const saved = this.read(); if (!saved || saved.phase !== 'dispatched')
        throw Error('Kein unklar versandter Vorgang vorhanden.'); const result = await this.deps.confirm(structuredClone(saved.command)); this.current(); if (result.ok)
        this.persist({ ...saved, phase: 'confirmed', receipt: decodeCarePlanPathReceipt(result.data, saved.command) }); return result; }); }
    async releaseConfirmed(events: unknown[]) { return this.exclusive(async () => { const saved = this.read(); if (!saved || saved.phase !== 'confirmed' || !events.some(event => JSON.stringify(event) === JSON.stringify(saved.receipt?.event)))
        throw Error('Bestätigter Originalbeleg fehlt im vollständig neu geladenen Verlauf.'); this.deps.storage.removeItem(this.journalKey); }); }
    async discardUnsentOrRejected() { return this.exclusive(async () => { const saved = this.read(); if (!saved || !['prepared', 'rejected'].includes(saved.phase))
        throw Error('Möglicherweise gespeicherter Vorgang darf nicht verworfen werden.'); this.deps.storage.removeItem(this.journalKey); }); }
}
export const browserCarePlanPathLock: Lock = async (keyName, action) => { if (typeof navigator === 'undefined' || !navigator.locks)
    throw Error('Dieser Browser kann gleichzeitige Pflegeplanpfadvorgänge nicht sicher sperren.'); return navigator.locks.request(keyName, { mode: 'exclusive', ifAvailable: true }, async (lock) => { if (!lock)
    throw Error('Pflegeplanpfadvorgang wird in einem anderen Fenster bearbeitet.'); return action(); }); };
