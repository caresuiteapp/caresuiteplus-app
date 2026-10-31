// Generated native presentation from src/lib/careAssessment/useAssessmentPathDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmAction } from '@/lib/platform/confirmAction';
import { cloneClientNativeOriginal, sameClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
type Options<D> = {
    initial: D;
    restored: boolean;
    disabled: boolean;
    isCurrent(): boolean;
    isLeaving(): boolean;
    registerLeave(guard: (() => Promise<boolean>) | null): void;
    onDirty(dirty: boolean): void;
    save(draft: D): void;
};
/** Synchronous draft publication prevents a retained callback from crossing a leave or submit flight. */
export function useAssessmentPathDraft<D extends object>(options: Options<D>) {
    const latest = useRef(options);
    latest.current = options;
    const initial = useRef(cloneClientNativeOriginal(options.initial)), draft = useRef(initial.current), live = useRef(true), ownerCheck = useRef(options.isCurrent), generation = useRef(0), lifetime = useRef(0), retired = useRef(false), [, render] = useState(0);
    const [error, setError] = useState(''), [saved, setSaved] = useState(false);
    const current = useCallback(() => { if (!live.current || retired.current)
        return false; try {
        if (!ownerCheck.current() || !latest.current.isCurrent()) {
            retired.current = true;
            return false;
        }
        return true;
    }
    catch {
        retired.current = true;
        return false;
    } }, []);
    const dirty = () => options.restored || !sameClientNativeOriginal(initial.current, draft.current);
    const change = (patch: Partial<D> | ((value: D) => Partial<D>)) => { if (!current() || latest.current.disabled || latest.current.isLeaving())
        return; try {
        draft.current = cloneClientNativeOriginal({ ...draft.current, ...(typeof patch === 'function' ? (patch as (value: D) => Partial<D>)(draft.current) : patch) });
        generation.current++;
        setSaved(false);
        latest.current.onDirty(true);
        render(n => n + 1);
    }
    catch {
        setError('Die lokale Eingabe ist nicht verlustfrei lesbar.');
    } };
    const leave = useCallback(async () => { if (!current())
        return false; const before = generation.current, ownerLifetime = lifetime.current; const changed = latest.current.restored || !sameClientNativeOriginal(initial.current, draft.current); const accepted = !changed || await confirmAction({ title: 'Pfadentwurf verlassen', message: 'Der lokale Pfadentwurf bleibt auf diesem Gerät gesichert. Diesen Bereich verlassen?', confirmLabel: 'Verlassen', cancelLabel: 'Weiter bearbeiten' }); if (!accepted || !current() || before !== generation.current || ownerLifetime !== lifetime.current)
        return false; try {
        if (changed)
            latest.current.save(draft.current);
        return true;
    }
    catch {
        setError('Der Entwurf konnte nicht gesichert werden.');
        return false;
    } }, []);
    useEffect(() => { live.current = true; lifetime.current++; latest.current.onDirty(dirty()); options.registerLeave(leave); return () => { live.current = false; lifetime.current++; options.registerLeave(null); options.onDirty(false); }; }, [options.registerLeave, leave]);
    useEffect(() => { if (options.disabled || !dirty() || !current() || options.isLeaving())
        return; const version = generation.current, ownerLifetime = lifetime.current, timer = setTimeout(() => { if (!current() || version !== generation.current || ownerLifetime !== lifetime.current || latest.current.disabled || latest.current.isLeaving())
        return; try {
        latest.current.save(draft.current);
        setSaved(true);
    }
    catch {
        setError('Der Entwurf konnte nicht gesichert werden.');
    } }, 250); return () => clearTimeout(timer); }, [draft.current, options.disabled]);
    return { draft: draft.current, snapshot: () => cloneClientNativeOriginal(draft.current), dirty: dirty(), change, current, error, saved, setError };
}
