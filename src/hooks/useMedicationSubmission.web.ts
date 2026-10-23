import { useEffect, useRef, useState } from 'react';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import type { MedicationWriteResult } from '@/lib/pflege/medicationAdministrationService';
import { MedicationRequestState } from '@/lib/pflege/medicationRequestState';

/** A missing acknowledgement freezes one request; retry never creates a second event. */
export function useMedicationSubmission<P extends object>(dirty: boolean, execute: (id: string, payload: P, replay: boolean) => Promise<MedicationWriteResult>, confirmed: () => void | Promise<void>, captureLeave?: () => (() => boolean) | null) {
  const requests = useRef(new MedicationRequestState<P>());
  const alive = useRef(true);
  const phase = useRef({ busy: false, uncertain: false });
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const confirmLeave = useUnsavedWebChanges(dirty || uncertain, busy || uncertain, undefined, () => {
    if (phase.current.busy || phase.current.uncertain) return null;
    const original = captureLeave ? captureLeave() : () => true;
    if (!original) return null;
    return () => !phase.current.busy && !phase.current.uncertain && original();
  });
  async function submit(payload?: P) {
    const request = requests.current.begin(payload);
    if (!request) return;
    phase.current.busy = true; setBusy(true); setError(null);
    try {
      let result: MedicationWriteResult;
      try { result = await execute(request.id, request.payload, request.replay); }
      catch { result = { ok: false, uncertain: true, error: 'Die Speicherbestätigung fehlt. Bitte dieselbe Anfrage erneut prüfen.' }; }
      if (!alive.current) return;
      if (!result.ok) {
        phase.current.uncertain = request.replay || result.uncertain === true;
        setError(result.error); setUncertain(phase.current.uncertain);
        requests.current.settle(false, result.uncertain);
        return;
      }
      requests.current.settle(true); phase.current.uncertain = false; setUncertain(false);
      try { await confirmed(); }
      catch { if (alive.current) setError('Gespeichert. Die Ansicht konnte nicht aktualisiert werden; bitte den Verlauf neu laden.'); }
    } finally { requests.current.release(); phase.current.busy = false; if (alive.current) setBusy(false); }
  }
  return { busy, uncertain, error, setError, locked: busy || uncertain, submit, retry: () => submit(), confirmLeave };
}
