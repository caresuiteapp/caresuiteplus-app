// Generated native presentation from src/lib/careAssessment/useAssessmentNativeDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmAction } from '@/lib/platform/confirmAction';
import { cloneClientNativeOriginal, sameClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
type ReadResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
};
export type AssessmentNativeDraftPhase = {
    busy: boolean;
    dirty: boolean;
    stale: boolean;
    error: string | null;
};
type Options<T, D> = {
    identity: string;
    editable: boolean;
    isCurrent?(): boolean;
    isLeaving?(): boolean;
    read(current: () => boolean): Promise<ReadResult<T>>;
    empty(): D;
    fromNative(value: T): D;
    dirty(value: D, original: T): boolean;
    onPhase?(phase: AssessmentNativeDraftPhase): void;
    registerLeave?(guard: (() => Promise<boolean>) | null): void;
};
type DraftState<T, D> = {
    native: T | null;
    draft: D;
    busy: boolean;
    stale: boolean;
    error: string | null;
};
type Frame<T, D> = {
    identity: string;
    guard: Options<T, D>['isCurrent'];
    retired: boolean;
    live: boolean;
    operation: number;
    flight: boolean;
    state: DraftState<T, D>;
};
/** Own Web draft lifetime, lossless native adoption and explicit discard before refreshing a changed draft. */
export function useAssessmentNativeDraft<T, D>(options: Options<T, D>) {
    const latest = useRef(options);
    latest.current = options;
    const frame = useRef<Frame<T, D> | null>(null), [revision, render] = useState(0);
    const guardCurrent = (guard: Options<T, D>['isCurrent']) => { try {
        return guard ? guard() === true : true;
    }
    catch {
        return false;
    } };
    if (frame.current && (!guardCurrent(frame.current.guard) || !guardCurrent(options.isCurrent)))
        frame.current.retired = true;
    if (!frame.current || frame.current.identity !== options.identity || frame.current.retired && guardCurrent(options.isCurrent)) {
        const previous = frame.current, retained = previous?.identity === options.identity ? previous.state : null;
        if (previous)
            previous.live = false;
        frame.current = { identity: options.identity, guard: options.isCurrent, retired: false, live: true, operation: 0, flight: false, state: retained ? { ...retained, busy: true, stale: true } : { native: null, draft: cloneClientNativeOriginal(options.empty()), busy: true, stale: false, error: null } };
    }
    const own = frame.current;
    const current = () => { if (frame.current !== own || !own.live || own.retired)
        return false; if (!guardCurrent(own.guard) || !guardCurrent(latest.current.isCurrent)) {
        own.retired = true;
        return false;
    } return true; };
    const dirty = () => own.state.native !== null && latest.current.dirty(own.state.draft, own.state.native);
    const publish = () => latest.current.onPhase?.({ busy: own.flight || own.state.busy, dirty: dirty(), stale: own.state.stale, error: own.state.error });
    const update = (patch: Partial<DraftState<T, D>>) => { if (current()) {
        own.state = { ...own.state, ...patch };
        publish();
        render(value => value + 1);
    } };
    const capture = () => ({ identity: own.identity, state: own.state });
    const leave = useCallback(async () => { if (!current() || own.flight || own.state.busy)
        return false; const before = capture(); try {
        const accepted = !dirty() && !own.state.stale || await confirmAction({ title: 'Ungespeicherte Angaben', message: 'Die lokale Auswahl verwerfen und diesen Bereich verlassen?', confirmLabel: 'Verwerfen', cancelLabel: 'Weiter bearbeiten' });
        return accepted && current() && !own.flight && !own.state.busy && sameClientNativeOriginal(before, capture());
    }
    catch {
        return false;
    } }, [own]);
    useEffect(() => { options.registerLeave?.(leave); return () => options.registerLeave?.(null); }, [options.registerLeave, leave, own]);
    const read = async (explicit: boolean, effectCurrent: () => boolean = current) => {
        if (!effectCurrent() || own.flight || latest.current.isLeaving?.())
            return;
        const operation = ++own.operation, operationCurrent = () => effectCurrent() && current() && own.operation === operation, before = capture(), wasDirty = dirty();
        own.flight = true;
        update({ busy: true, error: null });
        try {
            if (explicit && wasDirty) {
                const accepted = await confirmAction({ title: 'Ungespeicherte Angaben', message: 'Die lokale Auswahl verwerfen und den vollständig gelesenen nativen Stand übernehmen?', confirmLabel: 'Verwerfen und neu laden', cancelLabel: 'Weiter bearbeiten' });
                if (!operationCurrent() || latest.current.isLeaving?.() || !sameClientNativeOriginal(before.state.draft, own.state.draft) || !accepted)
                    return;
            }
            const result = await options.read(operationCurrent);
            if (!operationCurrent())
                return;
            if (!result.ok)
                throw Error(result.error);
            const original = cloneClientNativeOriginal(result.data);
            if (wasDirty && !explicit) {
                update({ native: original, stale: true, error: 'Der native Stand wurde erneut gelesen. Die lokalen Angaben bleiben erhalten; vor dem Übernehmen ausdrücklich neu laden.' });
                return;
            }
            update({ native: original, draft: cloneClientNativeOriginal(options.fromNative(original)), stale: false, error: null });
        }
        catch (error) {
            if (operationCurrent())
                update({ stale: true, error: error instanceof Error ? error.message : 'Der native Stand konnte nicht bestätigt werden.' });
        }
        finally {
            if (own.operation === operation) {
                own.flight = false;
                if (operationCurrent())
                    update({ busy: false });
            }
        }
    };
    useEffect(() => { own.live = true; let active = true; void read(false, () => active && current()); return () => { active = false; own.live = false; own.operation++; own.flight = false; }; }, [own]);
    const change = (next: D | ((value: D) => D)) => { if (!current() || !latest.current.editable || own.flight || own.state.busy || own.state.stale || latest.current.isLeaving?.())
        return; try {
        const draft = cloneClientNativeOriginal(typeof next === 'function' ? (next as (value: D) => D)(own.state.draft) : next);
        update({ draft, error: null });
    }
    catch (error) {
        update({ error: error instanceof Error ? error.message : 'Die lokale Eingabe ist nicht verlustfrei lesbar.' });
    } };
    return { ...own.state, revision, dirty: dirty(), current, change, refresh: () => read(true), leave };
}
