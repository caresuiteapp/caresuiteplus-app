import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
} from '@/components/ui';
import { ClientBudgetVisualCards } from '@/components/office/ClientBudgetVisualCards';
import {
  BudgetCorrectionModal,
  BudgetRecalcModal,
  ConversionToggleModal,
  ExternalSachleistungModal,
  EditCareFundModal,
  EditCareGradeModal,
  EditValidFromModal,
} from '@/components/office/ClientCareGradeBudgetsModals';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { getClientAssistBillingProfile } from '@/lib/assist/clientAssistBillingProfileService';
import { listClientBudgetTransactions } from '@/lib/assist/clientBudgetAccountService';
import { resolveClientBillingWarning } from '@/lib/assist/clientBillingWarningsService';
import { buildClientBudgetVisualModels } from '@/lib/assist/clientBudgetVisuals';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { formatDateTime } from '@/lib/formatters/dateTimeFormatters';
import {
  CLIENT_BUDGET_TRANSACTION_LABELS,
  type ClientAssistBillingProfile,
  type ClientBudgetTransaction,
} from '@/types/assist/clientAssistBilling';
import { colors, spacing, typography } from '@/theme';

function useBillingProfile(clientId: string) {
  const tenantId = useServiceTenantId();
  return useAsyncQuery<ClientAssistBillingProfile>(
    () => {
      if (!tenantId || !clientId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Klient:in.' });
      }
      return getClientAssistBillingProfile({
        tenantId,
        clientId,
        autoGenerateAccounts: true,
      }) as Promise<{ ok: true; data: ClientAssistBillingProfile } | { ok: false; error: string }>;
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );
}

type BudgetModal =
  | 'careGrade'
  | 'careFund'
  | 'validFrom'
  | 'conversion'
  | 'correction'
  | 'recalc'
  | 'externalSachleistung'
  | null;

function monthLabel(date: string): string {
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(parsed);
}

function BudgetTransactionTimeline({
  loading,
  transactions,
}: {
  loading: boolean;
  transactions: ClientBudgetTransaction[];
}) {
  const text = useAuroraAdaptiveText();
  if (loading && transactions.length === 0) return <LoadingState message="Budgetbewegungen werden geladen…" />;
  if (transactions.length === 0) {
    return (
      <EmptyState
        title="Noch keine Budgetbewegung"
        message="Sobald ein Einsatz geplant, abgeschlossen oder korrigiert wird, erscheint er hier verständlich und chronologisch."
      />
    );
  }

  return (
    <View style={styles.timeline}>
      {transactions.slice(0, 12).map((transaction, index) => {
        const isUsage = transaction.transactionType === 'usage';
        const isReservation = transaction.transactionType === 'reservation';
        const accent = isUsage ? '#4CC9F0' : isReservation ? '#8B7CFF' : '#65F2A7';
        return (
          <View key={transaction.id} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, { backgroundColor: accent }]} />
              {index < Math.min(transactions.length, 12) - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={styles.timelineContent}>
              <View style={styles.timelineTopline}>
                <Text style={[styles.timelineTitle, { color: text.primary }]}>
                  {CLIENT_BUDGET_TRANSACTION_LABELS[transaction.transactionType]}
                </Text>
                <Text style={[styles.timelineAmount, { color: accent }]}>
                  {formatCurrency(transaction.amountCents, true)}
                </Text>
              </View>
              <Text style={[styles.timelineMeta, { color: text.secondary }]}>
                {transaction.accountLabel ?? transaction.catalogKey ?? 'Budget'} · {formatDateTime(transaction.createdAt)}
              </Text>
              {transaction.note ? (
                <Text style={[styles.timelineNote, { color: text.secondary }]}>{transaction.note}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Completely rebuilt, client-readable budget workspace. */
export function ClientCareGradeBudgetsPanel({
  clientId,
  onRecordRefresh,
}: {
  clientId: string;
  onRecordRefresh?: () => void;
}) {
  const tenantId = useServiceTenantId();
  const text = useAuroraAdaptiveText();
  const { isReadOnly } = usePermissions();
  const profileQuery = useBillingProfile(clientId);
  const [typeFilter, setTypeFilter] = useState('all');
  const [modal, setModal] = useState<BudgetModal>(null);

  const transactionsQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId || !profileQuery.data) {
        return Promise.resolve({ ok: false as const, error: 'Budgetprofil fehlt.' });
      }
      return listClientBudgetTransactions(tenantId, clientId, {
        transactionType: typeFilter === 'all' ? undefined : typeFilter,
        limit: 50,
      });
    },
    [tenantId, clientId, typeFilter, profileQuery.data?.budgetYear],
    { enabled: !!tenantId && !!clientId && !!profileQuery.data },
  );

  async function refreshAll() {
    await profileQuery.refresh();
    await transactionsQuery.refresh();
    onRecordRefresh?.();
  }

  async function resolveWarning(warningId: string) {
    if (!tenantId || isReadOnly) return;
    await resolveClientBillingWarning(tenantId, clientId, warningId);
    await refreshAll();
  }

  if (profileQuery.loading && !profileQuery.data) {
    return <LoadingState message="Persönliche Budgetübersicht wird aufgebaut…" />;
  }
  if (profileQuery.error && !profileQuery.data) {
    return <ErrorState message={profileQuery.error} onRetry={profileQuery.refresh} />;
  }

  const profile = profileQuery.data;
  if (!profile) return null;
  const visuals = buildClientBudgetVisualModels(profile);
  const transactions = transactionsQuery.data ?? [];
  const hourlyRate = visuals.find((item) => item.hourlyRateCents)?.hourlyRateCents ?? null;
  const unresolvedWarnings = profile.warnings.filter((warning) => !warning.isResolved);

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={['rgba(4,18,48,0.98)', 'rgba(10,48,94,0.92)', 'rgba(5,23,55,0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroGlow} />
        <View style={styles.heroMain}>
          <Text style={styles.kicker}>PERSÖNLICHE LEISTUNGSRESERVE</Text>
          <Text style={styles.heroTitle}>Budget auf einen Blick</Text>
          <Text style={styles.heroSubtitle}>
            Geld, mögliche Stunden und Pflegegeldwirkung – ohne Fachbegriffe und automatisch aktuell.
          </Text>
        </View>
        <View style={styles.heroFacts}>
          <View style={styles.heroFact}>
            <Text style={styles.heroFactLabel}>Zeitraum</Text>
            <Text style={styles.heroFactValue}>{monthLabel(profile.asOfDate)}</Text>
          </View>
          <View style={styles.heroFact}>
            <Text style={styles.heroFactLabel}>Pflegegrad</Text>
            <Text style={styles.heroFactValue}>{formatCareLevel(profile.careGrade ?? 'kein') || 'Nicht hinterlegt'}</Text>
          </View>
          <View style={styles.heroFact}>
            <Text style={styles.heroFactLabel}>Stundensatz</Text>
            <Text style={styles.heroFactValue}>
              {hourlyRate ? `${formatCurrency(hourlyRate, true)} / Std.` : 'Bitte hinterlegen'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ClientBudgetVisualCards models={visuals} />

      {!isReadOnly ? (
        <View style={styles.actionBar}>
          <View style={styles.actionCopy}>
            <Text style={[styles.actionTitle, { color: text.primary }]}>Verwaltung</Text>
            <Text style={[styles.actionSubtitle, { color: text.secondary }]}>Nur öffnen, was tatsächlich geändert werden soll.</Text>
          </View>
          <View style={styles.actions}>
            <PremiumButton title="Betrag anpassen" variant="secondary" onPress={() => setModal('correction')} />
            <PremiumButton title="Pflegegrad" variant="secondary" onPress={() => setModal('careGrade')} />
            <PremiumButton
              title={profile.careEntitlement?.conversionEnabled ? 'Umwandlung pausieren' : 'Umwandlung aktivieren'}
              variant="secondary"
              onPress={() => setModal('conversion')}
              disabled={!visuals[1].eligible}
            />
            <PremiumButton
              title="Pflegedienstanteil"
              variant="secondary"
              onPress={() => setModal('externalSachleistung')}
              disabled={!visuals[1].eligible}
            />
            <PremiumButton title="Neu berechnen" variant="ghost" onPress={() => setModal('recalc')} />
          </View>
        </View>
      ) : null}

      {unresolvedWarnings.length > 0 ? (
        <View style={styles.warningStack}>
          {unresolvedWarnings.map((warning) => (
            <View key={warning.id} style={styles.warningRow}>
              <InfoBanner
                message={warning.message}
                variant={warning.severity === 'critical' ? 'danger' : 'warning'}
              />
              {!isReadOnly ? (
                <PremiumButton title="Geklärt" variant="secondary" onPress={() => resolveWarning(warning.id)} />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.historySection}>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: text.primary }]}>Was hat sich verändert?</Text>
            <Text style={[styles.sectionSubtitle, { color: text.secondary }]}>Die letzten Budgetbewegungen in verständlicher Reihenfolge.</Text>
          </View>
          <PremiumBadge label="Automatisch aktuell" variant="green" />
        </View>
        <FilterChipGroup
          options={[
            { key: 'all', label: 'Alles' },
            { key: 'usage', label: 'Verbraucht' },
            { key: 'reservation', label: 'Geplant' },
            { key: 'adjustment', label: 'Angepasst' },
          ]}
          value={typeFilter}
          onChange={setTypeFilter}
        />
        <BudgetTransactionTimeline loading={transactionsQuery.loading} transactions={transactions} />
      </View>

      <View style={styles.secondaryActions}>
        {!isReadOnly ? (
          <>
            <Pressable onPress={() => setModal('careFund')} style={styles.textAction}>
              <Text style={[styles.textActionLabel, { color: colors.cyan }]}>Pflegekasse ändern</Text>
            </Pressable>
            <Pressable onPress={() => setModal('validFrom')} style={styles.textAction}>
              <Text style={[styles.textActionLabel, { color: colors.cyan }]}>Gültigkeitsdatum ändern</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      <EditCareGradeModal visible={modal === 'careGrade'} onClose={() => setModal(null)} onSaved={refreshAll} isReadOnly={isReadOnly} clientId={clientId} profile={profile} />
      <EditCareFundModal visible={modal === 'careFund'} onClose={() => setModal(null)} onSaved={refreshAll} isReadOnly={isReadOnly} clientId={clientId} profile={profile} />
      <EditValidFromModal visible={modal === 'validFrom'} onClose={() => setModal(null)} onSaved={refreshAll} isReadOnly={isReadOnly} clientId={clientId} profile={profile} />
      <ConversionToggleModal visible={modal === 'conversion'} onClose={() => setModal(null)} onSaved={refreshAll} isReadOnly={isReadOnly} clientId={clientId} profile={profile} />
      <BudgetCorrectionModal visible={modal === 'correction'} onClose={() => setModal(null)} onSaved={refreshAll} isReadOnly={isReadOnly} clientId={clientId} accounts={profile.budgetAccounts} />
      <ExternalSachleistungModal visible={modal === 'externalSachleistung'} onClose={() => setModal(null)} onSaved={refreshAll} isReadOnly={isReadOnly} accounts={profile.budgetAccounts} />
      <BudgetRecalcModal visible={modal === 'recalc'} onClose={() => setModal(null)} onSaved={refreshAll} isReadOnly={isReadOnly} clientId={clientId} profile={profile} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg, paddingBottom: spacing.xxl },
  hero: { borderRadius: 32, padding: spacing.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(125,211,252,0.22)', gap: spacing.xl },
  heroGlow: { position: 'absolute', width: 330, height: 330, borderRadius: 999, right: -100, top: -190, backgroundColor: 'rgba(59,231,255,0.15)' },
  heroMain: { maxWidth: 760, gap: spacing.xs },
  kicker: { color: '#68E8FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { color: '#FFFFFF', fontSize: 34, lineHeight: 42, fontWeight: '900', letterSpacing: -1 },
  heroSubtitle: { color: 'rgba(226,242,255,0.70)', fontSize: 15, lineHeight: 22, maxWidth: 680 },
  heroFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  heroFact: { minWidth: 165, flexGrow: 1, padding: spacing.md, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  heroFactLabel: { color: 'rgba(226,242,255,0.55)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroFactValue: { color: '#FFFFFF', fontSize: 15, lineHeight: 21, fontWeight: '800', marginTop: 4, textTransform: 'capitalize' },
  actionBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.lg, borderRadius: 24, backgroundColor: 'rgba(8,30,65,0.56)', borderWidth: 1, borderColor: 'rgba(125,211,252,0.14)' },
  actionCopy: { gap: 2 },
  actionTitle: { ...typography.label, fontSize: 16 },
  actionSubtitle: { ...typography.caption },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  warningStack: { gap: spacing.sm },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historySection: { padding: spacing.xl, borderRadius: 28, backgroundColor: 'rgba(7,24,54,0.42)', borderWidth: 1, borderColor: 'rgba(125,211,252,0.12)', gap: spacing.lg },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  sectionTitle: { fontSize: 22, lineHeight: 29, fontWeight: '900', letterSpacing: -0.4 },
  sectionSubtitle: { ...typography.caption, marginTop: 3 },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: spacing.md, minHeight: 78 },
  timelineRail: { width: 16, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 999, marginTop: 5, borderWidth: 2, borderColor: 'rgba(255,255,255,0.70)' },
  timelineLine: { width: 1, flex: 1, marginVertical: 4, backgroundColor: 'rgba(125,211,252,0.20)' },
  timelineContent: { flex: 1, paddingBottom: spacing.lg },
  timelineTopline: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  timelineTitle: { ...typography.label },
  timelineAmount: { fontSize: 14, fontWeight: '900' },
  timelineMeta: { ...typography.caption, marginTop: 3 },
  timelineNote: { ...typography.caption, marginTop: spacing.xs, lineHeight: 18 },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'flex-end' },
  textAction: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  textActionLabel: { fontSize: 12, fontWeight: '800' },
});
