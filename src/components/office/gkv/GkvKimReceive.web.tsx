import React, { useEffect, useRef, useState } from 'react';
import { requestKimHostCommand } from '@/lib/gkvExchange/repository.web';
import { KimReceiveWorkspace, emptyKimReceiveView } from '@/lib/gkvExchange/kimReceiveWorkspace';
import type { KimReceiveStatus } from '@/lib/gkvExchange/kimReceiveContract';
import type { RoleKey } from '@/types';

const labels: Record<KimReceiveStatus['state'], string> = { prepared: 'Vorbereitet', running: 'Kartenprüfung läuft', completed: 'Diagnose gespeichert',
  failed: 'Prüfung fehlgeschlagen', interrupted: 'Ausgang ungeklärt' };
const stages: Record<string, string> = { mime: 'Nachrichtenformat', card: 'Kartenbereitstellung', decrypt: 'Kartenentschlüsselung', headers: 'Nachrichtenkopf',
  certificate: 'Zertifikatsprüfung', document: 'Signaturprüfung', directory: 'Verzeichnisabgleich', 'card-recheck': 'Kartennachprüfung', complete: 'Kartenprüfung abgeschlossen' };
const documentResults = { VALID: 'Gültig', INVALID: 'Ungültig', INCONCLUSIVE: 'Nicht abschließend prüfbar' };
const dateTime = (n: number) => new Date(n).toLocaleString('de-DE');
const jobLabel = (job: KimReceiveStatus) => job.state === 'completed' && job.result?.kind === 'unprotected' ? 'Unverschlüsseltes Original erfasst' : labels[job.state];

function ReceiveDetails({ job }: { job: KimReceiveStatus }) {
  const result = job.result, needsReview = job.reviewRequired && job.state !== 'running';
  return <>
    <div className="gx-kim-status"><strong>{jobLabel(job)}</strong>{needsReview && <span className="gx-badge" data-tone="warn">Überprüfung erforderlich</span>}</div>
    {job.state === 'prepared' && <p>Der Host hat diesen Auftrag einem gespeicherten Original und den dort hinterlegten Zertifikatserwartungen zugeordnet. Die SMC-B muss am Kartenterminal bereits freigeschaltet sein.</p>}
    {job.state === 'running' && <p>Der Host führt die Kartenprüfung aus. Der Status wird automatisch aktualisiert. Beim Verlassen der Ansicht läuft der Auftrag am Host weiter.</p>}
    {job.state === 'interrupted' && <p>Für diesen Auftrag liegt kein bestätigter Abschluss vor. Der Ausgang muss am Host geklärt werden; dieser Auftrag wird nicht erneut gestartet.</p>}
    {job.state === 'failed' && <p>Die Verarbeitung konnte nicht mit einem gespeicherten Ergebnis abgeschlossen werden. Dieser Auftrag bleibt für einen erneuten Start gesperrt.</p>}
    {needsReview && <p className="gx-subtle">Die Administration muss diesen Vorgang und den Kartenstatus am Host prüfen. Bis zur Klärung sind weitere Kartenaufträge gesperrt.</p>}
    {!job.reviewRequired && ['failed','interrupted'].includes(job.state) && <p>Die administrative Klärung wurde am Host bestätigt. Der ursprüngliche Befund bleibt bestehen.</p>}
    {job.errorCode && <p className="gx-filename">Prüfcode: {job.errorCode}</p>}
    {result && <div className="gx-stack">
      {result.kind === 'unprotected' ? <p>Das Original wurde als unverschlüsselt erkannt und unverändert gespeichert. Eine Kartenentschlüsselung wurde dafür nicht ausgeführt.</p> : <>
        <dl className="gx-kim-proof"><dt>Kartenbefund</dt><dd>{result.cardState === 'checked' ? 'Kartenprüfungen bestätigt' : 'Prüfung angehalten'}</dd>
          <dt>Prüfschritt</dt><dd>{stages[result.cardStage ?? ''] ?? 'Nicht verfügbar'}</dd>
          <dt>Dokumentsignatur</dt><dd>{result.documentResult ? documentResults[result.documentResult] : 'Kein Konnektorbefund vorhanden'}</dd>
          <dt>Diagnosecode</dt><dd>{result.diagnosisCode}</dd></dl>
        <p className="gx-subtle">Das Ergebnis ist eine Empfangsdiagnose. Absenderidentität und normale Zustellung sind weiterhin nicht freigegeben. Ein gültiger Signaturbefund allein hebt diese Sperre nicht auf.</p>
      </>}
      <p>Ergebnis am Host gespeichert: {result.octets.toLocaleString('de-DE')} Byte. Original, Nachrichteninhalt und gegebenenfalls der XML-Prüfbericht bleiben am Host.</p>
    </div>}
    <dl className="gx-kim-proof"><dt>Vorbereitet</dt><dd>{dateTime(job.createdAt)}</dd>
      {job.startedAt && <><dt>Gestartet</dt><dd>{dateTime(job.startedAt)}</dd></>}
      {job.completedAt && <><dt>Abgeschlossen</dt><dd>{dateTime(job.completedAt)}</dd></>}
      <dt>Auftrag</dt><dd>{job.requestId}</dd><dt>Nachricht</dt><dd>{job.messageId}</dd><dt>Postfach</dt><dd>{job.mailboxId}</dd></dl>
    <details className="gx-receive-proof"><summary>Prüfsummen und Nachweisstand</summary><dl className="gx-kim-proof">
      <dt>Original · SHA-256</dt><dd>{job.originalSha256}</dd>
      {result && <><dt>Ergebnis · SHA-256</dt><dd>{result.sha256}</dd>
        {result.verificationReportSha256 && <><dt>Konnektorbericht · SHA-256</dt><dd>{result.verificationReportSha256}</dd></>}</>}
      <dt>Hardware / TI</dt><dd>Unabhängige Nachweise stehen aus.</dd>
    </dl></details>
  </>;
}

