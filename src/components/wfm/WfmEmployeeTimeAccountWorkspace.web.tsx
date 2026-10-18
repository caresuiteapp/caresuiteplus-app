import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useRouter } from 'expo-router';
import { usePermissions } from '@/hooks/usePermissions';
import { listOpenReviewEntriesForEmployee } from '@/lib/wfm/wfmOfficeZeitkontenService.web';
import { getPayrollPdfUrl } from '@/lib/payroll';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { confirmAction } from '@/lib/platform/confirmAction';
import type { RoleKey } from '@/types';
import type { WfmOfficeEmployeeTimeAccount, WfmOfficeTimePeriod } from '@/types/modules/wfmOfficeTimekeeping';
import { WfmOfficeTimeHistoryPanel, type WfmEditorState } from './WfmOfficeTimeHistoryPanel.web';
import { WfmOfficeManualEntryPanel } from './WfmOfficeManualEntryPanel.web';
import { accountDays, accountDuration, accountInitials } from './wfmTimeAccountsModel.web';
import { wfmTimeAccountsCss } from './wfmTimeAccountsCss.web';

type AccountTab = 'overview' | 'bookings' | 'logbook' | 'absence' | 'payroll' | 'manual';
type Props = {
  account: WfmOfficeEmployeeTimeAccount; tenantId: string; reviewerId: string; roleKey: RoleKey | null;
  canCorrect: boolean; canManage: boolean; periodLabel: string; period: WfmOfficeTimePeriod;
  initialTab?: AccountTab; onChanged?: () => Promise<void>; onEditorStateChange?: (state: WfmEditorState) => void; onClose: () => void;
};
const tabs: { key: AccountTab; label: string }[] = [
  { key: 'overview', label: 'Übersicht' }, { key: 'bookings', label: 'Zeitbuchungen' }, { key: 'logbook', label: 'Fahrtenbuch' },
  { key: 'absence', label: 'Abwesenheiten' }, { key: 'payroll', label: 'Gehaltsstatistik & PDF' },
];
const statementLabels: Record<string, string> = { draft: 'Entwurf', published: 'Veröffentlicht', confirmed: 'Bestätigt', rejected: 'Abgelehnt', locked: 'Gesperrt', paid: 'Ausgezahlt', superseded: 'Durch neuere Version ersetzt' };
const emptyEditor: WfmEditorState = { dirty: false, busy: false, childOpen: false };

