import { useEffect, useRef } from 'react';
import { useMedicationSubmission } from '@/hooks/useMedicationSubmission.web';
import type { MedicationWriteResult } from '@/lib/pflege/medicationAdministrationService';

/** A read outage pauses a mounted form without discarding its original request identity. */
export function useWoundSubmission<P extends object>(dirty: boolean, canSubmit: boolean,
  execute: (id: string, payload: P, replay: boolean) => Promise<MedicationWriteResult>, confirmed: () => void | Promise<void>) {
  const allowed = useRef(canSubmit === true); allowed.current = canSubmit === true;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const message = 'Der aktuelle Zugriff auf diese Bearbeitung fehlt. Ihre Eingaben und eine unbestätigte Anfrage bleiben bis zur Wiederherstellung des Zugriffs erhalten.';
  const write = useMedicationSubmission<P>(dirty, async (id, payload, replay) => {
    if (!alive.current || !allowed.current) return { ok: false, error: message };
    return execute(id, payload, replay);
  }, confirmed);
  const latest = useRef(write); latest.current = write;
  const flight = useRef(false);
  function maySubmit() { if (!alive.current) return false; if (allowed.current) return true; write.setError(message); return false; }
  async function submit(payload?: P) {
    if (!maySubmit() || flight.current) return;
    flight.current = true;
    try { await latest.current.submit(payload); } finally { flight.current = false; }
  }
  async function retry() { await submit(); }
  async function confirmLeave() {
    if (!alive.current || flight.current || latest.current.locked) return false;
    const accepted = await latest.current.confirmLeave();
    return alive.current && !flight.current && !latest.current.locked && accepted;
  }
  return { ...write, submit, retry, confirmLeave };
}
