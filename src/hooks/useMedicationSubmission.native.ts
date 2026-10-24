// Generated native presentation from src/hooks/useMedicationSubmission.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useEffect, useRef, useState } from 'react';
import { useUnsavedWebChanges } from "./useUnsavedWebChanges.native.ts";
import type { MedicationWriteResult } from '@/lib/pflege/medicationAdministrationService';
import { MedicationRequestState } from '@/lib/pflege/medicationRequestState';
/** A missing acknowledgement freezes one request; retry never creates a second event. */
export function useMedicationSubmission<P extends object>(dirty: boolean, execute: (id: string, payload: P, replay: boolean) => Promise<MedicationWriteResult>, confirmed: () => void | Promise<void>) {
    const requests = useRef(new MedicationRequestState<P>());
    const alive = useRef(true);
    const [busy, setBusy] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const confirmLeave = useUnsavedWebChanges(dirty || uncertain, busy || uncertain);
    async function submit(payload?: P) {
        const request = requests.current.begin(payload);
        if (!request)
            return;
        setBusy(true);
        setError(null);
        try {
            let result: MedicationWriteResult;
            try {
                result = await execute(request.id, request.payload, request.replay);
            }
            catch {
                result = { ok: false, uncertain: true, error: 'Die Speicherbestätigung fehlt. Bitte dieselbe Anfrage erneut prüfen.' };
            }
            if (!alive.current)
                return;
            if (!result.ok) {
                setError(result.error);
                setUncertain(request.replay || result.uncertain === true);
                requests.current.settle(false, result.uncertain);
                return;
            }
            requests.current.settle(true);
            setUncertain(false);
            try {
                await confirmed();
            }
            catch {
                if (alive.current)
                    setError('Gespeichert. Die Ansicht konnte nicht aktualisiert werden; bitte den Verlauf neu laden.');
            }
        }
        finally {
            requests.current.release();
            if (alive.current)
                setBusy(false);
        }
    }
    return { busy, uncertain, error, setError, locked: busy || uncertain, submit, retry: () => submit(), confirmLeave };
}
