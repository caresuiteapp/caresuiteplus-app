import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { PortalTabScreen } from './PortalTabScreen';
import {
  EmptyState, ErrorState, InfoBanner, LoadingState, PremiumBadge,
  PremiumButton, PremiumCard, PremiumInput, SectionPanel,
} from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { spatialCare } from '@/design/tokens/spatialCareSuite';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePortalActor } from '@/hooks/usePortalActor';
import {
  createExpenseClaim, decidePayrollStatement,
  formatPayrollMoney, formatPayrollMinutes, getPayrollPdfUrl,
  loadEmployeePayrollMonth, uploadExpenseReceipt,
} from '@/lib/payroll';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '@/types/modules/payrollMonth';
import { typography } from '@/theme';

const expenseCategories = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];
const expenseStatus: Record<string, string> = { draft: 'Entwurf', submitted: 'Zur Prüfung', needs_info: 'Rückfrage', approved: 'Genehmigt', partially_approved: 'Teilweise genehmigt', rejected: 'Abgelehnt', reimbursed: 'Erstattet' };
const statementStatus: Record<string, string> = { published: 'Bitte prüfen', confirmed: 'Bestätigt', rejected: 'Abgelehnt', locked: 'Gesperrt', paid: 'Ausgezahlt' };

export function EmployeePayrollMonthScreen() {
  const now = new Date(); const actor = usePortalActor();
  const [year, setYear] = useState(now.getFullYear()); const [month, setMonth] = useState(now.getMonth() + 1);
  const [category, setCategory] = useState<ExpenseCategory>('receipt');
  const [expenseDate, setExpenseDate] = useState(now.toISOString().slice(0, 10));
  const [description, setDescription] = useState(''); const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState(''); const [mileageKm, setMileageKm] = useState('');
  const [mileageRate, setMileageRate] = useState('0,30'); const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState(''); const [vehicle, setVehicle] = useState('');
  const [receipt, setReceipt] = useState<{ uri: string; name: string; mimeType?: string | null } | null>(null);
  const [rejectReason, setRejectReason] = useState(''); const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const query = useAsyncQuery(useCallback(async () => {
    if (!actor.tenantId || !actor.employeeId) return { ok: false as const, error: 'Mitarbeitendenkonto ist nicht vollständig verknüpft.' };
    return loadEmployeePayrollMonth(actor.tenantId, actor.employeeId, year, month);
  }, [actor.tenantId, actor.employeeId, year, month]), [actor.tenantId, actor.employeeId, year, month], { enabled: !!actor.tenantId && !!actor.employeeId });
  const label = useMemo(() => new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }), [year, month]);
  const changeMonth = (delta: number) => { const date = new Date(year, month - 1 + delta, 1); setYear(date.getFullYear()); setMonth(date.getMonth() + 1); setMessage(null); };
  async function chooseReceipt() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) setReceipt({ uri: result.assets[0].uri, name: result.assets[0].name, mimeType: result.assets[0].mimeType });
  }
  async function submitExpense() {
    if (!actor.tenantId || !actor.employeeId) return; setSaving(true); setMessage(null);
    let receiptPath: string | null = null;
    if (category !== 'mileage' && !receipt) { setSaving(false); setMessage('Bitte laden Sie die Quittung, Rechnung oder das Ticket als Beleg hoch.'); return; }
    if (receipt) { const uploaded = await uploadExpenseReceipt({ tenantId: actor.tenantId, employeeId: actor.employeeId, uri: receipt.uri, fileName: receipt.name, mimeType: receipt.mimeType }); if (!uploaded.ok) { setSaving(false); setMessage(uploaded.error); return; } receiptPath = uploaded.data.path; }
    const km = Number(mileageKm.replace(',', '.')); const rateCents = Math.round(Number(mileageRate.replace(',', '.')) * 100);
    const amountCents = category === 'mileage' ? Math.round(km * rateCents) : Math.round(Number(amount.replace(',', '.')) * 100);
    const result = await createExpenseClaim({ tenantId: actor.tenantId, employeeId: actor.employeeId, expenseDate, category, description, businessPurpose: purpose, amountCents, receiptPath, mileageKm: category === 'mileage' ? km : null, mileageRateCents: category === 'mileage' ? rateCents : null, origin: origin || null, destination: destination || null, vehicleLabel: vehicle || null });
    setSaving(false); if (!result.ok) { setMessage(result.error); return; }
    setMessage('Auslage wurde mit Beleg zur Prüfung eingereicht.'); setDescription(''); setPurpose(''); setAmount(''); setMileageKm(''); setOrigin(''); setDestination(''); setVehicle(''); setReceipt(null); await query.refresh();
  }
  async function decide(decision: 'confirm' | 'reject') {
    const statement = query.data?.statement; if (!statement) return; setSaving(true); setMessage(null);
    const result = await decidePayrollStatement(statement.id, decision, rejectReason); setSaving(false);
    if (!result.ok) { setMessage(result.error); return; } setMessage(decision === 'confirm' ? 'Monatsübersicht verbindlich bestätigt.' : 'Monatsübersicht wurde mit Begründung abgelehnt.'); setRejectReason(''); await query.refresh();
  }
  async function open(path: string | null) { if (!path) return; const result = await getPayrollPdfUrl(path); if (!result.ok) { setMessage(result.error); return; } await Linking.openURL(result.data); }

  if (query.loading && !query.data) return <PortalTabScreen title="Gehalt & Auslagen"><LoadingState message="Monatsübersicht wird geladen…" /></PortalTabScreen>;
  if (query.error && !query.data) return <PortalTabScreen title="Gehalt & Auslagen"><ErrorState title="Nicht verfügbar" message={query.error} onRetry={() => void query.refresh()} /></PortalTabScreen>;
  const statement = query.data?.statement; const snapshot = statement?.snapshot;
  return <PortalTabScreen title="Gehalt & Auslagen" subtitle="Monatsübersicht prüfen, PDF bestätigen und Auslagen einreichen" scroll>
    <View style={styles.page} testID="employee-payroll-month-screen">
      <View style={styles.monthBar}><PremiumButton title="←" size="sm" variant="secondary" onPress={() => changeMonth(-1)} /><Text style={styles.monthTitle}>{label}</Text><PremiumButton title="→" size="sm" variant="secondary" onPress={() => changeMonth(1)} /></View>
      {message ? <InfoBanner message={message} /> : null}
      <SectionPanel title="Meine Monatsübersicht" subtitle="Erfasste Werte und Planung bis Monatsende">
        {!statement || !snapshot ? <EmptyState title="Noch nicht veröffentlicht" message="Office hat für diesen Monat noch keine PDF-Übersicht zur Prüfung freigegeben." /> : <PremiumCard style={styles.statement}>
          <View style={styles.heading}><View><Text style={styles.title}>Version {statement.version}</Text><Text style={styles.muted}>Stand {new Date(snapshot.generatedAt).toLocaleString('de-DE')}</Text></View><PremiumBadge label={statementStatus[statement.status] ?? statement.status} variant={statement.status === 'confirmed' || statement.status === 'paid' ? 'green' : statement.status === 'rejected' ? 'orange' : 'cyan'} /></View>
          <View style={styles.metrics}><Text style={styles.metric}>Arbeitszeit <Text style={styles.strong}>{formatPayrollMinutes(snapshot.actualWorkMinutes)}</Text></Text><Text style={styles.metric}>Fahrzeit <Text style={styles.strong}>{formatPayrollMinutes(snapshot.travelMinutes)}</Text></Text><Text style={styles.metric}>Urlaub <Text style={styles.strong}>{formatPayrollMinutes(snapshot.vacationMinutes)}</Text></Text><Text style={styles.metric}>Krank <Text style={styles.strong}>{formatPayrollMinutes(snapshot.sickMinutes)}</Text></Text><Text style={styles.metric}>Geplant <Text style={styles.strong}>{formatPayrollMinutes(snapshot.plannedMinutes)}</Text></Text><Text style={styles.metric}>Zeitkonto <Text style={styles.strong}>+ {formatPayrollMinutes(snapshot.overtimeTransferMinutes)}</Text></Text></View>
          <View style={styles.moneyGrid}><View><Text style={styles.muted}>Erarbeitetes Brutto</Text><Text style={styles.money}>{formatPayrollMoney(snapshot.earnedGrossCents)}</Text></View><View><Text style={styles.muted}>Voraussichtliches Brutto</Text><Text style={styles.money}>{formatPayrollMoney(snapshot.projectedGrossCents)}</Text></View><View><Text style={styles.muted}>Genehmigte Auslagen</Text><Text style={styles.money}>{formatPayrollMoney(snapshot.approvedExpensesCents)}</Text></View><View><Text style={styles.muted}>Voraussichtliche Gesamtauszahlung</Text><Text style={styles.total}>{formatPayrollMoney(snapshot.projectedTotalPayoutCents)}</Text></View></View>
          <InfoBanner message="Geplante Einsätze sind als Prognose gekennzeichnet und noch keine endgültig erarbeitete Vergütung." />
          <PremiumButton title="PDF-Vorschau öffnen" variant="secondary" onPress={() => void open(statement.pdfPath)} />
          {statement.status === 'published' ? <View style={styles.decision}><Text style={styles.title}>Ist die Monatsübersicht vollständig und richtig?</Text><PremiumInput label="Ablehnungsgrund (nur bei Ablehnung)" placeholder="Zum Beispiel: Mir fehlen noch Stunden vom …" value={rejectReason} onChangeText={setRejectReason} multiline /><View style={styles.actions}><PremiumButton title="Verbindlich bestätigen" loading={saving} onPress={() => void decide('confirm')} /><PremiumButton title="Ablehnen" variant="secondary" loading={saving} onPress={() => void decide('reject')} /></View></View> : null}
          {statement.status === 'confirmed' || statement.status === 'locked' || statement.status === 'paid' ? <InfoBanner message="Diese Version wurde bestätigt. Sie kann nur noch als PDF geöffnet und nicht mehr verändert werden." /> : null}
          {statement.employeeDecisionReason ? <InfoBanner message={`Ihr Ablehnungsgrund: ${statement.employeeDecisionReason}`} /> : null}
        </PremiumCard>}
      </SectionPanel>
      <SectionPanel title="Neue Auslage einreichen" subtitle="Quittungen, Kilometer, Tickets und sonstige dienstliche Kosten">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>{expenseCategories.map((key) => <Pressable key={key} onPress={() => setCategory(key)} style={[styles.category, category === key && styles.categoryActive]}><Text style={[styles.categoryText, category === key && styles.categoryTextActive]}>{EXPENSE_CATEGORY_LABELS[key]}</Text></Pressable>)}</ScrollView>
        <View style={styles.form}><PremiumInput label="Datum (JJJJ-MM-TT)" value={expenseDate} onChangeText={setExpenseDate} /><PremiumInput label="Beschreibung" value={description} onChangeText={setDescription} placeholder="Was wurde bezahlt?" /><PremiumInput label="Geschäftlicher Zweck" value={purpose} onChangeText={setPurpose} placeholder="Bezug zum Einsatz / zur Tätigkeit" />
          {category === 'mileage' ? <><View style={styles.twoCols}><PremiumInput label="Kilometer" value={mileageKm} onChangeText={setMileageKm} keyboardType="decimal-pad" /><PremiumInput label="EUR je km" value={mileageRate} onChangeText={setMileageRate} keyboardType="decimal-pad" /></View><PremiumInput label="Start" value={origin} onChangeText={setOrigin} /><PremiumInput label="Ziel" value={destination} onChangeText={setDestination} /><PremiumInput label="Fahrzeug / Kennzeichen" value={vehicle} onChangeText={setVehicle} /></> : <PremiumInput label="Betrag (EUR)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />}
          <View style={styles.actions}><PremiumButton title={receipt ? `Beleg: ${receipt.name}` : category === 'mileage' ? 'Optionalen Beleg auswählen' : 'Quittung / Ticket auswählen'} variant="secondary" onPress={() => void chooseReceipt()} /><PremiumButton title="Auslage einreichen" loading={saving} onPress={() => void submitExpense()} /></View>
        </View>
      </SectionPanel>
      <SectionPanel title="Meine Auslagen" subtitle="Prüf- und Erstattungsstatus">
        {!query.data?.expenses.length ? <EmptyState title="Keine Auslagen" message="Für diesen Monat wurden noch keine Auslagen eingereicht." /> : query.data.expenses.map((claim) => <PremiumCard key={claim.id} style={styles.expense}><View style={styles.heading}><View style={styles.flex}><Text style={styles.strong}>{claim.description}</Text><Text style={styles.muted}>{claim.expenseDate} · {EXPENSE_CATEGORY_LABELS[claim.category]}</Text></View><PremiumBadge label={expenseStatus[claim.status] ?? claim.status} variant={claim.status === 'approved' || claim.status === 'reimbursed' ? 'green' : claim.status === 'rejected' ? 'orange' : 'cyan'} /></View><Text style={styles.amount}>{formatPayrollMoney(claim.approvedAmountCents ?? claim.amountCents)}</Text>{claim.receiptPath ? <PremiumButton title="Beleg öffnen" size="sm" variant="ghost" onPress={() => void open(claim.receiptPath)} /> : null}{claim.officeNote ? <Text style={styles.muted}>Office: {claim.officeNote}</Text> : null}{claim.rejectionReason ? <Text style={styles.rejected}>Ablehnungsgrund: {claim.rejectionReason}</Text> : null}</PremiumCard>)}
      </SectionPanel>
    </View>
  </PortalTabScreen>;
}