function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return <div className="wta-kpi" data-tone={tone}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>;
}
function Progress({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total > 0 ? Math.max(0, Math.min(100, value / total * 100)) : 0;
  return <div className="wta-progress"><div className="wta-progress-head"><span>{label}</span><strong>{accountDuration(value)} / {accountDuration(total)}</strong></div><progress aria-label={label} max={100} value={percent} />{total === 0 ? <small className="wta-muted">Keine Vergleichszeit vorhanden.</small> : null}</div>;
}

export function WfmEmployeeTimeAccountWorkspace({ account, tenantId, reviewerId, roleKey, canCorrect, periodLabel, period, initialTab = 'overview', onChanged, onEditorStateChange, onClose }: Props) {
  const router = useRouter();
  const focused = useIsFocused();
  const { can } = usePermissions();
  const canOpenLogbook = can('assist.access') && can('assist.trips.view');
  const [tab, setTab] = useState<AccountTab>(initialTab === 'manual' && !canCorrect ? 'overview' : initialTab);
  const [editor, setEditor] = useState<WfmEditorState>(emptyEditor);
  const [pdfError, setPdfError] = useState('');
  const [pdfBusyId, setPdfBusyId] = useState('');
  const [pdfLink, setPdfLink] = useState<{ id: string; url: string } | null>(null);
  const pendingPdf = useRef<Window | null>(null);
  const loadingPdf = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pendingPdf.current?.close(); }; }, []);
  const reportEditor = useCallback((state: WfmEditorState) => { setEditor(state); onEditorStateChange?.(state); }, [onEditorStateChange]);
  const openEntries = useMemo(() => listOpenReviewEntriesForEmployee(account), [account]);
  const missingEntries = account.entries.filter(entry => entry.flags.includes('missing_booking'));
  const unplannedEntries = account.entries.filter(entry => entry.flags.includes('unplanned'));
  const statements = account.payrollStatements.filter(statement => {
    const month = `${statement.periodYear}-${String(statement.periodMonth).padStart(2, '0')}`;
    return month >= period.fromDate.slice(0, 7) && month <= period.toDate.slice(0, 7);
  }).sort((left, right) => right.periodYear - left.periodYear || right.periodMonth - left.periodMonth || right.version - left.version);
  const vacationYear = account.vacationYear ?? Number(period.toDate.slice(0, 4));
  const targetHint = account.targetSource === 'planned' ? 'Aus geplanten Einsatzzeiten' : account.targetSource === 'saved_account' ? 'Gespeichertes Monatssoll' : 'Vertrag im gewählten Zeitraum';
  async function canLeave() {
    if (!focused || editor.busy || editor.childOpen) return false;
    if (editor.dirty && !await confirmAction({ title: 'Ungespeicherte Änderungen', message: 'Möchten Sie die Änderungen verwerfen und diesen Bereich verlassen?', confirmLabel: 'Verwerfen' })) return false;
    reportEditor(emptyEditor);
    return true;
  }
  async function selectTab(next: AccountTab) {
    if (next === tab || !await canLeave()) return;
    setTab(next);
  }
  async function navigate(pathname: string, extraParams: Record<string, string> = {}) {
    if (!await canLeave()) return;
    onClose();
    router.push({ pathname, params: { employeeId: account.employeeId, employee: account.employeeId, month: period.fromDate.slice(0, 7), ...extraParams } } as never);
  }
  async function openPdf(id: string, path: string) {
    if (loadingPdf.current || !focused) return;
    loadingPdf.current = true;
    setPdfError(''); setPdfLink(null); setPdfBusyId(id);
    // Reserve a tab during the click so the browser does not block an asynchronous open.
    const preview = window.open('about:blank', '_blank');
    if (preview) preview.opener = null;
    pendingPdf.current = preview;
    try {
      const result = await withServiceQueryTimeout(getPayrollPdfUrl(path), 'PDF-Abruf');
      if (!mounted.current) { preview?.close(); return; }
      if (!result.ok) { preview?.close(); setPdfError(result.error); return; }
      const url = new URL(result.data);
      if (url.protocol !== 'https:') throw new Error('Der PDF-Link ist ungültig. Bitte erneut versuchen.');
      if (preview && !preview.closed) preview.location.replace(url.href);
      else setPdfLink({ id, url: url.href });
    } catch (error) {
      preview?.close();
      if (mounted.current) setPdfError(error instanceof Error ? error.message : 'Das PDF konnte nicht geöffnet werden. Bitte erneut versuchen.');
    } finally {
      pendingPdf.current = null; loadingPdf.current = false;
      if (mounted.current) setPdfBusyId('');
    }
  }
  return <section className="wta wta-detail" data-testid="wfm-employee-time-account-workspace"><style>{wfmTimeAccountsCss}</style>
    <div className="wta-detail-hero">
      <div className="wta-detail-identity"><span className="wta-avatar" aria-hidden="true">{accountInitials(account.employeeName)}</span><div><h2>{account.employeeName}</h2><p className="wta-muted">{periodLabel} · {account.entries.length} Zeitbuchungen</p></div></div>
      <div className="wta-actions"><span className="wta-badge" data-tone={openEntries.length > 0 ? 'warning' : 'blue'}>{openEntries.length > 0 ? `${openEntries.length} offene Prüfungen` : 'Keine offenen Prüfungen'}</span>{canCorrect ? <button type="button" className="wta-button" disabled={editor.busy || editor.childOpen} onClick={() => void selectTab('manual')}>＋ Nachtrag</button> : null}<button type="button" className="wta-button" disabled={editor.busy || editor.childOpen} onClick={() => void canLeave().then(allowed => { if (allowed) onClose(); })}>Schließen</button></div>
    </div>
    <nav className="wta-detail-nav" aria-label="Bereiche des Zeitkontos">{(canCorrect ? [...tabs, { key: 'manual' as const, label: 'Nachtrag' }] : tabs).map(item => <button type="button" key={item.key} className="wta-button" aria-pressed={tab === item.key} disabled={editor.busy || editor.childOpen} onClick={() => void selectTab(item.key)}>{item.label}</button>)}</nav>
    {tab === 'overview' ? <div className="wta-stack">
      <div className="wta-kpis">
        <Metric label="Sollzeit" value={accountDuration(account.targetMinutes)} hint={targetHint} />
        <Metric label="Istzeit" value={accountDuration(account.actualMinutes)} hint="Erfasste Arbeitszeit" />
        <Metric label="Saldo" value={accountDuration(account.saldoMinutes, true)} hint="Ist + Abwesenheit − Soll" tone={account.saldoMinutes < 0 ? 'warning' : 'good'} />
        <Metric label="Genehmigt" value={accountDuration(account.approvedMinutes)} hint="Freigegebene Arbeitszeit" />
        <Metric label="Fahrzeit" value={accountDuration(account.travelMinutes)} hint="Anrechenbare Fahrzeit" />
        <Metric label="Abwesenheit" value={accountDuration(account.absenceMinutes)} hint="Zeitgutschrift im Zeitraum" />
        <Metric label={`Resturlaub ${vacationYear}`} value={accountDays(account.remainingVacationDays)} hint={`${accountDays(account.vacationDaysUsed)} genommen`} />
        <Metric label={`Krankheit ${vacationYear}`} value={accountDays(account.sickDays)} hint="Gemeldete Tage im Kalenderjahr" />
      </div>
      <div className="wta-columns">
        <section className="wta-panel"><h3>Erfassung und Freigabe</h3><Progress label="Erfasst gegen Soll" value={account.actualMinutes} total={account.targetMinutes} /><Progress label="Genehmigt von erfasst" value={account.approvedMinutes} total={account.actualMinutes} /><Progress label="Exportiert von genehmigt" value={account.exportedMinutes} total={account.approvedMinutes} /><p className="wta-footnote">Der Saldo enthält die Abwesenheitsgutschrift. Im laufenden Monat kann er negativ sein, solange noch nicht alle Sollstunden erfasst sind.</p></section>
        <section className="wta-panel"><h3>Zur Prüfung</h3><div className="wta-issue"><span>Offene Prüfungen</span><span className="wta-badge" data-tone={openEntries.length ? 'warning' : undefined}>{openEntries.length}</span></div><div className="wta-issue"><span>Fehlende Buchungen</span><span className="wta-badge" data-tone={missingEntries.length ? 'warning' : undefined}>{missingEntries.length}</span></div><div className="wta-issue"><span>Ungeplante Zeiten</span><span className="wta-badge" data-tone={unplannedEntries.length ? 'warning' : undefined}>{unplannedEntries.length}</span></div><div className="wta-actions"><button type="button" className="wta-button" data-primary="true" onClick={() => void selectTab('bookings')}>Zeitbuchungen öffnen →</button><button type="button" className="wta-button" onClick={() => void selectTab('logbook')}>Fahrten ansehen</button></div></section>
      </div>
    </div> : null}
    {tab === 'bookings' ? <div className="wta-stack">
      {!canCorrect ? <div className="wta-message">Sie können die Buchungen einsehen. Für Änderungen und Freigaben benötigen Sie die Berechtigung für Arbeitszeit-Korrekturen.</div> : null}
      <div className="wta-subsection"><WfmOfficeTimeHistoryPanel tenantId={tenantId} reviewerId={reviewerId} roleKey={roleKey} canCorrect={canCorrect} initialEmployeeId={account.employeeId} initialEmployeeName={account.employeeName} period={period} lockEmployeeFilter onChanged={onChanged} onEditorStateChange={reportEditor} /></div>
    </div> : null}
    {tab === 'manual' && canCorrect ? <div className="wta-subsection"><WfmOfficeManualEntryPanel tenantId={tenantId} actorId={reviewerId} roleKey={roleKey} employees={[{ id: account.employeeId, name: account.employeeName }]} initialDate={period.fromDate} onChanged={onChanged} onEditorStateChange={reportEditor} /></div> : null}
    {tab === 'logbook' ? <div className="wta-stack"><div className="wta-kpis"><Metric label="Fahrzeit im Zeitkonto" value={accountDuration(account.travelMinutes)} hint="Anrechenbare Fahrzeit im Zeitraum" /><Metric label="Zusätzlich aus dem Fahrtenbuch" value={account.logbookAdditionalMinutes === undefined ? 'Nicht verfügbar' : accountDuration(account.logbookAdditionalMinutes)} hint="In der Istzeit berücksichtigt" /></div><section className="wta-panel"><h3>Fahrtenbuch und Fahrzeit</h3><p className="wta-muted">Fahrzeitbuchungen und anrechenbare Fahrten fließen in das Zeitkonto ein. Einzelne Fahrten, Kilometer und begründete Korrekturen finden Sie im Fahrtenbuch für diese Person.</p>{canOpenLogbook ? <div className="wta-actions"><button type="button" className="wta-button" data-primary="true" onClick={() => void navigate('/assist/fahrten', { tab: 'fahrten' })}>Fahrtenbuch für {period.fromDate.slice(5, 7)}/{period.fromDate.slice(0, 4)} öffnen →</button></div> : <p className="wta-footnote">Für die einzelnen Fahrten ist zusätzlich der Zugriff auf Assist und das Fahrtenbuch erforderlich.</p>}</section></div> : null}
    {tab === 'absence' ? <div className="wta-stack"><div className="wta-kpis"><Metric label={`Urlaub genommen ${vacationYear}`} value={accountDays(account.vacationDaysUsed)} hint={`Anspruch: ${accountDays(account.annualVacationDays)}`} /><Metric label={`Resturlaub ${vacationYear}`} value={accountDays(account.remainingVacationDays)} hint="Verbleibender Anspruch" /><Metric label={`Krankheit ${vacationYear}`} value={accountDays(account.sickDays)} hint="Gemeldete Tage im Kalenderjahr" /><Metric label="Zeitgutschrift" value={accountDuration(account.absenceMinutes)} hint="Im gewählten Zeitraum" /></div><section className="wta-panel"><h3>Urlaub und Abwesenheiten</h3><p className="wta-muted">Anträge, Krankmeldungen und Freigaben werden im Bereich Abwesenheiten bearbeitet. Die Zeitgutschrift im Konto folgt den hinterlegten Arbeitszeiten.</p><div className="wta-actions"><button type="button" className="wta-button" data-primary="true" onClick={() => void navigate('/business/office/time-tracking/abwesenheiten')}>Abwesenheiten öffnen →</button></div></section></div> : null}
    {tab === 'payroll' ? <div className="wta-stack"><div className="wta-actions"><button type="button" className="wta-button" data-primary="true" onClick={() => void navigate('/business/office/payroll')}>Gehaltsstatistik öffnen</button><button type="button" className="wta-button" onClick={() => void navigate('/business/office/time-tracking/export')}>Monatsexport öffnen</button></div><section className="wta-panel"><h3>Monatsabschlüsse · {periodLabel}</h3><p className="wta-muted">Gespeicherte Versionen der Gehaltsstatistik für diese Person.</p>{pdfError ? <div className="wta-message" data-tone="error" role="alert">{pdfError}</div> : null}{statements.length === 0 ? <div className="wta-state"><h3>Noch kein Monatsabschluss</h3><p>Prüfen Sie die Zeiten in der Gehaltsstatistik und erstellen Sie dort den Abschluss mit PDF.</p></div> : statements.map(statement => <div className="wta-statement" key={statement.id}><div className="wta-statement-copy"><strong>{String(statement.periodMonth).padStart(2, '0')}/{statement.periodYear} · Version {statement.version}</strong><span className="wta-muted">{statementLabels[statement.status] ?? 'Status nicht verfügbar'}</span></div>{pdfLink?.id === statement.id ? <a className="wta-button" data-primary="true" href={pdfLink.url} target="_blank" rel="noopener noreferrer">PDF jetzt öffnen ↗</a> : <button type="button" className="wta-button" disabled={!statement.pdfPath || Boolean(pdfBusyId)} onClick={() => { if (statement.pdfPath) void openPdf(statement.id, statement.pdfPath); }}>{pdfBusyId === statement.id ? 'PDF wird geladen …' : statement.pdfPath ? 'PDF öffnen ↗' : 'Kein PDF gespeichert'}</button>}</div>)}</section></div> : null}
  </section>;
}
