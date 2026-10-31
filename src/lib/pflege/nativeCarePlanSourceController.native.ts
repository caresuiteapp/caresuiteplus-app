// Generated native presentation from src/lib/pflege/nativeCarePlanSourceController.web.ts. Update through scripts/port-native-workspaces.mjs.
import { sameClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import type { NativeCarePlanSourceResult, NativeCarePlanSourceSnapshot } from "./nativeCarePlanSourceRepository.native.ts";
type State = Readonly<{
    loading: boolean;
    snapshot: NativeCarePlanSourceSnapshot | null;
    error: string | null;
}>;
const denied = 'Der eigene gespeicherte SIS-Bezug ist nicht mehr aktuell. Bitte neu laden.';
/** Own lifecycle and latest-read barrier; an old or copied screen projection cannot navigate. */
export function createNativeCarePlanSourceController(options: {
    isCurrent(): boolean;
    read(): Promise<NativeCarePlanSourceResult>;
}) {
    let alive = false, retired = false, serial = 0;
    let state: State = Object.freeze({ loading: false, snapshot: null, error: null });
    const current = () => {
        try {
            if (alive && !retired && options.isCurrent() === true)
                return true;
        }
        catch { /* Fail closed. */ }
        if (alive)
            retired = true;
        return false;
    };
    const set = (next: State) => { state = Object.freeze(next); };
    const perform = async (navigation: boolean): Promise<string | null> => {
        if (!current() || state.loading)
            return null;
        const previous = state.snapshot, ticket = ++serial;
        if (navigation && !previous?.assessment)
            return null;
        set({ loading: true, snapshot: null, error: null });
        try {
            const result = await options.read();
            if (!current() || ticket !== serial)
                return null;
            if (!result.ok) {
                set({ loading: false, snapshot: null, error: result.error });
                return null;
            }
            if (navigation && !sameClientNativeOriginal(previous, result.data)) {
                set({ loading: false, snapshot: null, error: 'Der gespeicherte Pflegeplan- oder SIS-Stand wurde geändert. Vor dem Öffnen neu laden.' });
                return null;
            }
            set({ loading: false, snapshot: result.data, error: null });
            return navigation && result.data.assessment ? String(result.data.assessment.id) : null;
        }
        catch {
            if (current() && ticket === serial)
                set({ loading: false, snapshot: null, error: denied });
            return null;
        }
    };
    return Object.freeze({
        mount() { if (!retired)
            alive = true; },
        dispose() { alive = false; serial++; set({ loading: false, snapshot: null, error: null }); },
        current,
        state(): State { return current() ? state : Object.freeze({ loading: false, snapshot: null, error: denied }); },
        refresh: () => perform(false),
        sourceForNavigation: () => perform(true),
    });
}
