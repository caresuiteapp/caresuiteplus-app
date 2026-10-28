// Generated native presentation from src/lib/organization/organizationLifecycleWorkspaceWorkflow.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone,nativeNavigator as navigator} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { organizationLifecycleVersion, decodeOrganizationLifecycleReceipt, validateOrganizationLifecycleCommand, type OrganizationLifecycleCommand, type OrganizationLifecycleReceipt } from "./organizationLifecycleWorkspaceDomain.native.ts";
import type { OrganizationLifecycleResult } from "./organizationLifecycleWorkspaceRepository.native.ts";
type Scope = {
    tenantId: string;
    actorId: string;
};
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type OrganizationLifecycleJournal = {
    version: typeof organizationLifecycleVersion;
    scope: Scope;
    phase: 'prepared' | 'dispatched' | 'confirmed' | 'rejected';
    command: OrganizationLifecycleCommand;
    receipt: OrganizationLifecycleReceipt | null;
    rejection: string | null;
};
type Lock = <T>(key: string, action: () => Promise<T>) => Promise<T>;
type Dependencies = {
    storage: Store;
    lock: Lock;
    isCurrent(): boolean;
    commit(command: OrganizationLifecycleCommand): Promise<OrganizationLifecycleResult<OrganizationLifecycleReceipt>>;
    confirm(command: OrganizationLifecycleCommand): Promise<OrganizationLifecycleResult<OrganizationLifecycleReceipt>>;
};
const key = (scope: Scope) => `caresuite.organizationLifecycle-workspace-journal.v1:${scope.tenantId}:${scope.actorId}`;
export function decodeOrganizationLifecycleJournal(raw: string, scope: Scope) { const value: unknown = JSON.parse(raw); if (typeof value !== 'object' || value === null)
    throw Error('Gesicherter Organisations- und Stammdatenvorgang ist beschädigt.'); const journal = value as OrganizationLifecycleJournal; if (journal.version !== organizationLifecycleVersion || JSON.stringify(journal.scope) !== JSON.stringify(scope) || !['prepared', 'dispatched', 'confirmed', 'rejected'].includes(journal.phase))
    throw Error('Gesicherter Organisations- und Stammdatenvorgang ist beschädigt.'); validateOrganizationLifecycleCommand(journal.command); if (journal.phase === 'confirmed')
    decodeOrganizationLifecycleReceipt(journal.receipt, journal.command);
else if (journal.receipt !== null)
    throw Error('Lokale Organisations- und Stammdatenbestätigung ist widersprüchlich.'); return structuredClone(journal); }
export class OrganizationLifecycleWorkflow {
    private busy = false;
    private journalKey: string;
    private scope: Scope;
    private deps: Dependencies;
    constructor(scope: Scope, deps: Dependencies) { this.scope = scope; this.deps = deps; this.journalKey = key(scope); }
    read() { const raw = this.deps.storage.getItem(this.journalKey); return raw === null ? null : decodeOrganizationLifecycleJournal(raw, this.scope); }
    private current() { if (!this.deps.isCurrent())
        throw Error('Konto, Mandant oder Organisations- und Stammdatenrechte wurden geändert. Vorgang neu öffnen.'); }
    private persist(value: OrganizationLifecycleJournal) { const raw = JSON.stringify(value); this.deps.storage.setItem(this.journalKey, raw); if (this.deps.storage.getItem(this.journalKey) !== raw)
        throw Error('Organisations- und Stammdatenvorgang konnte nicht zuverlässig gesichert werden.'); decodeOrganizationLifecycleJournal(raw, this.scope); }
    private async exclusive<T>(action: () => Promise<T>) { if (this.busy)
        throw Error('Ein Organisations- und Stammdatenvorgang wird bereits geprüft.'); this.busy = true; try {
        return await this.deps.lock(this.journalKey, async () => { this.current(); return action(); });
    }
    finally {
        this.busy = false;
    } }
    async dispatch(command: OrganizationLifecycleCommand) { const copy = structuredClone(command); validateOrganizationLifecycleCommand(copy); return this.exclusive(async () => { if (this.read())
        throw Error('Zuerst den gesicherten Organisations- und Stammdatenvorgang abgleichen.'); const prepared: OrganizationLifecycleJournal = { version: organizationLifecycleVersion, scope: structuredClone(this.scope), phase: 'prepared', command: copy, receipt: null, rejection: null }; this.persist(prepared); const sent = { ...prepared, phase: 'dispatched' as const }; this.persist(sent); let result: OrganizationLifecycleResult<OrganizationLifecycleReceipt>; try {
        result = await this.deps.commit(structuredClone(copy));
    }
    catch {
        result = { ok: false, uncertain: true, error: 'Speicherantwort fehlt. Nur native Quittung prüfen.' };
    } this.current(); if (result.ok) {
        this.persist({ ...sent, phase: 'confirmed', receipt: decodeOrganizationLifecycleReceipt(result.data, copy) });
        return result;
    } if (result.rejected === true && result.uncertain !== true)
        this.persist({ ...sent, phase: 'rejected', rejection: result.error }); return result; }); }
    async confirm() { return this.exclusive(async () => { const saved = this.read(); if (!saved || saved.phase !== 'dispatched')
        throw Error('Kein unklar versandter Vorgang vorhanden.'); const result = await this.deps.confirm(structuredClone(saved.command)); this.current(); if (result.ok)
        this.persist({ ...saved, phase: 'confirmed', receipt: decodeOrganizationLifecycleReceipt(result.data, saved.command) }); return result; }); }
    async releaseConfirmed(events: unknown[]) { return this.exclusive(async () => { const saved = this.read(); if (!saved || saved.phase !== 'confirmed' || !events.some(event => JSON.stringify(event) === JSON.stringify(saved.receipt?.event)))
        throw Error('Bestätigter Originalbeleg fehlt im vollständig neu geladenen Verlauf.'); this.deps.storage.removeItem(this.journalKey); }); }
    async discardUnsentOrRejected() { return this.exclusive(async () => { const saved = this.read(); if (!saved || !['prepared', 'rejected'].includes(saved.phase))
        throw Error('Möglicherweise gespeicherter Vorgang darf nicht verworfen werden.'); this.deps.storage.removeItem(this.journalKey); }); }
}
export const browserOrganizationLifecycleLock: Lock = async (keyName, action) => { if (typeof navigator === 'undefined' || !navigator.locks)
    throw Error('Dieser Browser kann gleichzeitige Organisations- und Stammdatenvorgänge nicht sicher sperren.'); return navigator.locks.request(keyName, { mode: 'exclusive', ifAvailable: true }, async (lock) => { if (!lock)
    throw Error('Organisations- und Stammdatenvorgang wird in einem anderen Fenster bearbeitet.'); return action(); }); };