export function KimReceivePanel({ tenantId, roleKey, canCheck, refreshKey = 0, onActivity, onStartLockChange }: {
  tenantId: string; roleKey: RoleKey; canCheck: boolean; refreshKey?: number; onActivity?: () => void; onStartLockChange?: (locked: boolean) => void;
}) {
  const scope = `${tenantId}:${roleKey}:${canCheck}`, workspace = useRef<KimReceiveWorkspace | null>(null);
  const [stored, setStored] = useState(() => ({ scope, view: emptyKimReceiveView() }));
  const view = stored.scope === scope ? stored.view : emptyKimReceiveView();
  useEffect(() => {
    setStored({ scope, view: emptyKimReceiveView() });
    if (!canCheck) return;
    const current = new KimReceiveWorkspace(tenantId, (command, signal) => requestKimHostCommand(tenantId, roleKey, command, signal),
      value => setStored({ scope, view: value }));
    workspace.current = current; void current.refresh();
    return () => { current.dispose(); if (workspace.current === current) workspace.current = null; };
  }, [tenantId, roleKey, canCheck, scope]);
  useEffect(() => { if (refreshKey) void workspace.current?.refresh(); }, [refreshKey]);
  useEffect(() => {
    if (view.busy || view.listError || view.detailError || view.uncertain) return;
    const running = view.page?.blockReason === 'active' || view.job?.state === 'running', next = view.page?.nextStartAt;
    if (!running && !next) return;
    const timer = setTimeout(() => void workspace.current?.refresh(), running ? 2500 : Math.min(30000, Math.max(1000, (next ?? 0) - Date.now() + 100)));
    return () => clearTimeout(timer);
  }, [view]);
  const { page, job } = view, locked = view.busy === 'start' || view.uncertain;
  useEffect(() => { onStartLockChange?.(locked); }, [locked, onStartLockChange]);
  useEffect(() => () => onStartLockChange?.(false), [onStartLockChange]);
  const canStart = !view.busy && !view.uncertain && !view.listError && !view.detailError && page?.canStart && job?.canStart && job.state === 'prepared';
  const download = () => {
    if (!job || view.detailError || view.busy) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(job, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `CareSuite-Empfangsstatus-${job.requestId}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="gx-card gx-stack gx-receive-panel" aria-labelledby="gx-kim-receive-title">
    <div><h2 id="gx-kim-receive-title">KIM-Empfangsaufträge</h2><p className="gx-muted">Am Host vorbereitete Nachrichten auswählen und mit der angeschlossenen Karte prüfen. Die Liste enthält die Zuordnung und den Prüfstand der Aufträge.</p></div>
    {!canCheck ? <p className="gx-subtle">Für Empfangsaufträge werden Lese- und Erstellungsrechte für Abrechnungen benötigt.</p> : <>
      <div className="gx-actions"><button type="button" disabled={Boolean(view.busy)} onClick={() => void workspace.current?.refresh()}>Empfangsstatus abfragen</button>
        {page?.environment && <span className="gx-badge">{page.environment === 'test' ? 'Testumgebung' : 'Produktionsumgebung · Diagnose'}</span>}
        <span className="gx-muted" role="status" aria-live="polite">{view.busy === 'start' ? 'Start wird angefordert …' : view.busy ? 'Prüfstand wird geladen …' : ''}</span>
      </div>
      {view.listError && <div className="gx-notice" data-tone="error" role="alert">{view.listError} Die angezeigte Liste kann veraltet sein.</div>}
      {page && !page.configured && <p className="gx-subtle">Für diesen Zugang ist noch kein Kartenempfang eingerichtet. Die Administration muss das Postfach und die Empfangsverarbeitung am Host anbinden.</p>}
      {page?.blockReason && <div className="gx-subtle" role="status">
        {page.blockReason === 'active' ? 'Am Host läuft eine Kartenprüfung. Weitere Starts sind bis zum Abschluss gesperrt. Der Status wird automatisch aktualisiert.'
          : page.blockReason === 'review' ? 'Ein Vorgang am Host benötigt eine administrative Überprüfung. Weitere Kartenaufträge bleiben bis zur Klärung gesperrt.'
          : `Die Wartezeit endet am ${dateTime(page.nextStartAt!)}. Der Status wird automatisch aktualisiert.`}
      </div>}
      {page?.configured && <div className="gx-receive-layout">
        <div className="gx-stack"><h3>Aufträge · Seite {view.pageNumber}</h3>
          {page.items.length ? <ul className="gx-receive-jobs" aria-label="Empfangsaufträge">{page.items.map(item => <li key={item.requestId}>
            <button type="button" disabled={locked} aria-pressed={job?.requestId === item.requestId} aria-controls="gx-kim-receive-detail"
              onClick={() => void workspace.current?.select(item.requestId)}>
              <strong>{jobLabel(item)}</strong><span>Vorbereitet: {dateTime(item.createdAt)}</span><span className="gx-receive-id">{item.requestId}</span>
              {item.reviewRequired && item.state !== 'running' && <span className="gx-badge" data-tone="warn">Überprüfung erforderlich</span>}
            </button></li>)}</ul> : <p className="gx-empty">{view.pageNumber === 1 ? 'Noch keine Empfangsaufträge vorbereitet. Vorhandene Nachrichten werden durch die Administration am Host zugeordnet.' : 'Auf dieser Seite sind keine weiteren Aufträge vorhanden.'}</p>}
          <nav className="gx-actions" aria-label="Seiten der Empfangsaufträge">
            <button type="button" disabled={Boolean(view.busy) || locked || view.pageNumber === 1} onClick={() => void workspace.current?.first()}>Neueste</button>
            <button type="button" disabled={Boolean(view.busy) || locked || view.pageNumber === 1} onClick={() => void workspace.current?.previous()}>Zurück</button>
            <button type="button" disabled={Boolean(view.busy) || locked || !page.nextCursor} onClick={() => void workspace.current?.next()}>Weitere Aufträge</button>
          </nav>
        </div>
        <section id="gx-kim-receive-detail" className="gx-receive-detail gx-stack" aria-labelledby="gx-kim-receive-detail-title">
          <h3 id="gx-kim-receive-detail-title">Auftragsdetails</h3>
          {view.detailError && <div className="gx-notice" data-tone="error" role="alert">{view.detailError}</div>}
          {job ? <>
            <ReceiveDetails job={job} />
            <div className="gx-actions">
              <button type="button" className="gx-primary" disabled={!canStart} onClick={async () => { await workspace.current?.start(); onActivity?.(); }}>Empfang prüfen</button>
              <button type="button" disabled={Boolean(view.busy) || Boolean(view.detailError) || view.uncertain} onClick={download}>Statusprotokoll herunterladen</button>
            </div>
            {job.state === 'prepared' && !job.canStart && !page.blockReason && <p className="gx-muted">Der Host hat diesen Auftrag derzeit nicht zum Start freigegeben. Bitte den Empfangsstatus aktualisieren.</p>}
          </> : <p className="gx-empty">Einen Auftrag auswählen, um Zuordnung, Prüfbefund und Startfreigabe anzusehen.</p>}
        </section>
      </div>}
    </>}
  </section>;
}
