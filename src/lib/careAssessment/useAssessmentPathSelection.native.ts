// Generated native presentation from src/lib/careAssessment/useAssessmentPathSelection.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssessmentPathIntegration, AssessmentPathPhase } from "./useAssessmentPathOwnership.native.ts";
type Path = 'assessment' | 'plan';
/** A single mounted editor owns the enclosing history section and its navigation guard. */
export function useAssessmentPathSelection(options: AssessmentPathIntegration & {
    identity: string;
    initial?: Path;
}) {
    const latest = useRef(options);
    latest.current = options;
    const [selected, setSelected] = useState<Path>(options.initial ?? 'assessment'), holder = useRef<{
        identity: string;
        guard: typeof options.isCurrent;
        live: boolean;
        retired: boolean;
        flight: boolean;
        number: number;
        child: (() => Promise<boolean>) | null;
        phase: AssessmentPathPhase;
    } | null>(null);
    const valid = (guard: typeof options.isCurrent) => { try {
        return !guard || guard() === true;
    }
    catch {
        return false;
    } };
    if (holder.current && (!valid(holder.current.guard) || !valid(options.isCurrent)))
        holder.current.retired = true;
    if (!holder.current || holder.current.identity !== options.identity || holder.current.retired && valid(options.isCurrent)) {
        if (holder.current)
            holder.current.live = false;
        holder.current = { identity: options.identity, guard: options.isCurrent, live: true, retired: false, flight: false, number: 0, child: null, phase: { busy: false, dirty: false, uncertain: false } };
    }
    const own = holder.current;
    const current = useCallback(() => { if (holder.current !== own || !own.live || own.retired)
        return false; if (!valid(own.guard) || !valid(latest.current.isCurrent)) {
        own.retired = true;
        return false;
    } return true; }, [own]);
    const leaving = useCallback(() => own.flight || latest.current.isLeaving?.() === true, [own]);
    const report = () => latest.current.onPhase?.({ ...own.phase, busy: own.flight || own.phase.busy });
    const registerChild = useCallback((guard: (() => Promise<boolean>) | null) => { if (holder.current === own)
        own.child = guard; }, [own]);
    const onPhase = useCallback((phase: AssessmentPathPhase) => { if (current()) {
        own.phase = phase;
        report();
    } }, [own]);
    const attempt = useCallback(async (next?: Path) => { if (!current() || own.flight || own.phase.busy || own.phase.uncertain)
        return false; const child = own.child, number = ++own.number; own.flight = true; report(); try {
        const accepted = (!child || await child()) && current() && number === own.number && own.child === child && !own.phase.uncertain && (!next || latest.current.isLeaving?.() !== true);
        if (accepted && next) {
            own.child = null;
            own.phase = { busy: false, dirty: false, uncertain: false };
            setSelected(next);
        }
        return accepted;
    }
    finally {
        if (number === own.number) {
            own.flight = false;
            if (current())
                report();
        }
    } }, [own]);
    const leave = useCallback(() => attempt(), [own]);
    const change = async (next: Path) => { if (next !== selected && !leaving())
        await attempt(next); };
    useEffect(() => { own.live = true; options.registerLeave?.(leave); return () => { own.live = false; own.number++; options.registerLeave?.(null); options.onPhase?.({ busy: false, dirty: false, uncertain: false }); }; }, [own, options.registerLeave, leave]);
    return { selected, change, current, isLeaving: leaving, registerChild, onPhase, ownerToken: own };
}
