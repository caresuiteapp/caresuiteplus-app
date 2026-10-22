import React, { useCallback, useEffect, useRef, useState } from 'react';
import { requestKimHost } from '@/lib/gkvExchange/repository.web';
import type { KimHostStatus } from '@/lib/gkvExchange/kimHostContract';
import type { RoleKey } from '@/types';

const labels = { unconfigured: 'Host noch nicht angebunden', ready: 'Bereit für die Anschlussprüfung', running: 'Kartenprüfung läuft',
  passed: 'Kryptografischer Durchlauf erfolgreich', failed: 'Prüfung angehalten', interrupted: 'Ausgang des Durchlaufs ungeklärt' };
const operations: Record<string, string> = { GetJobNumber: 'Signaturauftrag anlegen', SignDocument: 'CMS-Signatur prüfen', EncryptDocument: 'Testinhalt verschlüsseln', DecryptDocument: 'Mit Karte entschlüsseln und vergleichen' };
const dateTime = (n: number) => new Date(n).toLocaleString('de-DE');
export function KimHostPanel({ tenantId, roleKey, canCheck }: { tenantId: string; roleKey: RoleKey; canCheck: boolean }) {
  const [status, setStatus] = useState<KimHostStatus | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef<AbortController | null>(null), mounted = useRef(false), requestId = useRef<string | undefined>(undefined);
  const load = useCallback(async (action: 'status' | 'start') => {
    if (!canCheck || active.current) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError('');
    try {
      if (action === 'start') requestId.current ??= crypto.randomUUID();
      const value = await requestKimHost(tenantId, roleKey, action, action === 'start' ? requestId.current : undefined,
        AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]));
      if (mounted.current && !controller.signal.aborted) { setStatus(value); if (action === 'start' || value.requestId === requestId.current) requestId.current = undefined; }
    } catch (reason) {
      if (mounted.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Der Prüfstatus konnte nicht geladen werden.');
    } finally { if (active.current === controller) { active.current = null; if (mounted.current) setBusy(false); } }
  }, [tenantId, roleKey, canCheck]);
  useEffect(() => { mounted.current = true; setStatus(null); requestId.current = undefined; void load('status');
    return () => { mounted.current = false; active.current?.abort(); active.current = null; };
  }, [load]);
  useEffect(() => {
    if (status?.state !== 'running' || error) return;
    const timer = setTimeout(() => void load('status'), 2500); return () => clearTimeout(timer);
  }, [status, error, load]);
  const download = () => {
    if (!status?.report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(status, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `CareSuite-Konnektorpruefung-${status.report.runId}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="gx-card gx-stack" aria-labelledby="gx-kim-host-title">
    <div><h2 id="gx-kim-host-title">Konnektor und Kartenprüfung</h2><p className="gx-muted">Der angeschlossene Dienst signiert einen neu erzeugten Testinhalt, verschlüsselt ihn und entschlüsselt ihn mit der ausgewählten SMC-B. Das Ergebnis wird mit dem Original verglichen.</p></div>
    {!canCheck ? <p className="gx-subtle">Für die Anschlussprüfung werden Lese- und Erstellungsrechte für Abrechnungen benötigt.</p> : <>
      {error && <div className="gx-notice" data-tone="error" role="alert">{error}</div>}
      <div className="gx-kim-status" role="status" aria-live="polite">
        <strong>{status ? labels[status.state] : busy ? 'Prüfstatus wird geladen …' : 'Prüfstatus noch nicht verfügbar'}</strong>
        {status?.environment && <span className="gx-badge">{status.environment === 'test' ? 'Testumgebung' : 'Produktionsumgebung · Diagnose'}</span>}
      </div>
      {status?.state === 'unconfigured' && <p>Für diesen Zugang ist noch kein Konnektorhost eingerichtet. Nach der serverseitigen Anbindung lässt sich der Anschluss hier prüfen.</p>}
      {status?.state === 'ready' && <p>Die SMC-B muss am Kartenterminal bereits freigeschaltet sein. Der Durchlauf verwendet ausschließlich einen synthetischen Testinhalt.</p>}
      {status?.state === 'running' && <p>Der Host führt die Prüfung aus. Der Status wird automatisch aktualisiert. Beim Verlassen dieser Ansicht läuft die Prüfung am Host weiter.</p>}
      {status && ['failed','interrupted'].includes(status.state) && <div className="gx-subtle">
        <p>{status.errorCode === 'KIM_CONNECTOR_PIN_NOT_VERIFIED' ? 'Die Karte ist nicht freigeschaltet. Bitte den PIN-Status am Kartenterminal prüfen.' : 'Der Durchlauf wurde nicht vollständig bestätigt. Die Administration muss den Host und den Kartenstatus prüfen, bevor ein neuer Durchlauf freigegeben wird.'}</p>
        {status.errorCode && <small>Prüfcode: {status.errorCode}</small>}
      </div>}
      <div className="gx-actions">
        <button type="button" disabled={busy} onClick={() => void load('status')}>Prüfstatus abfragen</button>
        <button type="button" className="gx-primary" disabled={busy || !status?.canStart} onClick={() => void load('start')}>Kartenprüfung starten</button>
        {status?.report && <button type="button" onClick={download}>Prüfprotokoll herunterladen</button>}
      </div>
      {status?.report && <div className="gx-stack"><p>Abgeschlossen am {dateTime(status.report.completedAt)}. Der Nachweis gilt für diesen einzelnen Durchlauf.</p>
        <ol className="gx-kim-checks">{status.report.transcript.map(step => <li key={step.operation}><span>{operations[step.operation]}</span><span className="gx-badge" data-tone="ok">Bestätigt</span></li>)}</ol>
        <details><summary>Zuordnung des Prüfprotokolls</summary><dl className="gx-kim-proof"><dt>Durchlauf</dt><dd>{status.report.runId}</dd><dt>Protokoll-Hash</dt><dd>{status.report.transcriptSha256}</dd></dl></details>
      </div>}
    </>}
    <div className="gx-ready"><article><h3>Hardware-Nachweis</h3><p>Eine unabhängige Bestätigung des Konnektors, Kartenterminals und der verwendeten Karte liegt hier noch nicht vor.</p></article>
      <article><h3>TI- und Versandnachweis</h3><p>TI-Abnahme, Zulassung und ein bestätigter Echtversand bleiben gesondert nachzuweisen. Diese Prüfung versendet keine Nachricht.</p></article></div>
  </section>;
}
