import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState, ErrorState, InfoBanner, LoadingState, PremiumBadge,
  PremiumButton, PremiumCard, PremiumInput, SectionPanel, useWorkflowFeedback,
} from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  formatPayrollBalanceMinutes, formatPayrollMoney, formatPayrollMinutes, getPayrollPdfUrl,
  listPayrollMonthOverview, publishPayrollStatement, reviewExpenseClaim,
} from '@/lib/payroll';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import type { ExpenseClaimStatus, PayrollEmployeeMonth } from '@/types/modules/payrollMonth';
import { typography } from '@/theme';
import { useLegacyTheme, type LegacyColors } from '@/design/tokens/themeBridge';

const STATUS_LABEL: Record<string, string> = {
  published: 'Freigabe ausstehend', confirmed: 'Bestätigt', rejected: 'Abgelehnt',
  superseded: 'Ersetzt', locked: 'Gesperrt', paid: 'Ausgezahlt', draft: 'Entwurf',
};

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export function PayrollMonthOverviewScreen() {
  const { colors } = useLegacyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewAmounts, setReviewAmounts] = useState<Record<string, string>>({});
  const feedback = useWorkflowFeedback();
  const queryFeedbackId = useRef<string | null>(null);
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, check } = usePermissions();
  const roleKey = profile?.roleKey ?? null;
  const canView = can('office.employees.view');
  const canEdit = can('office.employees.edit');
  const query = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView) return { ok: false as const, error: 'Kein Zugriff auf die Gehaltsstatistik.' };
      return listPayrollMonthOverview(tenantId, year, month, roleKey);
    }, [tenantId, canView, year, month, roleKey]),
    [tenantId, canView, year, month, roleKey],
    {
      enabled: !!tenantId && canView,
      live: {
        tenantId,
        subscribe: subscribeToWfmLiveChanges,
        pollMs: 10_000,
        refreshOnFocus: true,
      },
    },
  );

  useEffect(() => {
    const isQueryBusy = query.loading || (query.refreshing && busyId === null);
    if (isQueryBusy && !queryFeedbackId.current) {
      queryFeedbackId.current = feedback.showLoading('Arbeitszeit, Zeitkonto und Abrechnung werden aktualisiert…');
      return;
    }
    if (!isQueryBusy && queryFeedbackId.current) {
      feedback.dismiss(queryFeedbackId.current);
      queryFeedbackId.current = null;
    }
  }, [busyId, feedback, query.loading, query.refreshing]);

  useEffect(() => () => {
    if (queryFeedbackId.current) feedback.dismiss(queryFeedbackId.current);
  }, [feedback]);

  const changeMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1); setYear(next.getFullYear()); setMonth(next.getMonth() + 1); setMessage(null);
  };
  const pendingExpenseCount = useMemo(() => query.data?.employees.reduce((sum, employee) => sum + employee.expenseClaims.filter((claim) => claim.status === 'submitted' || claim.status === 'needs_info').length, 0) ?? 0, [query.data]);

  async function publish(employee: PayrollEmployeeMonth) {
    if (!tenantId) return; setBusyId(employee.employeeId); setMessage(null);
    const loadingId = feedback.showLoading(`${employee.employeeName}: Abrechnung und PDF werden erstellt…`);
    try {
      const result = await publishPayrollStatement(tenantId, employee, roleKey);
      feedback.dismiss(loadingId);
      if (!result.ok) { setMessage(result.error); feedback.showError(result.error, 'Veröffentlichung fehlgeschlagen'); return; }
      const successMessage = `${employee.employeeName}: Version ${result.data.version} wurde veröffentlicht.`;
      setMessage(successMessage); feedback.showSuccess(successMessage, 'Abrechnung veröffentlicht'); await query.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Die Abrechnung konnte nicht veröffentlicht werden.';
      feedback.dismiss(loadingId); setMessage(errorMessage); feedback.showError(errorMessage, 'Veröffentlichung fehlgeschlagen');
    } finally {
      feedback.dismiss(loadingId); setBusyId(null);
    }
  }
  async function openPdf(path: string | null) {
    if (!path) return;
    const loadingId = feedback.showLoading('Dokument wird geladen…');
    try {
      const result = await getPayrollPdfUrl(path);
      feedback.dismiss(loadingId);
      if (!result.ok) { setMessage(result.error); feedback.showError(result.error, 'Dokument nicht verfügbar'); return; }
      await Linking.openURL(result.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Das Dokument konnte nicht geöffnet werden.';
      feedback.dismiss(loadingId); setMessage(errorMessage); feedback.showError(errorMessage, 'Dokument nicht verfügbar');
    } finally {
      feedback.dismiss(loadingId);
    }
  }
  async function review(claimId: string, status: Extract<ExpenseClaimStatus, 'approved' | 'partially_approved' | 'rejected' | 'needs_info'>, originalCents: number) {
    if (!tenantId) return; setBusyId(claimId); setMessage(null);
    const loadingId = feedback.showLoading('Auslage wird geprüft und gespeichert…');
    const rawAmount = reviewAmounts[claimId]?.trim().replace(',', '.');
    const approvedAmountCents = rawAmount ? Math.round(Number(rawAmount) * 100) : originalCents;
    const note = reviewNotes[claimId]?.trim() ?? '';
    const effectiveStatus = status === 'approved' && approvedAmountCents < originalCents
      ? 'partially_approved'
      : status;
    try {
      const result = await reviewExpenseClaim({ tenantId, claimId, status: effectiveStatus, approvedAmountCents, officeNote: note || null, rejectionReason: status === 'rejected' ? note : null }, roleKey);
      feedback.dismiss(loadingId);
      if (!result.ok) { setMessage(result.error); feedback.showError(result.error, 'Prüfung fehlgeschlagen'); return; }
      setMessage('Auslage wurde geprüft.'); feedback.showSuccess('Die Auslage wurde gespeichert.', 'Prüfung abgeschlossen'); await query.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Die Auslage konnte nicht geprüft werden.';
      feedback.dismiss(loadingId); setMessage(errorMessage); feedback.showError(errorMessage, 'Prüfung fehlgeschlagen');
    } finally {
      feedback.dismiss(loadingId); setBusyId(null);
    }
  }

  if (!canView) return <ScreenShell title="Gehaltsstatistik"><ErrorState title="Kein Zugriff" message={check('office.employees.view').reason ?? 'Berechtigung fehlt.'} /></ScreenShell>;
  if (query.loading && !query.data) return <ScreenShell title="Gehaltsstatistik"><LoadingState message="Monatsdaten werden berechnet…" presentation="inline" /></ScreenShell>;
  if (query.error && !query.data) return <ScreenShell title="Gehaltsstatistik"><ErrorState title="Gehaltsstatistik nicht verfügbar" message={query.error} onRetry={() => void query.refresh()} /></ScreenShell>;
  const data = query.data;
  return (
    <ScreenShell title="Gehaltsstatistik" subtitle="Arbeitszeit, Prognose, Zeitkonto, Auslagen und verbindliche Mitarbeitendenfreigabe">
      <View style={styles.page} testID="payroll-month-overview">
        <View style={styles.monthBar}><PremiumButton title="←" variant="secondary" onPress={() => changeMonth(-1)} /><View style={styles.monthCopy}><Text style={styles.monthTitle}>{monthLabel(year, month)}</Text><Text style={styles.muted}>Gemeinsame WFM-Ist-Werte bis heute · Planung bis Monatsende</Text></View><PremiumButton title="→" variant="secondary" onPress={() => changeMonth(1)} /><PremiumButton title="Aktualisieren" variant="ghost" loading={query.refreshing} onPress={() => void query.refresh()} /></View>
        {message ? <InfoBanner message={message} /> : null}
        <View style={styles.kpis}>
          <PremiumCard style={styles.kpi}><Text style={styles.kpiLabel}>Erarbeitetes Brutto</Text><Text style={styles.kpiValue}>{formatPayrollMoney(data?.totals.earnedGrossCents ?? 0)}</Text></PremiumCard>
          <PremiumCard style={styles.kpi}><Text style={styles.kpiLabel}>Prognose Monatsbrutto</Text><Text style={styles.kpiValue}>{formatPayrollMoney(data?.totals.projectedGrossCents ?? 0)}</Text></PremiumCard>
          <PremiumCard style={styles.kpi}><Text style={styles.kpiLabel}>Genehmigte Auslagen</Text><Text style={styles.kpiValue}>{formatPayrollMoney(data?.totals.approvedExpensesCents ?? 0)}</Text></PremiumCard>
          <PremiumCard style={styles.kpi}><Text style={styles.kpiLabel}>Offene Auslagen</Text><Text style={styles.kpiValue}>{pendingExpenseCount}</Text></PremiumCard>
        </View>
        <SectionPanel title="Alle Mitarbeitenden" subtitle="Die Prognose enthält auch alle geplanten Einsätze bis zum Monatsende.">
          {!data?.employees.length ? <EmptyState title="Keine Mitarbeitenden" message="Für diesen Monat liegen keine abrechenbaren Beschäftigten vor." /> : data.employees.map((employee) => (
            <PremiumCard key={employee.employeeId} style={styles.employeeCard}>
              <View style={styles.heading}><View style={styles.flex}><Text style={styles.name}>{employee.employeeName}</Text><Text style={styles.muted}>{employee.compensationType === 'hourly' ? `${formatPayrollMoney(employee.hourlyRateCents)} / Std.` : `${formatPayrollMoney(employee.fixedSalaryCents)} Festgehalt`}</Text></View>{employee.latestStatement ? <PremiumBadge label={STATUS_LABEL[employee.latestStatement.status] ?? employee.latestStatement.status} variant={employee.latestStatement.status === 'confirmed' ? 'green' : employee.latestStatement.status === 'rejected' ? 'orange' : 'cyan'} /> : <PremiumBadge label="Noch nicht veröffentlicht" variant="muted" />}</View>
              <View style={styles.metrics}>
                <Text style={styles.metric}>Arbeitszeit <Text style={styles.strong}>{formatPayrollMinutes(employee.actualWorkMinutes)}</Text></Text>
                <Text style={styles.metric}>Fahrzeit <Text style={styles.strong}>{formatPayrollMinutes(employee.travelMinutes)}</Text></Text>
                <Text style={styles.metric}>Urlaub/Krank <Text style={styles.strong}>{formatPayrollMinutes(employee.vacationMinutes + employee.sickMinutes)}</Text></Text>
                <Text style={styles.metric}>Monatsplan <Text style={styles.strong}>{formatPayrollMinutes(employee.monthlyPlannedMinutes ?? employee.plannedMinutes)}</Text></Text>
                <Text style={styles.metric}>Noch geplant <Text style={styles.strong}>{formatPayrollMinutes(employee.plannedMinutes)}</Text></Text>
                <Text style={styles.metric}>Zeitkonto <Text style={styles.strong}>{formatPayrollBalanceMinutes(employee.timeAccountBalanceMinutes)}</Text></Text>
              </View>
              <View style={styles.moneyRow}><View><Text style={styles.kpiLabel}>Bis heute</Text><Text style={styles.money}>{formatPayrollMoney(employee.earnedGrossCents)}</Text></View><View><Text style={styles.kpiLabel}>Monatsprognose</Text><Text style={styles.moneyForecast}>{formatPayrollMoney(employee.projectedGrossCents)}</Text></View><View><Text style={styles.kpiLabel}>inkl. Auslagen</Text><Text style={styles.money}>{formatPayrollMoney(employee.projectedTotalPayoutCents)}</Text></View></View>
              {employee.latestStatement?.employeeDecisionReason ? <InfoBanner message={`Ablehnungsgrund: ${employee.latestStatement.employeeDecisionReason}`} /> : null}
              <View style={styles.actions}>{employee.latestStatement?.pdfPath ? <PremiumButton title="PDF öffnen" variant="secondary" onPress={() => void openPdf(employee.latestStatement?.pdfPath ?? null)} /> : null}{canEdit && !['confirmed', 'locked', 'paid'].includes(employee.latestStatement?.status ?? '') ? <PremiumButton title={employee.latestStatement ? 'Neue Version veröffentlichen' : 'PDF erstellen & veröffentlichen'} loading={busyId === employee.employeeId} onPress={() => void publish(employee)} /> : null}</View>
              {employee.pendingPortalUploads.length ? <View style={styles.expenses}><Text style={styles.subheading}>Neu eingereichte Portal-Dokumente</Text><Text style={styles.muted}>Diese Dateien wurden über „Meine Uploads“ eingereicht und warten auf die Office-Prüfung.</Text>{employee.pendingPortalUploads.map((upload) => (
                <View key={upload.id} style={styles.expenseRow}><View style={styles.heading}><View style={styles.flex}><Text style={styles.strong}>{upload.fileName}</Text><Text style={styles.muted}>{new Date(upload.createdAt).toLocaleDateString('de-DE')} · {upload.category ?? 'Sonstiges'} · {upload.status === 'wird_geprueft' ? 'In Prüfung' : 'Eingereicht'}</Text></View><PremiumButton title="Dokument öffnen" size="sm" variant="ghost" onPress={() => void openPdf(upload.storagePath)} /></View></View>
              ))}</View> : null}
              {employee.expenseClaims.length ? <View style={styles.expenses}><Text style={styles.subheading}>Auslagen & Erstattungen</Text>{employee.expenseClaims.map((claim) => (
                <View key={claim.id} style={styles.expenseRow}><View style={styles.heading}><View style={styles.flex}><Text style={styles.strong}>{claim.description}</Text><Text style={styles.muted}>{claim.expenseDate} · {formatPayrollMoney(claim.amountCents)} · {claim.status}</Text></View>{claim.receiptPath ? <PremiumButton title="Beleg" size="sm" variant="ghost" onPress={() => void openPdf(claim.receiptPath)} /> : null}</View>
                  {(claim.status === 'submitted' || claim.status === 'needs_info') && canEdit ? <><View style={styles.reviewFields}><PremiumInput label="Genehmigter Betrag (EUR)" value={reviewAmounts[claim.id] ?? (claim.amountCents / 100).toFixed(2).replace('.', ',')} onChangeText={(value: string) => setReviewAmounts((old) => ({ ...old, [claim.id]: value }))} keyboardType="decimal-pad" /><PremiumInput label="Prüfvermerk / Ablehnungsgrund" value={reviewNotes[claim.id] ?? ''} onChangeText={(value: string) => setReviewNotes((old) => ({ ...old, [claim.id]: value }))} /></View><View style={styles.actions}><PremiumButton title="Genehmigen" size="sm" loading={busyId === claim.id} onPress={() => void review(claim.id, 'approved', claim.amountCents)} /><PremiumButton title="Rückfrage" size="sm" variant="secondary" onPress={() => void review(claim.id, 'needs_info', claim.amountCents)} /><PremiumButton title="Ablehnen" size="sm" variant="secondary" onPress={() => void review(claim.id, 'rejected', claim.amountCents)} /></View></> : null}
                </View>))}</View> : null}
            </PremiumCard>
          ))}
        </SectionPanel>
      </View>
    </ScreenShell>
  );
}