const styles = StyleSheet.create({
  page: { width: '100%', gap: careSpacing.md }, monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: careSpacing.md }, monthTitle: { ...typography.h3, color: spatialCare.textOnNight, textTransform: 'capitalize' }, statement: { padding: careSpacing.lg, gap: careSpacing.md }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: careSpacing.sm }, title: { ...typography.h3, color: spatialCare.textOnNight }, muted: { ...typography.caption, color: spatialCare.textOnNightMuted }, flex: { flex: 1, minWidth: 0 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs }, metric: { ...typography.caption, color: spatialCare.textOnNightMuted, borderWidth: 1, borderColor: spatialCare.border, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 }, strong: { color: spatialCare.textOnNight, fontWeight: '700' }, moneyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.lg }, money: { ...typography.h3, color: spatialCare.textOnNight }, total: { ...typography.h2, color: '#6DE8FF' }, decision: { gap: careSpacing.sm, borderTopWidth: 1, borderTopColor: spatialCare.border, paddingTop: careSpacing.md }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm }, categoryRow: { gap: careSpacing.xs, paddingVertical: careSpacing.xs }, category: { borderWidth: 1, borderColor: spatialCare.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: spatialCare.input }, categoryActive: { borderColor: '#6DE8FF', backgroundColor: 'rgba(109,232,255,0.16)' }, categoryText: { ...typography.caption, color: spatialCare.textOnNightMuted }, categoryTextActive: { color: spatialCare.textOnNight, fontWeight: '700' }, form: { gap: careSpacing.sm }, twoCols: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm }, expense: { padding: careSpacing.md, gap: careSpacing.sm, marginBottom: careSpacing.sm }, amount: { ...typography.h3, color: '#6DE8FF' }, rejected: { ...typography.caption, color: '#FF9A7A' },
});
