import React, { useCallback, useEffect, useRef, useState } from 'react';
import { requestKimHost } from '@/lib/gkvExchange/repository.web';
import type { KimHostStatus } from '@/lib/gkvExchange/kimHostContract';
import type { RoleKey } from '@/types';
import { KimReceivePanel } from './GkvKimReceive.web';

const labels = { unconfigured: 'Host noch nicht angebunden', ready: 'Bereit für die Anschlussprüfung', running: 'Kartenprüfung läuft',
  passed: 'Kryptografischer Durchlauf erfolgreich', failed: 'Prüfung angehalten', interrupted: 'Ausgang des Durchlaufs ungeklärt' };
const operations: Record<string, string> = { GetJobNumber: 'Signaturauftrag anlegen', SignDocument: 'CMS-Signatur prüfen', EncryptDocument: 'Testinhalt verschlüsseln', DecryptDocument: 'Mit Karte entschlüsseln und vergleichen', VerifyDocument: 'Signatur durch Konnektor bestätigen' };
const verificationErrors: Record<string, string> = {
  KIM_CONNECTOR_CMS_VERIFY_INVALID: 'Der Konnektor hat die Signatur als ungültig bewertet.',
  KIM_CONNECTOR_CMS_VERIFY_INCONCLUSIVE: 'Der Konnektor konnte die Signaturprüfung nicht vollständig abschließen.',
  KIM_CONNECTOR_CMS_VERIFY_INCONSISTENT: 'Die Einzelprüfungen im Konnektorbericht bestätigen das Gesamtergebnis nicht.',
  KIM_CONNECTOR_CMS_VERIFY_BINDING: 'Der Prüfbericht passt nicht zur verwendeten Signatur oder zum Zertifikat.',
  KIM_CONNECTOR_CMS_VERIFY_TIME: 'Die Zeitangaben im Konnektorbericht passen nicht zum aktuellen Durchlauf.',
};
const dateTime = (n: number) => new Date(n).toLocaleString('de-DE');
export function KimHostPanel({ tenantId, roleKey, canCheck }: { tenantId: string; roleKey: RoleKey; canCheck: boolean }) {
  const [status, setStatus] = useState<KimHostStatus | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [receiveRevision, setReceiveRevision] = useState(0);
  const [receiveLocked, setReceiveLocked] = useState(false);
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
    } finally { if (active.current === controller) { active.current = null; if (mounted.current) { setBusy(false); if (action === 'start') setReceiveRevision(n => n + 1); } } }
  }, [tenantId, roleKey, canCheck]);
  useEffect(() => { mounted.current = true; setStatus(null); requestId.current = undefined; void load('status');
    return () => { mounted.current = false; active.current?.abort(); active.current = null; };
  }, [load]);
  useEffect(() => {
    if (!status || (status.state !== 'running' && status.receiveBlock !== 'active' && !status.nextStartAt) || error) return;
    const delay = status.state === 'running' || status.receiveBlock === 'active' ? 2500 : Math.min(30000, Math.max(1000, (status.nextStartAt ?? 0) - Date.now() + 100));
    const timer = setTimeout(() => void load('status'), delay); return () => clearTimeout(timer);
  }, [status, error, load]);
  const download = () => {
    if (!status?.requestId) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(status, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `CareSuite-Konnektorpruefung-${status.report?.runId ?? status.requestId}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="gx-stack"><section className="gx-card gx-stack" aria-labelledby="gx-kim-host-title">
    <div><h2 id="gx-kim-host-title">Konnektor und Kartenprüfung</h2><p className="gx-muted">Der angeschlossene Dienst signiert einen neu erzeugten Testinhalt, verschlüsselt ihn und entschlüsselt ihn mit der ausgewählten SMC-B. Das Ergebnis wird mit dem Original verglichen. Anschließend prüft der Konnektor die Signatur und liefert einen zugeordneten Prüfbericht.</p></div>
    {!canCheck ? <p className="gx-subtle">Für die Anschlussprüfung werden Lese- und Erstellungsrechte für Abrechnungen benötigt.</p> : <>
      {error && <div className="gx-notice" data-tone="error" role="alert">{error}</div>}
      <div className="gx-kim-status" role="status" aria-live="polite">
        <strong>{status?.receiveBlock === 'active' ? 'Kartenempfang läuft am Host' : status?.receiveBlock === 'review' ? 'Kartenempfang benötigt Überprüfung'
          : status?.receiveBlock === 'cooldown' ? 'Wartezeit nach Kartenempfang' : status ? labels[status.state] : busy ? 'Prüfstatus wird geladen …' : 'Prüfstatus noch nicht verfügbar'}</strong>
        {status?.environment && <span className="gx-badge">{status.environment === 'test' ? 'Testumgebung' : 'Produktionsumgebung · Diagnose'}</span>}
      </div>
      {status?.state === 'unconfigured' && <p>Für diesen Zugang ist noch kein Konnektorhost eingerichtet. Nach der serverseitigen Anbindung lässt sich der Anschluss hier prüfen.</p>}
      {status?.state === 'ready' && !status.receiveBlock && <p>Die SMC-B muss am Kartenterminal bereits freigeschaltet sein. Der Durchlauf verwendet ausschließlich einen synthetischen Testinhalt.</p>}
      {status?.receiveBlock === 'active' && <p>Der Host prüft gerade eine gespeicherte KIM-Nachricht mit derselben Karte. Die Anschlussprüfung ist währenddessen gesperrt. Der Status wird automatisch aktualisiert.</p>}
      {status?.receiveBlock === 'review' && <p>Ein Kartenempfang benötigt eine administrative Überprüfung am Host. Bis zur Klärung können keine weiteren Kartenprüfungen gestartet werden.</p>}
      {status?.state === 'running' && <p>Der Host führt die Prüfung aus. Der Status wird automatisch aktualisiert. Beim Verlassen dieser Ansicht läuft die Prüfung am Host weiter.</p>}
      {status && !status.receiveBlock && ['failed','interrupted'].includes(status.state) && <div className="gx-subtle">
        {status.errorCode && verificationErrors[status.errorCode] && <p>{verificationErrors[status.errorCode]}</p>}
        <p>{status.canStart || status.nextStartAt ? 'Die administrative Überprüfung wurde am Host bestätigt. Ein neuer Durchlauf ist nach einer gegebenenfalls noch laufenden Wartezeit möglich.' : status.errorCode === 'KIM_CONNECTOR_PIN_NOT_VERIFIED' ? 'Die Karte ist nicht freigeschaltet. Bitte den PIN-Status am Kartenterminal prüfen.' : 'Der Durchlauf wurde nicht vollständig bestätigt. Die Administration muss den Host und den Kartenstatus prüfen, bevor ein neuer Durchlauf freigegeben wird.'}</p>
        {status.errorCode && <small>Prüfcode: {status.errorCode}</small>}
      </div>}
      {status?.nextStartAt && <p role="status">Ein neuer Durchlauf ist ab {dateTime(status.nextStartAt)} möglich. Der Status wird automatisch aktualisiert.</p>}
      <div className="gx-actions">
        <button type="button" disabled={busy} onClick={() => void load('status')}>Prüfstatus abfragen</button>
        <button type="button" className="gx-primary" disabled={busy || receiveLocked || !status?.canStart} onClick={() => void load('start')}>Kartenprüfung starten</button>
        {status?.requestId && <button type="button" onClick={download}>Prüfprotokoll herunterladen</button>}
      </div>
      {status?.report && <div className="gx-stack"><p>Abgeschlossen am {dateTime(status.report.completedAt)}. Der Nachweis gilt für diesen einzelnen Durchlauf.</p>
        <ol className="gx-kim-checks">{status.report.transcript.map(step => <li key={step.operation}><span>{operations[step.operation]}</span><span className="gx-badge" data-tone="ok">Bestätigt</span></li>)}</ol>
        {status.report.version === 2 && status.report.documentVerification ? <p>Die Konnektorprüfung hat die Signatur als gültig bestätigt. Prüfzeitpunkt: {dateTime(status.report.documentVerification.checkedAt)}.</p> : <p className="gx-subtle">Älteres Prüfprotokoll: Eine Signaturprüfung durch den Konnektor ist darin noch nicht enthalten. Dafür ist ein neuer Durchlauf erforderlich.</p>}
        <details><summary>Zuordnung des Prüfprotokolls</summary><dl className="gx-kim-proof"><dt>Durchlauf</dt><dd>{status.report.runId}</dd><dt>Protokoll-Hash</dt><dd>{status.report.transcriptSha256}</dd>{status.report.documentVerification && <><dt>Konnektorbericht</dt><dd>{status.report.documentVerification.reportSha256}</dd></>}</dl></details>
      </div>}
    </>}
    <div className="gx-ready"><article><h3>Hardware-Nachweis</h3><p>Eine unabhängige Bestätigung des Konnektors, Kartenterminals und der verwendeten Karte liegt hier noch nicht vor.</p></article>
      <article><h3>TI- und Versandnachweis</h3><p>TI-Abnahme, Zulassung und ein bestätigter Echtversand bleiben gesondert nachzuweisen. Diese Prüfung versendet keine Nachricht.</p></article></div>
  </section><KimReceivePanel tenantId={tenantId} roleKey={roleKey} canCheck={canCheck} refreshKey={receiveRevision} onStartLockChange={setReceiveLocked} onActivity={() => void load('status')} /></div>;
}