const createStyles = (colors: LegacyColors) => StyleSheet.create({
  page: { width: '100%', gap: careSpacing.lg }, monthBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: careSpacing.md }, monthCopy: { alignItems: 'center', flex: 1, minWidth: 240 }, monthTitle: { ...typography.h2, color: colors.textPrimary, textTransform: 'capitalize' }, muted: { ...typography.caption, color: colors.textMuted }, kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.md }, kpi: { flex: 1, minWidth: 190, padding: careSpacing.md }, kpiLabel: { ...typography.caption, color: colors.textMuted }, kpiValue: { ...typography.h2, color: colors.textPrimary }, employeeCard: { padding: careSpacing.lg, gap: careSpacing.md }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: careSpacing.md }, flex: { flex: 1, minWidth: 0 }, name: { ...typography.h3, color: colors.textPrimary }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm }, metric: { ...typography.caption, color: colors.textMuted, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: colors.borderSoft }, strong: { fontWeight: '700', color: colors.textPrimary }, moneyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xl }, money: { ...typography.h3, color: colors.textPrimary }, moneyForecast: { ...typography.h3, color: '#7657C8' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm }, expenses: { gap: careSpacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: careSpacing.md }, subheading: { ...typography.h3, color: colors.textPrimary }, expenseRow: { gap: careSpacing.sm, borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft, padding: careSpacing.md }, reviewFields: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
});
