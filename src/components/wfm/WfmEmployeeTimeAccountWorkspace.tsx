import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  InfoBanner,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SegmentedTabs,
  type TabOption,
} from '@/components/ui';
import { EmployeeLogbookOfficePanel } from '@/components/office/EmployeeLogbookOfficePanel';
import { careSpacing } from '@/design/tokens/spacing';
import { formatWfmDurationMinutes } from '@/lib/wfm/wfmDisplayHelpers';
import { listOpenReviewEntriesForEmployee } from '@/lib/wfm/wfmOfficeZeitkontenService';
import type { RoleKey } from '@/types';
import type { WfmOfficeEmployeeTimeAccount } from '@/types/modules/wfmOfficeTimekeeping';
import { getPayrollPdfUrl } from '@/lib/payroll';
import { Linking } from 'react-native';
import { WfmOfficeTimeHistoryPanel } from './WfmOfficeTimeHistoryPanel';

type AccountTab = 'overview' | 'bookings' | 'logbook' | 'absence' | 'payroll';

type Props = {
  account: WfmOfficeEmployeeTimeAccount;
  tenantId: string;
  reviewerId: string;
  roleKey: RoleKey | null;
  canCorrect: boolean;
  canManage: boolean;
  periodLabel: string;
  onClose: () => void;
};

const TABS: TabOption[] = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'bookings', label: 'Zeitbuchungen & Bearbeitung' },
  { key: 'logbook', label: 'Fahrtenbuch' },
  { key: 'absence', label: 'Abwesenheiten' },
  { key: 'payroll', label: 'Gehaltsstatistik & PDF' },
];

const COLORS = {
  ink: '#0B2342',
  secondary: '#31597F',
  muted: '#60748C',
  border: '#B8D1EA',
  panel: '#F4F9FF',
  card: '#FFFFFF',
  blue: '#0867CF',
  blueSoft: '#E6F2FF',
  green: '#16784A',
  orange: '#A44B08',
} as const;

function formatDays(days: number | null): string {
  if (days == null) return '—';
  return `${days.toLocaleString('de-DE', { maximumFractionDigits: 1 })} T.`;
}

function formatSignedDuration(minutes: number): string {
  if (minutes === 0) return '0 Min.';
  const sign = minutes > 0 ? '+' : '−';
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  return hours > 0 ? `${sign}${hours}:${String(rest).padStart(2, '0')} h` : `${sign}${rest} Min.`;
}

function MetricCard({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: 'default' | 'good' | 'warning' }) {
  const valueColor = tone === 'good' ? COLORS.green : tone === 'warning' ? COLORS.orange : COLORS.ink;
  return (
    <PremiumCard style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </PremiumCard>
  );
}

