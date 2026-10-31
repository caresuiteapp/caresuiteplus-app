// Generated native presentation from src/lib/careAssessment/carePlanPathWorkspaceWorkflow.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeNavigator as navigator} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { freezeClientNativeOriginal, sameClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import { captureAssessmentWorkspaceJson } from "./assessmentWorkspaceTransport.native.ts";
import { carePlanPathVersion, carePlanPathSupportedWriteKinds, decodeCarePlanPathContext, decodeCarePlanPathReceipt, validateCarePlanPathCommand, validateCarePlanPathWriteCommand, type CarePlanPathCommand, type CarePlanPathContext, type CarePlanPathReceipt } from "./carePlanPathWorkspaceDomain.native.ts";
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
const uuid = (v: unknown): v is string => typeof v === 'string' && v.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const scopeCopy = (input: Scope) => { const scope = captureAssessmentWorkspaceJson(input); if (!scope || Object.keys(scope).sort().join(',') !== 'actorId,assessmentId,tenantId' || ![scope.tenantId, scope.assessmentId, scope.actorId].every(uuid))
    throw Error('Eigener Pflegeplanpfadkontext ist unvollständig.'); return freezeClientNativeOriginal(scope); };
export function carePlanPathJournalKey(input: Scope) { const scope = scopeCopy(input); return `caresuite.carePlanPath-workspace-journal.v2:${scope.tenantId}:${scope.assessmentId}:${scope.actorId}`; }
export function carePlanPathLegacyJournalKey(input: Scope) { const scope = scopeCopy(input); return `caresuite.carePlanPath-workspace-journal.v1:${scope.tenantId}:${scope.assessmentId}:${scope.actorId}`; }
export function decodeCarePlanPathJournal(raw: string, input: Scope) { const scope = scopeCopy(input), journal = captureAssessmentWorkspaceJson(JSON.parse(raw)) as CarePlanPathJournal; if (!journal || Object.keys(journal).sort().join(',') !== 'command,phase,receipt,rejection,scope,version' || journal.version !== carePlanPathVersion || !sameClientNativeOriginal(scopeCopy(journal.scope), scope) || !['prepared', 'dispatched', 'confirmed', 'rejected'].includes(journal.phase))
    throw Error('Gesicherter Pflegeplanpfadvorgang ist beschädigt.'); validateCarePlanPathCommand(journal.command); if (journal.command.tenantId !== scope.tenantId || journal.command.assessmentId !== scope.assessmentId || journal.command.actorId !== scope.actorId)
    throw Error('Die gesicherte Anfrage gehört zu einem anderen eigenen Pflegeplanpfadkontext.'); if (journal.phase === 'confirmed')
    decodeCarePlanPathReceipt(journal.receipt, journal.command);
else if (journal.receipt !== null)
    throw Error('Lokale Bestätigung ist widersprüchlich.'); if (journal.phase === 'rejected' ? (typeof journal.rejection !== 'string' || !journal.rejection.trim() || journal.rejection.length > 4000) : journal.rejection !== null)
    throw Error('Lokaler Transaktionsausgang ist nicht bestätigt.'); return freezeClientNativeOriginal(journal); }
