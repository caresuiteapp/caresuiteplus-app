// Generated native presentation from src/components/wfm/WfmEmployeeTimeAccountWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeURL as URL} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeSpan,NativeStrong,NativeSmall,NativeProgress,NativeSection,NativeStyle,NativeH2,NativeP,NativeButton,NativeNav,NativeH3,NativeA,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { openNativePdfUrl } from '@/lib/platform/nativeFileDelivery.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useRouter } from 'expo-router';
import { usePermissions } from '@/hooks/usePermissions';
import { listOpenReviewEntriesForEmployee } from "../../lib/wfm/wfmOfficeZeitkontenService.native.ts";
import { getPayrollPdfUrl } from '@/lib/payroll';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { confirmAction } from '@/lib/platform/confirmAction';
import type { RoleKey } from '@/types';
import type { WfmOfficeEmployeeTimeAccount, WfmOfficeTimePeriod } from '@/types/modules/wfmOfficeTimekeeping';
import { WfmOfficeTimeHistoryPanel, type WfmEditorState } from "./WfmOfficeTimeHistoryPanel.native.tsx";
import { WfmOfficeManualEntryPanel } from "./WfmOfficeManualEntryPanel.native.tsx";
import { accountDays, accountDuration, accountInitials } from "./wfmTimeAccountsModel.native.ts";
import { wfmTimeAccountsCss } from "./wfmTimeAccountsCss.native.ts";
type AccountTab = 'overview' | 'bookings' | 'logbook' | 'absence' | 'payroll' | 'manual';
type Props = {
    account: WfmOfficeEmployeeTimeAccount;
    tenantId: string;
    reviewerId: string;
    roleKey: RoleKey | null;
    canCorrect: boolean;
    canManage: boolean;
    periodLabel: string;
    period: WfmOfficeTimePeriod;
    initialTab?: AccountTab;
    onChanged?: () => Promise<void>;
    onEditorStateChange?: (state: WfmEditorState) => void;
    onClose: () => void;
};
const tabs: {
    key: AccountTab;
    label: string;
}[] = [
    { key: 'overview', label: 'Übersicht' }, { key: 'bookings', label: 'Zeitbuchungen' }, { key: 'logbook', label: 'Fahrtenbuch' },
    { key: 'absence', label: 'Abwesenheiten' }, { key: 'payroll', label: 'Gehaltsstatistik & PDF' },
];
const statementLabels: Record<string, string> = { draft: 'Entwurf', published: 'Veröffentlicht', confirmed: 'Bestätigt', rejected: 'Abgelehnt', locked: 'Gesperrt', paid: 'Ausgezahlt', superseded: 'Durch neuere Version ersetzt' };
const emptyEditor: WfmEditorState = { dirty: false, busy: false, childOpen: false };
function Metric({ label, value, hint, tone }: {
    label: string;
    value: string;
    hint: string;
    tone?: string;
}) {
    return <NativeWorkspaceStyleScope css={[wfmTimeAccountsCss]}>{<NativeDiv className="wta-kpi" data-tone={tone}><NativeSpan>{label}</NativeSpan><NativeStrong>{value}</NativeStrong><NativeSmall>{hint}</NativeSmall></NativeDiv>}</NativeWorkspaceStyleScope>;
}
function Progress({ label, value, total }: {
    label: string;
    value: number;
    total: number;
}) {
    const percent = total > 0 ? Math.max(0, Math.min(100, value / total * 100)) : 0;
    return <NativeWorkspaceStyleScope css={[wfmTimeAccountsCss]}>{<NativeDiv className="wta-progress"><NativeDiv className="wta-progress-head"><NativeSpan>{label}</NativeSpan><NativeStrong>{accountDuration(value)} / {accountDuration(total)}</NativeStrong></NativeDiv><NativeProgress aria-label={label} max={100} value={percent}/>{total === 0 ? <NativeSmall className="wta-muted">Keine Vergleichszeit vorhanden.</NativeSmall> : null}</NativeDiv>}</NativeWorkspaceStyleScope>;
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
    const [pdfLink, setPdfLink] = useState<{
        id: string;
        url: string;
    } | null>(null);
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
        if (!focused || editor.busy || editor.childOpen)
            return false;
        if (editor.dirty && !await confirmAction({ title: 'Ungespeicherte Änderungen', message: 'Möchten Sie die Änderungen verwerfen und diesen Bereich verlassen?', confirmLabel: 'Verwerfen' }))
            return false;
        reportEditor(emptyEditor);
        return true;
    }
    async function selectTab(next: AccountTab) {
        if (next === tab || !await canLeave())
            return;
        setTab(next);
    }
    async function navigate(pathname: string, extraParams: Record<string, string> = {}) {
        if (!await canLeave())
            return;
        onClose();
        router.push({ pathname, params: { employeeId: account.employeeId, employee: account.employeeId, month: period.fromDate.slice(0, 7), ...extraParams } } as never);
    }
    async function openReviews() {
        await navigate('/business/office/time-tracking/pruefqueue', { preset: 'custom', from: period.fromDate, to: period.toDate, filter: 'pending' });
    }
    async function openPdf(id: string, path: string) {
        if (loadingPdf.current || !focused)
            return;
        loadingPdf.current = true;
        setPdfError('');
        setPdfLink(null);
        setPdfBusyId(id);
        // Reserve a tab during the click so the browser does not block an asynchronous open.
        const preview = null;
        pendingPdf.current = preview;
        try {
            const result = await withServiceQueryTimeout(getPayrollPdfUrl(path), 'PDF-Abruf');
            if (!mounted.current) {
                return;
            }
            if (!result.ok) {
                setPdfError(result.error);
                return;
            }
            const url = new URL(result.data);
            if (url.protocol !== 'https:')
                throw new Error('Der PDF-Link ist ungültig. Bitte erneut versuchen.');
            await openNativePdfUrl(url.href);
        }
        catch (error) {
            if (mounted.current)
                setPdfError(error instanceof Error ? error.message : 'Das PDF konnte nicht geöffnet werden. Bitte erneut versuchen.');
        }
        finally {
            pendingPdf.current = null;
            loadingPdf.current = false;
            if (mounted.current)
                setPdfBusyId('');
        }
    }
    return <NativeWorkspaceStyleScope css={[wfmTimeAccountsCss, wfmTimeAccountsCss]}>{<NativeSection className="wta wta-detail" data-testid="wfm-employee-time-account-workspace"><NativeStyle>{wfmTimeAccountsCss}</NativeStyle>
    <NativeDiv className="wta-detail-hero">
      <NativeDiv className="wta-detail-identity"><NativeSpan className="wta-avatar" aria-hidden="true">{accountInitials(account.employeeName)}</NativeSpan><NativeDiv><NativeH2>{account.employeeName}</NativeH2><NativeP className="wta-muted">{periodLabel} · {account.entries.length} Zeitbuchungen</NativeP></NativeDiv></NativeDiv>
      <NativeDiv className="wta-actions">{openEntries.length > 0 ? <NativeButton type="button" className="wta-button wta-review-badge" disabled={editor.busy || editor.childOpen} onClick={() => void openReviews()}>{openEntries.length} {openEntries.length === 1 ? 'offene Prüfung' : 'offene Prüfungen'} →</NativeButton> : <NativeSpan className="wta-badge" data-tone="blue">Keine offenen Prüfungen</NativeSpan>}{canCorrect ? <NativeButton type="button" className="wta-button" disabled={editor.busy || editor.childOpen} onClick={() => void selectTab('manual')}>＋ Nachtrag</NativeButton> : null}<NativeButton type="button" className="wta-button" disabled={editor.busy || editor.childOpen} onClick={() => void canLeave().then(allowed => { if (allowed)
        onClose(); })}>Schließen</NativeButton></NativeDiv>
    </NativeDiv>
    <NativeNav className="wta-detail-nav" aria-label="Bereiche des Zeitkontos">{(canCorrect ? [...tabs, { key: 'manual' as const, label: 'Nachtrag' }] : tabs).map(item => <NativeButton type="button" key={item.key} className="wta-button" aria-pressed={tab === item.key} disabled={editor.busy || editor.childOpen} onClick={() => void selectTab(item.key)}>{item.label}</NativeButton>)}</NativeNav>
    {tab === 'overview' ? <NativeDiv className="wta-stack">
      <NativeDiv className="wta-kpis">
        <Metric label="Sollzeit" value={accountDuration(account.targetMinutes)} hint={targetHint}/>
        <Metric label="Istzeit" value={accountDuration(account.actualMinutes)} hint="Erfasste Arbeitszeit"/>
        <Metric label="Saldo" value={accountDuration(account.saldoMinutes, true)} hint="Ist + Abwesenheit − Soll" tone={account.saldoMinutes < 0 ? 'warning' : 'good'}/>
        <Metric label="Genehmigt" value={accountDuration(account.approvedMinutes)} hint="Freigegebene Arbeitszeit"/>
        <Metric label="Fahrzeit" value={accountDuration(account.travelMinutes)} hint="Anrechenbare Fahrzeit"/>
        <Metric label="Abwesenheit" value={accountDuration(account.absenceMinutes)} hint="Zeitgutschrift im Zeitraum"/>
        <Metric label={`Resturlaub ${vacationYear}`} value={accountDays(account.remainingVacationDays)} hint={`${accountDays(account.vacationDaysUsed)} genommen`}/>
        <Metric label={`Krankheit ${vacationYear}`} value={accountDays(account.sickDays)} hint="Gemeldete Tage im Kalenderjahr"/>
      </NativeDiv>
      <NativeDiv className="wta-columns">
        <NativeSection className="wta-panel"><NativeH3>Erfassung und Freigabe</NativeH3><Progress label="Erfasst gegen Soll" value={account.actualMinutes} total={account.targetMinutes}/><Progress label="Genehmigt von erfasst" value={account.approvedMinutes} total={account.actualMinutes}/><Progress label="Exportiert von genehmigt" value={account.exportedMinutes} total={account.approvedMinutes}/><NativeP className="wta-footnote">Der Saldo enthält die Abwesenheitsgutschrift. Im laufenden Monat kann er negativ sein, solange noch nicht alle Sollstunden erfasst sind.</NativeP></NativeSection>
        <NativeSection className="wta-panel"><NativeH3>Zur Prüfung</NativeH3><NativeButton type="button" className="wta-issue wta-issue-action" disabled={editor.busy || editor.childOpen} onClick={() => void openReviews()}><NativeSpan>Offene Prüfungen öffnen →</NativeSpan><NativeSpan className="wta-badge" data-tone={openEntries.length ? 'warning' : undefined}>{openEntries.length}</NativeSpan></NativeButton><NativeDiv className="wta-issue"><NativeSpan>Fehlende Buchungen</NativeSpan><NativeSpan className="wta-badge" data-tone={missingEntries.length ? 'warning' : undefined}>{missingEntries.length}</NativeSpan></NativeDiv><NativeDiv className="wta-issue"><NativeSpan>Ungeplante Zeiten</NativeSpan><NativeSpan className="wta-badge" data-tone={unplannedEntries.length ? 'warning' : undefined}>{unplannedEntries.length}</NativeSpan></NativeDiv><NativeDiv className="wta-actions"><NativeButton type="button" className="wta-button" data-primary="true" onClick={() => void selectTab('bookings')}>Zeitbuchungen öffnen →</NativeButton><NativeButton type="button" className="wta-button" onClick={() => void selectTab('logbook')}>Fahrten ansehen</NativeButton></NativeDiv></NativeSection>
      </NativeDiv>
    </NativeDiv> : null}
    {tab === 'bookings' ? <NativeDiv className="wta-stack">
      {!canCorrect ? <NativeDiv className="wta-message">Sie können die Buchungen einsehen. Für Änderungen und Freigaben benötigen Sie die Berechtigung für Arbeitszeit-Korrekturen.</NativeDiv> : null}
      <NativeDiv className="wta-subsection"><WfmOfficeTimeHistoryPanel tenantId={tenantId} reviewerId={reviewerId} roleKey={roleKey} canCorrect={canCorrect} initialEmployeeId={account.employeeId} initialEmployeeName={account.employeeName} period={period} lockEmployeeFilter onChanged={onChanged} onEditorStateChange={reportEditor}/></NativeDiv>
    </NativeDiv> : null}
    {tab === 'manual' && canCorrect ? <NativeDiv className="wta-subsection"><WfmOfficeManualEntryPanel tenantId={tenantId} actorId={reviewerId} roleKey={roleKey} employees={[{ id: account.employeeId, name: account.employeeName }]} initialDate={period.fromDate} onChanged={onChanged} onEditorStateChange={reportEditor}/></NativeDiv> : null}
    {tab === 'logbook' ? <NativeDiv className="wta-stack"><NativeDiv className="wta-kpis"><Metric label="Fahrzeit im Zeitkonto" value={accountDuration(account.travelMinutes)} hint="Anrechenbare Fahrzeit im Zeitraum"/><Metric label="Zusätzlich aus dem Fahrtenbuch" value={account.logbookAdditionalMinutes === undefined ? 'Nicht verfügbar' : accountDuration(account.logbookAdditionalMinutes)} hint="In der Istzeit berücksichtigt"/></NativeDiv><NativeSection className="wta-panel"><NativeH3>Fahrtenbuch und Fahrzeit</NativeH3><NativeP className="wta-muted">Fahrzeitbuchungen und anrechenbare Fahrten fließen in das Zeitkonto ein. Einzelne Fahrten, Kilometer und begründete Korrekturen finden Sie im Fahrtenbuch für diese Person.</NativeP>{canOpenLogbook ? <NativeDiv className="wta-actions"><NativeButton type="button" className="wta-button" data-primary="true" onClick={() => void navigate('/assist/fahrten', { tab: 'fahrten' })}>Fahrtenbuch für {period.fromDate.slice(5, 7)}/{period.fromDate.slice(0, 4)} öffnen →</NativeButton></NativeDiv> : <NativeP className="wta-footnote">Für die einzelnen Fahrten ist zusätzlich der Zugriff auf Assist und das Fahrtenbuch erforderlich.</NativeP>}</NativeSection></NativeDiv> : null}
    {tab === 'absence' ? <NativeDiv className="wta-stack"><NativeDiv className="wta-kpis"><Metric label={`Urlaub genommen ${vacationYear}`} value={accountDays(account.vacationDaysUsed)} hint={`Anspruch: ${accountDays(account.annualVacationDays)}`}/><Metric label={`Resturlaub ${vacationYear}`} value={accountDays(account.remainingVacationDays)} hint="Verbleibender Anspruch"/><Metric label={`Krankheit ${vacationYear}`} value={accountDays(account.sickDays)} hint="Gemeldete Tage im Kalenderjahr"/><Metric label="Zeitgutschrift" value={accountDuration(account.absenceMinutes)} hint="Im gewählten Zeitraum"/></NativeDiv><NativeSection className="wta-panel"><NativeH3>Urlaub und Abwesenheiten</NativeH3><NativeP className="wta-muted">Anträge, Krankmeldungen und Freigaben werden im Bereich Abwesenheiten bearbeitet. Die Zeitgutschrift im Konto folgt den hinterlegten Arbeitszeiten.</NativeP><NativeDiv className="wta-actions"><NativeButton type="button" className="wta-button" data-primary="true" onClick={() => void navigate('/business/office/time-tracking/abwesenheiten')}>Abwesenheiten öffnen →</NativeButton></NativeDiv></NativeSection></NativeDiv> : null}
    {tab === 'payroll' ? <NativeDiv className="wta-stack"><NativeDiv className="wta-actions"><NativeButton type="button" className="wta-button" data-primary="true" onClick={() => void navigate('/business/office/payroll')}>Gehaltsstatistik öffnen</NativeButton><NativeButton type="button" className="wta-button" onClick={() => void navigate('/business/office/time-tracking/export')}>Monatsexport öffnen</NativeButton></NativeDiv><NativeSection className="wta-panel"><NativeH3>Monatsabschlüsse · {periodLabel}</NativeH3><NativeP className="wta-muted">Gespeicherte Versionen der Gehaltsstatistik für diese Person.</NativeP>{pdfError ? <NativeDiv className="wta-message" data-tone="error" role="alert">{pdfError}</NativeDiv> : null}{statements.length === 0 ? <NativeDiv className="wta-state"><NativeH3>Noch kein Monatsabschluss</NativeH3><NativeP>Prüfen Sie die Zeiten in der Gehaltsstatistik und erstellen Sie dort den Abschluss mit PDF.</NativeP></NativeDiv> : statements.map(statement => <NativeDiv className="wta-statement" key={statement.id}><NativeDiv className="wta-statement-copy"><NativeStrong>{String(statement.periodMonth).padStart(2, '0')}/{statement.periodYear} · Version {statement.version}</NativeStrong><NativeSpan className="wta-muted">{statementLabels[statement.status] ?? 'Status nicht verfügbar'}</NativeSpan></NativeDiv>{pdfLink?.id === statement.id ? <NativeA className="wta-button" data-primary="true" href={pdfLink.url} target="_blank" rel="noopener noreferrer">PDF jetzt öffnen ↗</NativeA> : <NativeButton type="button" className="wta-button" disabled={!statement.pdfPath || Boolean(pdfBusyId)} onClick={() => { if (statement.pdfPath)
        void openPdf(statement.id, statement.pdfPath); }}>{pdfBusyId === statement.id ? 'PDF wird geladen …' : statement.pdfPath ? 'PDF öffnen ↗' : 'Kein PDF gespeichert'}</NativeButton>}</NativeDiv>)}</NativeSection></NativeDiv> : null}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
