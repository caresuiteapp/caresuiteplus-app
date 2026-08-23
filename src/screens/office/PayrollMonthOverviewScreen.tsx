import { useCallback, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, useWorkflowFeedback } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { useLegacyTheme, type LegacyColors } from '@/design/tokens/themeBridge';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  formatPayrollBalanceMinutes,
  formatPayrollMoney,
  formatPayrollMinutes,
  getPayrollPdfUrl,
  listPayrollMonthOverview,
  publishPayrollStatement,
  reviewExpenseClaim,
} from '@/lib/payroll';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { ExpenseClaimStatus, PayrollEmployeeMonth } from '@/types/modules/payrollMonth';
import { typography } from '@/theme';

const QUERY_TIMEOUT_MS = 30_000;
const ACTION_TIMEOUT_MS = 90_000;

const STATUS_LABEL: Record<string, string> = {
  published: 'Freigabe ausstehend', confirmed: 'Bestätigt', rejected: 'Abgelehnt',
  superseded: 'Ersetzt', locked: 'Gesperrt', paid: 'Ausgezahlt', draft: 'Entwurf',
};

const EXPENSE_STATUS_LABEL: Record<string, string> = {
  draft: 'Entwurf', submitted: 'Eingereicht', needs_info: 'Rückfrage offen', approved: 'Genehmigt',
  partially_approved: 'Teilweise genehmigt', rejected: 'Abgelehnt', reimbursed: 'Erstattet',
};

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function syncLabel(iso: string | null | undefined): string {
  if (!iso) return 'Noch nicht synchronisiert';
  return `Stand ${new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MA';
}

function statementTone(status: string | null): 'Green' | 'Orange' | 'Cyan' | 'Muted' {
  if (status === 'confirmed' || status === 'paid') return 'Green';
  if (status === 'rejected') return 'Orange';
  if (status === 'published' || status === 'locked') return 'Cyan';
  return 'Muted';
}

export function PayrollMonthOverviewScreen() {
  const { colors } = useLegacyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [syncIssue, setSyncIssue] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewAmounts, setReviewAmounts] = useState<Record<string, string>>({});
  const feedback = useWorkflowFeedback();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, check } = usePermissions();
  const roleKey = profile?.roleKey ?? null;
  const canView = can('office.employees.view');
  const canEdit = can('office.employees.edit');

  const query = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView) return { ok: false as const, error: 'Kein Zugriff auf die Gehaltsstatistik.' };
      try {
        const result = await withServiceQueryTimeout(
          listPayrollMonthOverview(tenantId, year, month, roleKey),
          'Gehaltsstatistik',
          QUERY_TIMEOUT_MS,
        );
        setSyncIssue(result.ok ? null : result.error);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Die Monatsdaten konnten nicht vollständig geladen werden.';
        setSyncIssue(errorMessage);
        return { ok: false as const, error: errorMessage };
      }
    }, [tenantId, canView, year, month, roleKey]),
    [tenantId, canView, year, month, roleKey],
    {
      enabled: Boolean(tenantId && canView),
      live: { tenantId, subscribe: subscribeToWfmLiveChanges, pollMs: 30_000, refreshOnFocus: true },
    },
  );

  const data = query.data;
  const pendingExpenseCount = useMemo(() => data?.employees.reduce(
    (sum, employee) => sum + employee.expenseClaims.filter((claim) => claim.status === 'submitted' || claim.status === 'needs_info').length,
    0,
  ) ?? 0, [data]);
  const publishedCount = useMemo(() => data?.employees.filter((employee) => employee.latestStatement).length ?? 0, [data]);
  const confirmedCount = useMemo(() => data?.employees.filter(
    (employee) => ['confirmed', 'locked', 'paid'].includes(employee.latestStatement?.status ?? ''),
  ).length ?? 0, [data]);

  function changeMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear()); setMonth(next.getMonth() + 1); setMessage(null); setSyncIssue(null); setExpanded({});
  }

  function goToCurrentMonth() {
    const current = new Date();
    setYear(current.getFullYear()); setMonth(current.getMonth() + 1); setMessage(null); setSyncIssue(null);
  }

  async function publish(employee: PayrollEmployeeMonth) {
    if (!tenantId) return;
    setBusyId(employee.employeeId); setMessage(null);
    const loadingId = feedback.showLoading(`${employee.employeeName}: Abrechnung und PDF werden erstellt…`);
    try {
      const result = await withServiceQueryTimeout(
        publishPayrollStatement(tenantId, employee, roleKey),
        'PDF-Erstellung und Veröffentlichung',
        ACTION_TIMEOUT_MS,
      );
      if (!result.ok) { setMessage(result.error); feedback.showError(result.error, 'Veröffentlichung fehlgeschlagen'); return; }
      const success = `${employee.employeeName}: Version ${result.data.version} wurde veröffentlicht.`;
      setMessage(success); feedback.showSuccess(success, 'Abrechnung veröffentlicht'); void query.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Die Abrechnung konnte nicht veröffentlicht werden.';
      setMessage(errorMessage); feedback.showError(errorMessage, 'Veröffentlichung fehlgeschlagen');
    } finally {
      feedback.dismiss(loadingId); setBusyId(null);
    }
  }

  async function openPdf(path: string | null) {
    if (!path) return;
    const loadingId = feedback.showLoading('Dokument wird geladen…');
    try {
      const result = await withServiceQueryTimeout(getPayrollPdfUrl(path), 'Dokumentabruf', QUERY_TIMEOUT_MS);
      if (!result.ok) { setMessage(result.error); feedback.showError(result.error, 'Dokument nicht verfügbar'); return; }
      await Linking.openURL(result.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Das Dokument konnte nicht geöffnet werden.';
      setMessage(errorMessage); feedback.showError(errorMessage, 'Dokument nicht verfügbar');
    } finally {
      feedback.dismiss(loadingId);
    }
  }

  async function review(
    claimId: string,
    status: Extract<ExpenseClaimStatus, 'approved' | 'partially_approved' | 'rejected' | 'needs_info'>,
    originalCents: number,
  ) {
    if (!tenantId) return;
    const rawAmount = reviewAmounts[claimId]?.trim().replace(',', '.');
    const parsedAmount = rawAmount ? Number(rawAmount) : originalCents / 100;
    const approvedAmountCents = Math.round(parsedAmount * 100);
    const note = reviewNotes[claimId]?.trim() ?? '';
    if (!Number.isFinite(parsedAmount) || approvedAmountCents < 0 || approvedAmountCents > originalCents) {
      feedback.showError('Der genehmigte Betrag muss zwischen 0,00 EUR und dem eingereichten Betrag liegen.', 'Betrag prüfen'); return;
    }
    if ((status === 'rejected' || status === 'needs_info') && !note) {
      feedback.showError('Für eine Rückfrage oder Ablehnung ist ein Prüfvermerk erforderlich.', 'Prüfvermerk fehlt'); return;
    }
    const effectiveStatus = status === 'approved' && approvedAmountCents < originalCents ? 'partially_approved' : status;
    setBusyId(claimId); setMessage(null);
    const loadingId = feedback.showLoading('Auslage wird geprüft und gespeichert…');
    try {
      const result = await withServiceQueryTimeout(reviewExpenseClaim({
        tenantId, claimId, status: effectiveStatus, approvedAmountCents,
        officeNote: note || null, rejectionReason: status === 'rejected' ? note : null,
      }, roleKey), 'Auslagenprüfung', QUERY_TIMEOUT_MS);
      if (!result.ok) { setMessage(result.error); feedback.showError(result.error, 'Prüfung fehlgeschlagen'); return; }
      setMessage('Die Auslage wurde geprüft und gespeichert.');
      feedback.showSuccess('Die Auslage wurde gespeichert.', 'Prüfung abgeschlossen'); void query.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Die Auslage konnte nicht geprüft werden.';
      setMessage(errorMessage); feedback.showError(errorMessage, 'Prüfung fehlgeschlagen');
    } finally {
      feedback.dismiss(loadingId); setBusyId(null);
    }
  }

  if (!canView) return <ScreenShell title="Gehaltsstatistik"><ErrorState title="Kein Zugriff" message={check('office.employees.view').reason ?? 'Berechtigung fehlt.'} presentation="inline" /></ScreenShell>;
  if (query.loading && !data) return <ScreenShell title="Gehaltsstatistik" subtitle="Monatsabschluss und Personalkosten"><View style={styles.inlineState}><LoadingState message="Monatsdaten werden berechnet…" presentation="inline" /><Text style={styles.inlineHint}>Der Abruf wird nach spätestens 30 Sekunden beendet. Die Seite wird nicht dauerhaft blockiert.</Text></View></ScreenShell>;
  if (query.error && !data) return <ScreenShell title="Gehaltsstatistik" subtitle="Monatsabschluss und Personalkosten"><View style={styles.inlineState}><ErrorState title="Gehaltsstatistik nicht verfügbar" message={query.error} onRetry={() => void query.refresh()} presentation="inline" /></View></ScreenShell>;

  return (
    <ScreenShell title="Gehaltsstatistik" subtitle="Arbeitszeit, Prognose, Zeitkonto, Auslagen und verbindliche Mitarbeitendenfreigabe">
      <View
        style={styles.page}
        testID="payroll-month-overview"
        {...(Platform.OS === 'web' ? ({ dataSet: { healthosPayrollRevision: 'r8' } } as object) : {})}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>OFFICE · LOHN- UND ZEITSTEUERUNG</Text>
            <Text style={styles.heroTitle}>{monthLabel(year, month)}</Text>
            <Text style={styles.heroDescription}>Ist-Arbeitszeit, Monatsprognose, Zeitkonten, Auslagen und PDF-Freigaben in einem belastbaren Monatsabschluss.</Text>
            <View style={styles.periodControls}>
              <Pressable onPress={() => changeMonth(-1)} accessibilityRole="button" accessibilityLabel="Vorheriger Monat" style={({ pressed }) => [styles.periodButton, pressed && styles.pressed]}><Text style={styles.periodIcon}>←</Text><Text style={styles.periodText}>Vorheriger Monat</Text></Pressable>
              <Pressable onPress={goToCurrentMonth} accessibilityRole="button" style={({ pressed }) => [styles.currentButton, pressed && styles.pressed]}><Text style={styles.currentText}>Aktueller Monat</Text></Pressable>
              <Pressable onPress={() => changeMonth(1)} accessibilityRole="button" accessibilityLabel="Nächster Monat" style={({ pressed }) => [styles.periodButton, pressed && styles.pressed]}><Text style={styles.periodText}>Nächster Monat</Text><Text style={styles.periodIcon}>→</Text></Pressable>
            </View>
          </View>
          <View style={styles.heroActions}>
            <View style={styles.syncCard}><View style={[styles.syncDot, query.refreshing && styles.syncDotBusy]} /><View style={styles.flex}><Text style={styles.syncTitle}>{query.refreshing ? 'AKTUALISIERUNG LÄUFT' : query.isLiveConnected ? 'LIVE VERBUNDEN' : 'DATENSTAND'}</Text><Text style={styles.syncTime}>{syncLabel(data?.generatedAt)}</Text></View></View>
            <Pressable disabled={query.refreshing} onPress={() => void query.refresh()} accessibilityRole="button" style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed, query.refreshing && styles.disabled]}><Text style={styles.refreshIcon}>↻</Text><Text style={styles.refreshText}>{query.refreshing ? 'Wird aktualisiert' : 'Daten aktualisieren'}</Text></Pressable>
          </View>
        </View>

        {syncIssue ? <View style={styles.issueBanner}><View style={styles.issueIcon}><Text style={styles.issueIconText}>!</Text></View><View style={styles.flex}><Text style={styles.issueTitle}>Aktualisierung nicht vollständig</Text><Text style={styles.issueText}>{syncIssue} Vorhandene Monatsdaten bleiben sichtbar und nutzbar.</Text></View><Pressable onPress={() => void query.refresh()} style={styles.issueAction}><Text style={styles.issueActionText}>Erneut versuchen</Text></Pressable></View> : null}
        {message ? <View style={styles.messageBanner}><Text style={styles.messageText}>{message}</Text><Pressable onPress={() => setMessage(null)} accessibilityLabel="Meldung schließen"><Text style={styles.closeText}>×</Text></Pressable></View> : null}

        <View style={styles.kpiGrid}>
          <View style={[styles.kpi, styles.blue]}><Text style={styles.kpiLabel}>BIS HEUTE ERARBEITET</Text><Text style={styles.kpiValue}>{formatPayrollMoney(data?.totals.earnedGrossCents ?? 0)}</Text><Text style={styles.kpiDetail}>Brutto aus bestätigten Ist-Zeiten</Text></View>
          <View style={[styles.kpi, styles.violet]}><Text style={styles.kpiLabel}>MONATSPROGNOSE</Text><Text style={styles.kpiValue}>{formatPayrollMoney(data?.totals.projectedGrossCents ?? 0)}</Text><Text style={styles.kpiDetail}>Ist-Zeit plus verbleibende Planung</Text></View>
          <View style={[styles.kpi, styles.green]}><Text style={styles.kpiLabel}>GENEHMIGTE AUSLAGEN</Text><Text style={styles.kpiValue}>{formatPayrollMoney(data?.totals.approvedExpensesCents ?? 0)}</Text><Text style={styles.kpiDetail}>Für Auszahlung freigegeben</Text></View>
          <View style={[styles.kpi, pendingExpenseCount ? styles.orange : styles.neutral]}><Text style={styles.kpiLabel}>OFFENE PRÜFUNGEN</Text><Text style={styles.kpiValue}>{pendingExpenseCount}</Text><Text style={styles.kpiDetail}>Auslagen mit Handlungsbedarf</Text></View>
          <View style={[styles.kpi, styles.cyan]}><Text style={styles.kpiLabel}>PDF-FREIGABEN</Text><Text style={styles.kpiValue}>{confirmedCount} / {data?.employees.length ?? 0}</Text><Text style={styles.kpiDetail}>{publishedCount} Monatsübersichten veröffentlicht</Text></View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}><View style={styles.flex}><Text style={styles.panelEyebrow}>MONATSABSCHLUSS</Text><Text style={styles.panelTitle}>Mitarbeitendenabrechnungen</Text><Text style={styles.panelSubtitle}>Kernwerte sofort sichtbar; Zeiten, Dokumente, Auslagen und PDF-Aktionen gezielt aufklappbar.</Text></View><View style={styles.countBadge}><Text style={styles.countValue}>{data?.employees.length ?? 0}</Text><Text style={styles.countLabel}>Mitarbeitende</Text></View></View>
          {!data?.employees.length ? <View style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.emptyIconText}>€</Text></View><Text style={styles.emptyTitle}>Keine abrechenbaren Mitarbeitenden</Text><Text style={styles.emptyText}>Für {monthLabel(year, month)} liegen keine abrechenbaren Beschäftigten oder Monatswerte vor.</Text></View> : data.employees.map((employee, index) => {
            const defaultExpanded = index === 0;
            const isExpanded = expanded[employee.employeeId] ?? defaultExpanded;
            const status = employee.latestStatement?.status ?? null;
            const tone = statementTone(status);
            return <View key={employee.employeeId} style={[styles.employeeCard, isExpanded && styles.employeeCardOpen]}>
              <Pressable
                onPress={() => setExpanded((current) => ({ ...current, [employee.employeeId]: !(current[employee.employeeId] ?? defaultExpanded) }))}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                style={({ pressed }) => [styles.employeeHeader, pressed && styles.employeePressed]}
              >
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials(employee.employeeName)}</Text></View>
                <View style={styles.employeeIdentity}><Text style={styles.employeeName}>{employee.employeeName}</Text><Text style={styles.employeeRate}>{employee.compensationType === 'hourly' ? `${formatPayrollMoney(employee.hourlyRateCents)} je Stunde` : `${formatPayrollMoney(employee.fixedSalaryCents)} Festgehalt`}{employee.employeeNumber ? ` · Personal-Nr. ${employee.employeeNumber}` : ''}</Text></View>
                <View style={[styles.statement, styles[`statement${tone}`]]}><View style={styles.statementDot} /><Text style={styles.statementText}>{status ? STATUS_LABEL[status] ?? status : 'Noch nicht veröffentlicht'}</Text></View>
                <View style={styles.expandControl}><Text style={styles.expandLabel}>{isExpanded ? 'Weniger' : 'Details'}</Text><Text style={styles.expandIcon}>{isExpanded ? '⌃' : '⌄'}</Text></View>
              </Pressable>
              <View style={styles.summaryGrid}>
                <View style={styles.summary}><Text style={styles.summaryLabel}>Arbeitszeit Ist</Text><Text style={styles.summaryValue}>{formatPayrollMinutes(employee.actualWorkMinutes)}</Text></View>
                <View style={styles.summary}><Text style={styles.summaryLabel}>Monatsprognose</Text><Text style={styles.summaryAccent}>{formatPayrollMoney(employee.projectedGrossCents)}</Text></View>
                <View style={styles.summary}><Text style={styles.summaryLabel}>inkl. Auslagen</Text><Text style={styles.summaryValue}>{formatPayrollMoney(employee.projectedTotalPayoutCents)}</Text></View>
                <View style={styles.summary}><Text style={styles.summaryLabel}>Zeitkonto</Text><Text style={[styles.summaryValue, employee.timeAccountBalanceMinutes < 0 && styles.negative]}>{formatPayrollBalanceMinutes(employee.timeAccountBalanceMinutes)}</Text></View>
              </View>
              {isExpanded ? <View style={styles.details}>
                <View style={styles.sectionHeading}><View><Text style={styles.detailEyebrow}>ZEIT UND PLANUNG</Text><Text style={styles.detailTitle}>Arbeitszeitübersicht</Text></View><Text style={styles.detailHint}>WFM-Ist bis heute · Planung bis Monatsende</Text></View>
                <View style={styles.timeGrid}>{[
                  ['Arbeitszeit', formatPayrollMinutes(employee.actualWorkMinutes)], ['Fahrzeit', formatPayrollMinutes(employee.travelMinutes)],
                  ['Urlaub / Krank', formatPayrollMinutes(employee.vacationMinutes + employee.sickMinutes)], ['Monatsplan', formatPayrollMinutes(employee.monthlyPlannedMinutes ?? employee.plannedMinutes)],
                  ['Noch geplant', formatPayrollMinutes(employee.plannedMinutes)], ['Zeitkonto', formatPayrollBalanceMinutes(employee.timeAccountBalanceMinutes)],
                ].map(([label, value]) => <View key={label} style={styles.timeCell}><Text style={styles.timeLabel}>{label}</Text><Text style={[styles.timeValue, label === 'Zeitkonto' && employee.timeAccountBalanceMinutes < 0 && styles.negative]}>{value}</Text></View>)}</View>
                <View style={styles.financeGrid}>{[
                  ['Bis heute', formatPayrollMoney(employee.earnedGrossCents)], ['Monatsprognose', formatPayrollMoney(employee.projectedGrossCents)],
                  ['Genehmigte Auslagen', formatPayrollMoney(employee.approvedExpensesCents)], ['Prognose Auszahlung', formatPayrollMoney(employee.projectedTotalPayoutCents)],
                ].map(([label, value], financeIndex) => <View key={label} style={[styles.financeCell, financeIndex === 1 && styles.financeAccent]}><Text style={styles.financeLabel}>{label}</Text><Text style={financeIndex === 1 ? styles.financeValueAccent : styles.financeValue}>{value}</Text></View>)}</View>
                {employee.latestStatement?.employeeDecisionReason ? <View style={styles.rejection}><Text style={styles.rejectionTitle}>Ablehnungsgrund der Mitarbeitenden</Text><Text style={styles.rejectionText}>{employee.latestStatement.employeeDecisionReason}</Text></View> : null}
                <View style={styles.actions}>{employee.latestStatement?.pdfPath ? <PremiumButton title="PDF öffnen" variant="secondary" onPress={() => void openPdf(employee.latestStatement?.pdfPath ?? null)} /> : null}{canEdit && !['confirmed', 'locked', 'paid'].includes(status ?? '') ? <PremiumButton title={employee.latestStatement ? 'Neue Version veröffentlichen' : 'PDF erstellen & veröffentlichen'} loading={busyId === employee.employeeId} onPress={() => void publish(employee)} /> : null}</View>

                {employee.pendingPortalUploads.length ? <View style={styles.detailSection}><View style={styles.sectionHeading}><View><Text style={styles.detailEyebrow}>PORTAL-DOKUMENTE</Text><Text style={styles.detailTitle}>Neu eingereichte Portal-Dokumente</Text></View><View style={styles.sectionCount}><Text style={styles.sectionCountText}>{employee.pendingPortalUploads.length}</Text></View></View><Text style={styles.detailHint}>Über „Meine Uploads“ eingereicht und zur Office-Prüfung vorgemerkt.</Text>{employee.pendingPortalUploads.map((upload) => <View key={upload.id} style={styles.documentRow}><View style={styles.documentIcon}><Text style={styles.documentIconText}>PDF</Text></View><View style={styles.flex}><Text style={styles.documentName}>{upload.fileName}</Text><Text style={styles.documentMeta}>{new Date(upload.createdAt).toLocaleDateString('de-DE')} · {upload.category ?? 'Sonstiges'} · {upload.status === 'wird_geprueft' ? 'In Prüfung' : 'Eingereicht'}</Text></View><PremiumButton title="Öffnen" size="sm" variant="ghost" onPress={() => void openPdf(upload.storagePath)} /></View>)}</View> : null}

                {employee.expenseClaims.length ? <View style={styles.detailSection}><View style={styles.sectionHeading}><View><Text style={styles.detailEyebrow}>AUSLAGEN UND ERSTATTUNGEN</Text><Text style={styles.detailTitle}>Monatsbelege</Text></View><View style={styles.sectionCount}><Text style={styles.sectionCountText}>{employee.expenseClaims.length}</Text></View></View>{employee.expenseClaims.map((claim) => {
                  const claimOpen = claim.status === 'submitted' || claim.status === 'needs_info';
                  return <View key={claim.id} style={styles.expenseRow}><View style={styles.expenseHeading}><View style={styles.expenseCopy}><Text style={styles.expenseTitle}>{claim.description}</Text><Text style={styles.expenseMeta}>{claim.expenseDate} · {EXPENSE_STATUS_LABEL[claim.status] ?? claim.status}{claim.automaticSource ? ' · automatisch aus Fahrtenbuch' : ''}</Text>{claim.mileageKm != null ? <Text style={styles.expenseMeta}>{claim.mileageKm.toLocaleString('de-DE')} km × {((claim.mileageRateCents ?? 0) / 100).toFixed(2).replace('.', ',')} EUR</Text> : null}</View><Text style={styles.expenseAmount}>{formatPayrollMoney(claim.amountCents)}</Text>{claim.receiptPath ? <PremiumButton title="Beleg" size="sm" variant="ghost" onPress={() => void openPdf(claim.receiptPath)} /> : null}</View>
                    {claimOpen && canEdit ? <View style={styles.reviewArea}><View style={styles.reviewFields}><PremiumInput label="Genehmigter Betrag (EUR)" value={reviewAmounts[claim.id] ?? (claim.amountCents / 100).toFixed(2).replace('.', ',')} onChangeText={(value: string) => setReviewAmounts((old) => ({ ...old, [claim.id]: value }))} keyboardType="decimal-pad" /><PremiumInput label="Prüfvermerk / Ablehnungsgrund" value={reviewNotes[claim.id] ?? ''} onChangeText={(value: string) => setReviewNotes((old) => ({ ...old, [claim.id]: value }))} /></View><View style={styles.actions}><PremiumButton title="Genehmigen" size="sm" loading={busyId === claim.id} onPress={() => void review(claim.id, 'approved', claim.amountCents)} /><PremiumButton title="Rückfrage" size="sm" variant="secondary" onPress={() => void review(claim.id, 'needs_info', claim.amountCents)} /><PremiumButton title="Ablehnen" size="sm" variant="secondary" onPress={() => void review(claim.id, 'rejected', claim.amountCents)} /></View></View> : null}
                  </View>;
                })}</View> : null}
              </View> : null}
            </View>;
          })}
        </View>
      </View>
    </ScreenShell>
  );
}

const createStyles = (colors: LegacyColors) => StyleSheet.create({
  page: { width: '100%', gap: 16, paddingBottom: careSpacing.xxl }, flex: { flex: 1, minWidth: 0 },
  inlineState: { minHeight: 360, borderRadius: 24, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', padding: 24 },
  inlineHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  hero: { position: 'relative', overflow: 'hidden', minHeight: 190, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(102,216,255,0.42)', backgroundColor: '#071F3D', padding: 22, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20, shadowColor: '#28C4FF', shadowOpacity: 0.18, shadowRadius: 26, shadowOffset: { width: 0, height: 12 } },
  heroGlow: { position: 'absolute', width: 430, height: 250, borderRadius: 220, right: -90, top: -130, backgroundColor: 'rgba(29,151,224,0.17)' }, heroCopy: { flex: 1, minWidth: 360, maxWidth: 900 },
  eyebrow: { color: '#72E3FF', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.8 }, heroTitle: { color: '#FFFFFF', fontSize: 30, lineHeight: 37, fontWeight: '900', textTransform: 'capitalize', marginTop: 4 }, heroDescription: { color: '#B6CCE0', fontSize: 12, lineHeight: 18, maxWidth: 760, marginTop: 5 },
  periodControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }, periodButton: { minHeight: 42, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(110,218,255,0.34)', backgroundColor: 'rgba(12,66,107,0.68)', flexDirection: 'row', alignItems: 'center', gap: 8 }, periodIcon: { color: '#76E4FF', fontSize: 17, fontWeight: '800' }, periodText: { color: '#EAF8FF', fontSize: 11, fontWeight: '900' }, currentButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(83,226,181,0.36)', backgroundColor: 'rgba(5,96,74,0.42)', alignItems: 'center', justifyContent: 'center' }, currentText: { color: '#A8F4DB', fontSize: 11, fontWeight: '900' }, pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] }, disabled: { opacity: 0.58 },
  heroActions: { minWidth: 240, gap: 9 }, syncCard: { minHeight: 58, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(73,224,181,0.34)', backgroundColor: 'rgba(5,79,64,0.35)', flexDirection: 'row', alignItems: 'center', gap: 10 }, syncDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4DE2B0', shadowColor: '#4DE2B0', shadowOpacity: 0.8, shadowRadius: 8 }, syncDotBusy: { backgroundColor: '#70DFFF' }, syncTitle: { color: '#C9FAEA', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1 }, syncTime: { color: '#8EB7AD', fontSize: 10, lineHeight: 14, marginTop: 2 }, refreshButton: { minHeight: 48, paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(109,220,255,0.4)', backgroundColor: 'rgba(13,83,132,0.72)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, refreshIcon: { color: '#78E4FF', fontSize: 19 }, refreshText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  issueBanner: { minHeight: 76, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(255,181,68,0.42)', backgroundColor: 'rgba(91,53,4,0.62)', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, issueIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,184,70,0.18)', alignItems: 'center', justifyContent: 'center' }, issueIconText: { color: '#FFC466', fontSize: 18, fontWeight: '900' }, issueTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' }, issueText: { color: '#D7C5A7', fontSize: 11, lineHeight: 17, marginTop: 2 }, issueAction: { minHeight: 38, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,201,110,0.38)', justifyContent: 'center' }, issueActionText: { color: '#FFE2AE', fontSize: 10, fontWeight: '900' },
  messageBanner: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(102,216,255,0.34)', backgroundColor: 'rgba(7,68,108,0.64)', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, messageText: { color: '#E8F8FF', fontSize: 11, fontWeight: '700', flex: 1 }, closeText: { color: '#8CE8FF', fontSize: 21 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, kpi: { flex: 1, minWidth: 190, minHeight: 118, borderRadius: 19, borderWidth: 1, padding: 15, justifyContent: 'center' }, blue: { borderColor: 'rgba(65,159,255,0.42)', backgroundColor: 'rgba(8,65,124,0.78)' }, violet: { borderColor: 'rgba(159,126,255,0.42)', backgroundColor: 'rgba(56,42,112,0.76)' }, green: { borderColor: 'rgba(61,223,173,0.4)', backgroundColor: 'rgba(5,83,65,0.74)' }, orange: { borderColor: 'rgba(255,177,65,0.42)', backgroundColor: 'rgba(102,59,3,0.76)' }, neutral: { borderColor: 'rgba(153,196,226,0.28)', backgroundColor: 'rgba(13,42,72,0.8)' }, cyan: { borderColor: 'rgba(65,220,244,0.42)', backgroundColor: 'rgba(4,76,94,0.74)' }, kpiLabel: { color: '#A7C6DA', fontSize: 8, fontWeight: '900', letterSpacing: 1 }, kpiValue: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '900', marginTop: 5, fontVariant: ['tabular-nums'] }, kpiDetail: { color: '#9EB5C8', fontSize: 9, marginTop: 3 },
  panel: { borderRadius: 25, borderWidth: 1, borderColor: 'rgba(117,210,249,0.34)', backgroundColor: 'rgba(5,27,52,0.95)', padding: 16, gap: 12 }, panelHeader: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14 }, panelEyebrow: { color: '#6DDFFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, panelTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 2 }, panelSubtitle: { color: '#91ADC5', fontSize: 10, lineHeight: 15, marginTop: 3 }, countBadge: { minWidth: 84, height: 50, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(102,220,255,0.32)', backgroundColor: 'rgba(35,142,201,0.16)', alignItems: 'center', justifyContent: 'center' }, countValue: { color: '#7CE6FF', fontSize: 17, fontWeight: '900' }, countLabel: { color: '#8FAEC5', fontSize: 8, fontWeight: '800' },
  empty: { minHeight: 260, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(104,201,244,0.18)', backgroundColor: 'rgba(2,17,36,0.62)', alignItems: 'center', justifyContent: 'center', padding: 24 }, emptyIcon: { width: 54, height: 54, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(102,220,255,0.38)', alignItems: 'center', justifyContent: 'center' }, emptyIconText: { color: '#77E5FF', fontSize: 25, fontWeight: '900' }, emptyTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginTop: 13, textAlign: 'center' }, emptyText: { color: '#9DB6CA', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  employeeCard: { borderRadius: 21, borderWidth: 1, borderColor: '#CFE1EF', backgroundColor: '#F6FAFD', overflow: 'hidden' }, employeeCardOpen: { borderColor: '#66C8F2', shadowColor: '#24AEEB', shadowOpacity: 0.12, shadowRadius: 16 }, employeeHeader: { minHeight: 82, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF' }, employeePressed: { backgroundColor: '#EEF8FE' }, avatar: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: '#91D3F1', backgroundColor: '#E2F5FE', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#087DBB', fontSize: 14, fontWeight: '900' }, employeeIdentity: { flex: 1, minWidth: 180 }, employeeName: { color: '#0A223D', fontSize: 16, fontWeight: '900' }, employeeRate: { color: '#637B91', fontSize: 10, lineHeight: 15, marginTop: 2 }, statement: { minHeight: 31, paddingHorizontal: 10, borderRadius: 11, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }, statementCyan: { borderColor: '#8ED5F0', backgroundColor: '#E8F7FD' }, statementGreen: { borderColor: '#8ADCC1', backgroundColor: '#E8FAF4' }, statementOrange: { borderColor: '#F1C071', backgroundColor: '#FFF6E5' }, statementMuted: { borderColor: '#C9D8E4', backgroundColor: '#F0F4F7' }, statementDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#159BCB' }, statementText: { color: '#244762', fontSize: 9, fontWeight: '900' }, expandControl: { minWidth: 66, alignItems: 'center' }, expandLabel: { color: '#197AA9', fontSize: 9, fontWeight: '900' }, expandIcon: { color: '#197AA9', fontSize: 17, fontWeight: '900' },
  summaryGrid: { borderTopWidth: 1, borderTopColor: '#D9E8F3', backgroundColor: '#F0F7FC', padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, summary: { flex: 1, minWidth: 150, minHeight: 58, borderRadius: 13, borderWidth: 1, borderColor: '#D4E6F2', backgroundColor: '#FFFFFF', paddingHorizontal: 11, justifyContent: 'center' }, summaryLabel: { color: '#6C8295', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }, summaryValue: { color: '#0A223D', fontSize: 13, fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'] }, summaryAccent: { color: '#7054C2', fontSize: 13, fontWeight: '900', marginTop: 2 }, negative: { color: '#B34A31' },
  details: { borderTopWidth: 1, borderTopColor: '#D5E5F1', padding: 16, gap: 16, backgroundColor: '#F8FBFD' }, sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }, detailEyebrow: { color: '#1786BC', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, detailTitle: { color: '#0A223D', fontSize: 15, fontWeight: '900', marginTop: 1 }, detailHint: { color: '#71879A', fontSize: 9, lineHeight: 14 }, timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, timeCell: { flex: 1, minWidth: 150, minHeight: 65, borderRadius: 14, borderWidth: 1, borderColor: '#D5E6F2', backgroundColor: '#FFFFFF', padding: 11, justifyContent: 'center' }, timeLabel: { color: '#6B8194', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }, timeValue: { color: '#0A223D', fontSize: 13, fontWeight: '900', marginTop: 3 },
  financeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderRadius: 17, borderWidth: 1, borderColor: '#CFE3F1', backgroundColor: '#EAF5FC', padding: 10 }, financeCell: { flex: 1, minWidth: 165, minHeight: 70, borderRadius: 13, backgroundColor: '#FFFFFF', padding: 11, justifyContent: 'center' }, financeAccent: { borderWidth: 1, borderColor: '#CFC3F5', backgroundColor: '#F7F3FF' }, financeLabel: { color: '#6C8295', fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }, financeValue: { color: '#0A223D', fontSize: 18, fontWeight: '900', marginTop: 3 }, financeValueAccent: { color: '#6E51C0', fontSize: 18, fontWeight: '900', marginTop: 3 }, rejection: { borderRadius: 14, borderWidth: 1, borderColor: '#F0B768', backgroundColor: '#FFF5E3', padding: 12 }, rejectionTitle: { color: '#8C5200', fontSize: 10, fontWeight: '900' }, rejectionText: { color: '#6E5634', fontSize: 10, marginTop: 3 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  detailSection: { gap: 10, borderTopWidth: 1, borderTopColor: '#D6E5F0', paddingTop: 15 }, sectionCount: { minWidth: 32, height: 29, borderRadius: 10, backgroundColor: '#E2F4FD', borderWidth: 1, borderColor: '#AFDBF0', alignItems: 'center', justifyContent: 'center' }, sectionCountText: { color: '#0D82B9', fontSize: 10, fontWeight: '900' }, documentRow: { minHeight: 66, borderRadius: 14, borderWidth: 1, borderColor: '#D4E5F1', backgroundColor: '#FFFFFF', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }, documentIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#E6F5FC', alignItems: 'center', justifyContent: 'center' }, documentIconText: { color: '#167FAF', fontSize: 8, fontWeight: '900' }, documentName: { color: '#0A223D', fontSize: 11, fontWeight: '900' }, documentMeta: { color: '#74899B', fontSize: 9, marginTop: 2 },
  expenseRow: { borderRadius: 16, borderWidth: 1, borderColor: '#D2E4F0', backgroundColor: '#FFFFFF', padding: 12, gap: 11 }, expenseHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }, expenseCopy: { flex: 1, minWidth: 220 }, expenseTitle: { color: '#0A223D', fontSize: 12, fontWeight: '900' }, expenseMeta: { color: '#71879A', fontSize: 9, lineHeight: 14, marginTop: 2 }, expenseAmount: { color: '#0B6F9F', fontSize: 15, fontWeight: '900' }, reviewArea: { borderTopWidth: 1, borderTopColor: '#E0EAF2', paddingTop: 11, gap: 10 }, reviewFields: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
});
