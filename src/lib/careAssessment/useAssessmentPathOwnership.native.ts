// Generated native presentation from src/lib/careAssessment/useAssessmentPathOwnership.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useCallback, useEffect, useRef } from 'react';
export type AssessmentPathPhase = {
    busy: boolean;
    dirty: boolean;
    uncertain: boolean;
    revision?: number;
};
export type AssessmentPathIntegration = {
    blocked?: boolean;
    isCurrent?(): boolean;
    isLeaving?(): boolean;
    registerLeave?(guard: (() => Promise<boolean>) | null): void;
    onPhase?(phase: AssessmentPathPhase): void;
};
type Options = AssessmentPathIntegration & {
    owner: object;
    current(): boolean;
    onBusy(busy: boolean): void;
    initiallyReady?: boolean;
};
/** Each editor, local journal and pending response retain their original authority lifetime. */
export function useAssessmentPathOwnership(options: Options) {
    const latest = useRef(options);
    latest.current = options;
    const holder = useRef<{
        owner: object;
        guard: () => boolean | Promise<boolean>;
        retired: boolean;
        live: boolean;
        operation: number;
        running: boolean;
        leaving: boolean;
        journal: boolean;
        ready: boolean;
        dirty: boolean;
        draftRevision: number;
        editorLeave: (() => Promise<boolean>) | null;
        phase: string;
    } | null>(null);
    const valid = (guard: () => boolean | Promise<boolean>) => { try {
        return guard() === true;
    }
    catch {
        return false;
    } };
    if (holder.current && (!valid(holder.current.guard) || !valid(options.current)))
        holder.current.retired = true;
    if (!holder.current || holder.current.owner !== options.owner || holder.current.retired && valid(options.current)) {
        if (holder.current)
            holder.current.live = false;
        holder.current = { owner: options.owner, guard: options.current, retired: false, live: true, operation: 0, running: false, leaving: false, journal: false, ready: options.initiallyReady !== false, dirty: false, draftRevision: 0, editorLeave: null, phase: '' };
    }
    const own = holder.current;
    const current = useCallback(() => { if (holder.current !== own || !own.live || own.retired)
        return false; if (!valid(own.guard) || !valid(latest.current.current)) {
        own.retired = true;
        return false;
    } return true; }, [own]);
    const report = () => { const phase = { busy: own.running || own.leaving, dirty: own.dirty, uncertain: own.journal, revision: own.draftRevision }, key = JSON.stringify(phase); if (own.phase !== key) {
        own.phase = key;
        latest.current.onPhase?.(phase);
    } };
    const isLeaving = useCallback(() => own.leaving || latest.current.isLeaving?.() === true, [own]);
    const setJournal = useCallback((blocked: boolean) => { if (current()) {
        own.journal = blocked;
        report();
    } }, [own]);
    const setReady = useCallback((ready: boolean) => { if (current())
        own.ready = ready; }, [own]);
    const editorState = useCallback((dirty: boolean) => { if (current()) {
        own.dirty = dirty;
        own.draftRevision++;
        report();
    } }, [own]);
    const registerEditorLeave = useCallback((guard: (() => Promise<boolean>) | null) => { if (holder.current === own)
        own.editorLeave = guard; }, [own]);
    const leave = useCallback(async () => { if (!current() || own.running || own.journal || own.leaving)
        return false; const before = own.editorLeave, operation = ++own.operation; own.leaving = true; report(); try {
        const accepted = !before || await before();
        return accepted && current() && own.operation === operation && !own.running && !own.journal && own.editorLeave === before;
    }
    finally {
        if (own.operation === operation) {
            own.leaving = false;
            if (current())
                report();
        }
    } }, [own]);
    useEffect(() => { own.live = true; if (current())
        latest.current.onBusy(own.running); own.phase = ''; report(); options.registerLeave?.(leave); return () => { own.live = false; own.operation++; own.running = false; own.leaving = false; options.registerLeave?.(null); options.onPhase?.({ busy: false, dirty: false, uncertain: false }); }; }, [own, options.registerLeave, leave]);
    const run = useCallback(async (action: (current: () => boolean) => Promise<void>, write = false) => { if (!current() || own.running || isLeaving() || write && (latest.current.blocked || own.journal || !own.ready))
        return; const operation = ++own.operation, operationCurrent = () => current() && own.operation === operation; own.running = true; latest.current.onBusy(true); report(); try {
        await action(operationCurrent);
    }
    finally {
        if (own.operation === operation) {
            own.running = false;
            if (current()) {
                latest.current.onBusy(false);
                report();
            }
        }
    } }, [own]);
    return { current, ownerToken: own, isLeaving, setJournal, setReady, editorState, registerEditorLeave, leave, run };
}