function ProgressLine({ label, value, total, valueLabel }: { label: string; value: number; total: number; valueLabel: string }) {
  const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;
  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{valueLabel}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

export function WfmEmployeeTimeAccountWorkspace({ account, tenantId, reviewerId, roleKey, canCorrect, canManage, periodLabel, onClose }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<AccountTab>('overview');
  const openEntries = useMemo(() => listOpenReviewEntriesForEmployee(account), [account]);
  const missingEntries = useMemo(() => account.entries.filter((entry) => entry.flags.includes('missing_booking')), [account.entries]);
  const unplannedEntries = useMemo(() => account.entries.filter((entry) => entry.flags.includes('unplanned')), [account.entries]);

  async function openPayrollPdf(path: string | null) {
    if (!path) return;
    const result = await getPayrollPdfUrl(path);
    if (result.ok) await Linking.openURL(result.data);
  }

  return (
    <View style={styles.root} testID="wfm-employee-time-account-workspace">
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>MITARBEITENDENKONTO · {periodLabel.toUpperCase()}</Text>
          <Text style={styles.title}>{account.employeeName}</Text>
          <View style={styles.badges}>
            <PremiumBadge label={openEntries.length ? `${openEntries.length} OFFENE PRÜFUNGEN` : 'PRÜFSTAND AKTUELL'} variant={openEntries.length ? 'orange' : 'green'} />
            <PremiumBadge label={`${account.entries.length} ZEITBUCHUNGEN`} variant="cyan" />
          </View>
        </View>
        <View style={styles.heroActions}>
          <PremiumButton title="Nachtrag erfassen" variant="secondary" disabled={!canManage} onPress={() => router.push('/business/office/time-tracking/nachtraege' as never)} />
          <PremiumButton title="Offene Fälle prüfen" disabled={!openEntries.length} onPress={() => setTab('bookings')} />
          <PremiumButton title="Schließen" variant="ghost" onPress={onClose} />
        </View>
      </View>

      <SegmentedTabs tabs={TABS} activeKey={tab} onSelect={(key) => setTab(key as AccountTab)} layout="wrap" />

      {tab === 'overview' ? (
        <View style={styles.sectionStack}>
          <View style={styles.metrics}>
            <MetricCard label="Sollzeit" value={formatWfmDurationMinutes(account.targetMinutes || account.plannedMinutes)} hint="Vertrag im Zeitraum" />
            <MetricCard label="Istzeit" value={formatWfmDurationMinutes(account.actualMinutes)} hint={`${account.entries.length} Buchungen`} />
            <MetricCard label="Saldo" value={formatSignedDuration(account.saldoMinutes)} hint={account.saldoMinutes >= 0 ? 'Guthaben' : 'Rückstand'} tone={account.saldoMinutes >= 0 ? 'good' : 'warning'} />
            <MetricCard label="Genehmigt" value={formatWfmDurationMinutes(account.approvedMinutes)} hint="Geprüfte Arbeitszeit" />
            <MetricCard label="Fahrzeit" value={formatWfmDurationMinutes(account.travelMinutes)} hint="Aus Zeitkonto" />
            <MetricCard label="Abwesenheit" value={formatWfmDurationMinutes(account.absenceMinutes)} hint="Gutgeschriebene Zeit" />
            <MetricCard label="Resturlaub" value={formatDays(account.remainingVacationDays)} hint={`${formatDays(account.vacationDaysUsed)} genommen`} />
            <MetricCard label="Krankheit" value={formatDays(account.sickDays)} hint="Im Kalenderjahr" />
          </View>

          <View style={styles.twoColumns}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Monatsfortschritt</Text>
              <Text style={styles.panelSubtitle}>Erfassung, Prüfung und Export auf einen Blick</Text>
              <ProgressLine label="Erfasst gegen Soll" value={account.actualMinutes} total={account.targetMinutes || account.plannedMinutes} valueLabel={`${formatWfmDurationMinutes(account.actualMinutes)} / ${formatWfmDurationMinutes(account.targetMinutes || account.plannedMinutes)}`} />
              <ProgressLine label="Genehmigt" value={account.approvedMinutes} total={account.actualMinutes} valueLabel={formatWfmDurationMinutes(account.approvedMinutes)} />
              <ProgressLine label="Exportiert" value={account.exportedMinutes} total={account.approvedMinutes} valueLabel={formatWfmDurationMinutes(account.exportedMinutes)} />
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Handlungsbedarf</Text>
              <Text style={styles.panelSubtitle}>Nur Punkte, die noch bearbeitet werden müssen</Text>
              <View style={styles.issueRow}><Text style={styles.issueLabel}>Offene Prüfungen</Text><PremiumBadge label={String(openEntries.length)} variant={openEntries.length ? 'orange' : 'green'} /></View>
              <View style={styles.issueRow}><Text style={styles.issueLabel}>Fehlende Buchungen</Text><PremiumBadge label={String(missingEntries.length)} variant={missingEntries.length ? 'orange' : 'muted'} /></View>
              <View style={styles.issueRow}><Text style={styles.issueLabel}>Ungeplante Zeiten</Text><PremiumBadge label={String(unplannedEntries.length)} variant={unplannedEntries.length ? 'orange' : 'muted'} /></View>
              <View style={styles.actionRow}>
                <PremiumButton title="Zeitbuchungen bearbeiten" variant="secondary" onPress={() => setTab('bookings')} />
                <PremiumButton title="Fahrtenbuch öffnen" variant="secondary" onPress={() => setTab('logbook')} />
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {tab === 'bookings' ? (
        <View style={styles.sectionStack}>
          {!canCorrect ? <InfoBanner message="Sie können Zeitbuchungen prüfen. Für direkte Zeitkorrekturen fehlt Ihrer Rolle die Berechtigung ‚Arbeitszeit-Korrekturen bearbeiten‘." variant="warning" /> : null}
          <WfmOfficeTimeHistoryPanel tenantId={tenantId} reviewerId={reviewerId} roleKey={roleKey} canCorrect={canCorrect} initialEmployeeId={account.employeeId} initialEmployeeName={account.employeeName} initialPreset="this_month" lockEmployeeFilter />
        </View>
      ) : null}

      {tab === 'logbook' ? (
        <EmployeeLogbookOfficePanel tenantId={tenantId} employeeId={account.employeeId} employeeName={account.employeeName} canEdit={canManage} />
      ) : null}

      {tab === 'absence' ? (
        <View style={styles.sectionStack}>
          <View style={styles.metrics}>
            <MetricCard label="Urlaub genommen" value={formatDays(account.vacationDaysUsed)} hint={`Anspruch ${formatDays(account.annualVacationDays)}`} />
            <MetricCard label="Resturlaub" value={formatDays(account.remainingVacationDays)} hint="Verfügbarer Anspruch" />
            <MetricCard label="Krankheit" value={formatDays(account.sickDays)} hint="Im Kalenderjahr" />
            <MetricCard label="Zeitgutschrift" value={formatWfmDurationMinutes(account.absenceMinutes)} hint="Im gewählten Zeitraum" />
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Abwesenheiten verwalten</Text>
            <Text style={styles.panelSubtitle}>Urlaub, Krankheit und sonstige Abwesenheiten werden im zentralen Antrags- und Freigabebereich bearbeitet.</Text>
            <View style={styles.actionRow}>
              <PremiumButton title="Abwesenheiten öffnen" onPress={() => router.push('/business/office/time-tracking/abwesenheiten' as never)} />
              <PremiumButton title="Historie anzeigen" variant="secondary" onPress={() => router.push('/business/office/time-tracking/historie' as never)} />
            </View>
          </View>
        </View>
      ) : null}

      {tab === 'payroll' ? (
        <View style={styles.sectionStack}>
          <View style={styles.actionRow}>
            <PremiumButton title="Gehaltsstatistik öffnen" onPress={() => router.push('/business/office/payroll' as never)} />
            <PremiumButton title="Arbeitszeit exportieren" variant="secondary" onPress={() => router.push('/business/office/time-tracking/export' as never)} />
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Gespeicherte Monatsabschlüsse</Text>
            <Text style={styles.panelSubtitle}>Versionierte Gehaltsstatistiken und PDF-Nachweise</Text>
            {!account.payrollStatements.length ? (
              <InfoBanner message="Für diese Person ist noch kein Monatsabschluss mit PDF gespeichert. Öffnen Sie die Gehaltsstatistik, prüfen Sie den Monat und erstellen Sie anschließend den Abschluss." variant="info" />
            ) : account.payrollStatements.map((statement) => (
              <View key={statement.id} style={styles.statementRow}>
                <View style={styles.statementCopy}>
                  <Text style={styles.statementTitle}>{String(statement.periodMonth).padStart(2, '0')}/{statement.periodYear}</Text>
                  <Text style={styles.statementMeta}>Version {statement.version} · {statement.status}</Text>
                </View>
                <PremiumButton title={statement.pdfPath ? 'PDF öffnen' : 'PDF fehlt'} size="sm" variant="secondary" disabled={!statement.pdfPath} onPress={() => void openPayrollPdf(statement.pdfPath)} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', gap: careSpacing.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: careSpacing.md, backgroundColor: COLORS.panel },
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: careSpacing.md, padding: careSpacing.lg, borderRadius: 16, backgroundColor: '#0D3159' },
  heroCopy: { flex: 1, minWidth: 260, gap: 6 },
  eyebrow: { color: '#8ED4FF', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, fontWeight: '900' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: careSpacing.xs },
  sectionStack: { gap: careSpacing.md },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  metricCard: { flexGrow: 1, flexBasis: 185, minWidth: 170, maxWidth: 280, minHeight: 112, padding: careSpacing.md, borderColor: '#C7DBEF', backgroundColor: COLORS.card },
  metricLabel: { color: COLORS.secondary, fontSize: 11, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { marginTop: 7, fontSize: 23, lineHeight: 29, fontWeight: '900' },
  metricHint: { marginTop: 4, color: COLORS.muted, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.md },
  panel: { flex: 1, minWidth: 300, gap: careSpacing.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: careSpacing.md, backgroundColor: COLORS.card },
  panelTitle: { color: COLORS.ink, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  panelSubtitle: { color: COLORS.secondary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  progressBlock: { gap: 5, paddingTop: careSpacing.xs },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: careSpacing.sm },
  progressLabel: { color: COLORS.ink, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  progressValue: { color: COLORS.secondary, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  progressTrack: { height: 9, overflow: 'hidden', borderRadius: 99, backgroundColor: '#DDEAF7' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: COLORS.blue },
  issueRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: careSpacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D8E5F2' },
  issueLabel: { color: COLORS.ink, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm, alignItems: 'center' },
  statementRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: careSpacing.sm, paddingVertical: careSpacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D8E5F2' },
  statementCopy: { flex: 1, gap: 2 },
  statementTitle: { color: COLORS.ink, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  statementMeta: { color: COLORS.secondary, fontSize: 11, lineHeight: 15, fontWeight: '600' },
});