export class CarePlanPathWorkflow {
    private busy = false;
    private journalKey: string;
    private scope: Scope;
    private deps: Dependencies;
    private observed: CarePlanPathCommand | null = null;
    constructor(scope: Scope, deps: Dependencies) { this.scope = scopeCopy(scope); this.deps = deps; this.journalKey = carePlanPathJournalKey(this.scope); }
    private current() { if (this.deps.storage.getItem(carePlanPathLegacyJournalKey(this.scope)) !== null)
        throw Error('Ein früherer Pfadvorgang bleibt gesichert. Seine alte Serverquittung kann über diesen neuen Pfad nicht geprüft werden; neue Änderungen bleiben gesperrt.'); if (this.deps.isCurrent() !== true)
        throw Error('Konto, Mandant oder Pflegeplanpfadrechte wurden geändert.'); }
    read() { this.current(); const raw = this.deps.storage.getItem(this.journalKey); if (raw === null) {
        if (this.observed)
            throw Error('Das bereits beobachtete eigene Journal fehlt; der Ausgang bleibt ungeklärt.');
        return null;
    } const journal = decodeCarePlanPathJournal(raw, this.scope); if (this.observed && !sameClientNativeOriginal(this.observed, journal.command))
        throw Error('Ein anderer Vorgang hat das eigene Journal ersetzt.'); this.observed ??= journal.command; return journal; }
    private same(journal: CarePlanPathJournal) { this.current(); if (!sameClientNativeOriginal(this.read(), journal))
        throw Error('Das eigene Journal wurde zwischenzeitlich verändert.'); }
    private persist(value: CarePlanPathJournal) { this.current(); const raw = JSON.stringify(value); decodeCarePlanPathJournal(raw, this.scope); this.deps.storage.setItem(this.journalKey, raw); if (this.deps.storage.getItem(this.journalKey) !== raw)
        throw Error('Der Vorgang konnte nicht dauerhaft und unverändert gesichert werden.'); this.observed = value.command; }
    private clear(journal: CarePlanPathJournal) { this.same(journal); this.deps.storage.removeItem(this.journalKey); if (this.deps.storage.getItem(this.journalKey) !== null)
        throw Error('Das bestätigte eigene Journal konnte nicht abgeschlossen werden.'); this.observed = null; }
    private async exclusive<T>(action: () => Promise<T>) { if (this.busy)
        throw Error('Ein eigener Pflegeplanpfadvorgang wird bereits geprüft.'); this.busy = true; try {
        return await this.deps.lock(this.journalKey, async () => { this.current(); return action(); });
    }
    finally {
        this.busy = false;
    } }
    async dispatch(input: CarePlanPathCommand) { const command = freezeClientNativeOriginal(captureAssessmentWorkspaceJson(input)); validateCarePlanPathWriteCommand(command); if (!carePlanPathSupportedWriteKinds.some(kind => kind === command.kind))
        throw Error('Diese neue fachliche Handlung ist noch gesperrt.'); if (command.tenantId !== this.scope.tenantId || command.assessmentId !== this.scope.assessmentId || command.actorId !== this.scope.actorId)
        throw Error('Die neue Anfrage gehört zu einem anderen eigenen Pflegeplanpfadkontext.'); return this.exclusive(async () => { if (this.read())
        throw Error('Zuerst den gesicherten Vorgang abgleichen.'); const prepared: CarePlanPathJournal = { version: carePlanPathVersion, scope: this.scope, phase: 'prepared', command, receipt: null, rejection: null }; this.persist(prepared); this.same(prepared); const sent = { ...prepared, phase: 'dispatched' as const }; this.persist(sent); this.same(sent); let result: CarePlanPathResult<CarePlanPathReceipt>; try {
        result = captureAssessmentWorkspaceJson(await this.deps.commit(command));
    }
    catch {
        result = { ok: false, uncertain: true, error: 'Speicherantwort fehlt. Nur die ursprüngliche native Quittung prüfen.' };
    } this.same(sent); if (result.ok) {
        const receipt = decodeCarePlanPathReceipt(result.data, command);
        this.persist({ ...sent, phase: 'confirmed', receipt });
        return { ok: true as const, data: receipt };
    } if (result.rejected === true && result.uncertain !== true)
        this.persist({ ...sent, phase: 'rejected', rejection: result.error }); return result; }); }
    async confirm() { return this.exclusive(async () => { const saved = this.read(); if (!saved || saved.phase !== 'dispatched')
        throw Error('Kein unklar versandter Vorgang vorhanden.'); const result = captureAssessmentWorkspaceJson(await this.deps.confirm(saved.command)); this.same(saved); if (result.ok) {
        const receipt = decodeCarePlanPathReceipt(result.data, saved.command);
        this.persist({ ...saved, phase: 'confirmed', receipt });
        return { ok: true as const, data: receipt };
    } return result; }); }
    async releaseConfirmed(input: CarePlanPathContext) { const context = decodeCarePlanPathContext(input, this.scope); return this.exclusive(async () => { const saved = this.read(); if (!saved || saved.phase !== 'confirmed' || !context.history.events.some(event => sameClientNativeOriginal(event, saved.receipt?.event)))
        throw Error('Der bestätigte eigene Originalbeleg fehlt im vollständigen neu geladenen Verlauf.'); const result = captureAssessmentWorkspaceJson(await this.deps.confirm(saved.command)); this.same(saved); if (!result.ok || !sameClientNativeOriginal(decodeCarePlanPathReceipt(result.data, saved.command), saved.receipt))
        throw Error('Die ursprüngliche eigene Quittung konnte nicht unabhängig bestätigt werden.'); this.clear(saved); }); }
    async discardUnsentOrRejected() { return this.exclusive(async () => { const saved = this.read(); if (!saved || !['prepared', 'rejected'].includes(saved.phase))
        throw Error('Ein möglicherweise gespeicherter Vorgang darf nicht verworfen werden.'); this.clear(saved); }); }
}
export const browserCarePlanPathLock: Lock = async (keyName, action) => { if (typeof navigator === 'undefined' || !navigator.locks)
    throw Error('Dieser Browser kann gleichzeitige eigene Pflegeplanpfadvorgänge nicht sicher sperren.'); return navigator.locks.request(keyName, { mode: 'exclusive', ifAvailable: true }, async (lock) => { if (!lock)
    throw Error('Dieser Vorgang wird in einem anderen Fenster bearbeitet.'); return action(); }); };
