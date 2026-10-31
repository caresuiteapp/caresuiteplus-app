// Generated native presentation from src/lib/careAssessment/useAssessmentPathJournals.web.ts. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { assessmentPathJournalKey, assessmentPathLegacyJournalKey } from "./assessmentPathWorkspaceWorkflow.native.ts";
import { carePlanPathJournalKey, carePlanPathLegacyJournalKey } from "./carePlanPathWorkspaceWorkflow.native.ts";
type Scope = {
    tenantId: string;
    assessmentId: string;
    actorId: string;
};
type Presence = {
    assessment: boolean;
    plan: boolean;
};
/** Presence alone blocks other writers; the selected workflow validates the exact retained receipt. */
export function assessmentPathJournalPresence(storage: Pick<Storage, 'getItem'>, scope: Scope): Presence { try {
    const assessment = [assessmentPathJournalKey(scope), assessmentPathLegacyJournalKey(scope)], plan = [carePlanPathJournalKey(scope), carePlanPathLegacyJournalKey(scope)];
    return { assessment: assessment.some(key => storage.getItem(key) !== null), plan: plan.some(key => storage.getItem(key) !== null) };
}
catch {
    return { assessment: true, plan: true };
} }
export function useAssessmentPathJournals(scope: Scope, enabled = true) {
    const window = useNativeWorkflowWindow();
    const key = `${scope.tenantId}:${scope.assessmentId}:${scope.actorId}:${enabled}`, [, render] = useState(0), holder = useRef<{
        key: string;
        reference: {
            current: Presence;
        };
    } | null>(null);
    const inspect = () => { if (!enabled)
        return { assessment: false, plan: false }; try {
        return assessmentPathJournalPresence(window.localStorage, scope);
    }
    catch {
        return { assessment: true, plan: true };
    } };
    if (!holder.current || holder.current.key !== key)
        holder.current = { key, reference: { current: inspect() } };
    const own = holder.current;
    own.reference.current = inspect();
    const refresh = useCallback(() => { if (holder.current === own) {
        own.reference.current = inspect();
        render(n => n + 1);
    } return own.reference.current; }, [own]);
    useEffect(() => { if (typeof window === 'undefined')
        return; refresh(); let keys: string[]; try {
        keys = [assessmentPathJournalKey(scope), assessmentPathLegacyJournalKey(scope), carePlanPathJournalKey(scope), carePlanPathLegacyJournalKey(scope)];
    }
    catch {
        return;
    } const changed = (event: StorageEvent) => { if (event.key === null || keys.includes(event.key))
        refresh(); }; window.addEventListener('storage', changed); return () => window.removeEventListener('storage', changed); }, [refresh]);
    return { ...own.reference.current, reference: own.reference, refresh };
}
