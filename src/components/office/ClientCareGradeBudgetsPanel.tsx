import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  useAuroraAdaptiveText,
  useAuroraGlassActive,
} from '@/design/tokens/auroraGlass';
import { getClientAssistBillingProfile } from '@/lib/assist/clientAssistBillingProfileService';
import {
  buildAnspruchsOverviewItems,
  buildCompactBillingRules,
  hasAnspruchsData,
} from '@/lib/assist/clientCareGradeBudgetsViewModel';
import {
  ensureClientBudgetAccountsForDate,
  listClientBudgetTransactions,
} from '@/lib/assist/clientBudgetAccountService';
import { resolveClientBillingWarning } from '@/lib/assist/clientBillingWarningsService';
import {
  BudgetAccountsEditableGrid,
  BudgetInfoBanners,
  BudgetModeSwitch,
} from '@/components/office/ClientBudgetAccountsGrid';
import {
  BudgetCorrectionModal,
  BudgetRecalcModal,
  ConversionToggleModal,
  EditCareFundModal,
  EditCareGradeModal,
  EditValidFromModal,
} from '@/components/office/ClientCareGradeBudgetsModals';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { formatDate, formatDateTime } from '@/lib/formatters/dateTimeFormatters';
import {
  CLIENT_BUDGET_TRANSACTION_LABELS,
  type ClientAssistBillingProfile,
} from '@/types/assist/clientAssistBilling';
import { colors, spacing, typography } from '@/theme';

const FORM_CTX = { viewContext: 'form' as const };

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
        autoGenerateAccounts: false,
      }) as Promise<{ ok: true; data: ClientAssistBillingProfile } | { ok: false; error: string }>;
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );
}

/** Consolidated Klientenakte view: Pflegegrad & Budgets (sections A–F). */
export function ClientCareGradeBudgetsPanel({
  clientId,
  onRecordRefresh,
}: {
  clientId: string;
  onRecordRefresh?: () => void;
}) {
  const tenantId = useServiceTenantId();
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const glass = useAuroraGlassActive();
  const { isReadOnly } = usePermissions();
  const query = useBillingProfile(clientId);
  const [typeFilter, setTypeFilter] = useState('all');
  const [modal, setModal] = useState<
    'careGrade' | 'careFund' | 'validFrom' | 'conversion' | 'correction' | 'recalc' | null
  >(null);

  const txQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return listClientBudgetTransactions(tenantId, clientId, {
        budgetYear: query.data?.budgetYear ?? new Date().getFullYear(),
        transactionType: typeFilter === 'all' ? undefined : typeFilter,
        limit: 100,
      });
    },
    [tenantId, clientId, typeFilter, query.data?.budgetYear],
    { enabled: !!tenantId && !!clientId && !!query.data },
  );

  async function refreshAll() {
    await query.refresh();
    await txQuery.refresh();
    onRecordRefresh?.();
  }

  async function handleGenerate() {
    if (!tenantId || isReadOnly || !query.data?.careGrade) return;
    await ensureClientBudgetAccountsForDate(tenantId, clientId, query.data.careGrade);
    await refreshAll();
  }

  async function handleResolveWarning(warningId: string) {
    if (!tenantId || isReadOnly) return;
    await resolveClientBillingWarning(tenantId, clientId, warningId);
    await refreshAll();
  }

  if (query.loading && !query.data) {
    return <LoadingState message="Pflegegrad & Budgets werden geladen…" />;
  }
  if (query.error && !query.data) {
    return <ErrorState message={query.error} onRetry={query.refresh} />;
  }

  const profile = query.data;
  if (!profile) return null;

  const anspruchItems = buildAnspruchsOverviewItems(profile);
  const billingRules = buildCompactBillingRules(profile);
  const transactions = txQuery.data ?? [];
  const warnings = profile.warnings;

  return (
    <View style={styles.panel}>
      <SectionPanel {...FORM_CTX} title="Pflegegrad" subtitle="Aktueller Status">
        <PremiumCard accentColor={colors.cyan} style={styles.card}>
          <Text style={[styles.cardTitle, { color: text.primary }]}>
            {formatCareLevel(profile.careGrade ?? 'kein') || 'Kein Pflegegrad'}
          </Text>
          {profile.careEntitlement ? (
            <>
              <Text style={[styles.meta, { color: text.secondary }]}>
                Gültig ab {formatDate(profile.careEntitlement.validFrom)}
                {profile.careEntitlement.careFundName ? ` · ${profile.careEntitlement.careFundName}` : ''}
              </Text>
              <View style={styles.badgeRow}>
                <PremiumBadge
                  label={profile.conversionEligible ? 'Umwandlung aktiv' : 'Nur § 45b'}
                  variant={profile.conversionEligible ? 'green' : 'cyan'}
                />
                {profile.careEntitlement.conversionEnabled === false && profile.conversionEligible ? (
                  <PremiumBadge label="Umwandlung deaktiviert" variant="orange" />
                ) : null}
              </View>
            </>
          ) : (
            <Text style={[styles.meta, { color: text.secondary }]}>
              Kein Anspruchsdatensatz — Pflegegrad in Stammdaten oder Aufnahme pflegen.
            </Text>
          )}
          {!isReadOnly ? (
            <View style={styles.actionRow}>
              <PremiumButton title="Pflegegrad" variant="secondary" onPress={() => setModal('careGrade')} />
              <PremiumButton title="Pflegekasse" variant="secondary" onPress={() => setModal('careFund')} />
              <PremiumButton title="Gültig ab" variant="secondary" onPress={() => setModal('validFrom')} />
              {profile.conversionEligible ? (
                <PremiumButton
                  title={profile.careEntitlement?.conversionEnabled ? 'Umwandlung aus' : 'Umwandlung an'}
                  variant="glass"
                  onPress={() => setModal('conversion')}
                />
              ) : null}
            </View>
          ) : null}
        </PremiumCard>
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Anspruchsübersicht" subtitle="Leistungen und Budgetkonten">
        {!hasAnspruchsData(profile) ? (
          <EmptyState
            title="Keine Leistungsansprüche"
            message="Pflegegrad setzen und Budgetkonten aus Vorlage 2026 erzeugen, oder Leistungsprofile unter Leistungsbereiche pflegen."
          />
        ) : (
          anspruchItems.map((item) => (
            <PremiumCard key={item.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={[styles.cardTitle, { color: text.primary }]}>{item.title}</Text>
                <PremiumBadge
                  label={
                    item.source === 'service'
                      ? 'Leistung'
                      : item.source === 'budget'
                        ? 'Budgetkonto'
                        : 'Vorlage'
                  }
                  variant={item.source === 'budget' ? 'green' : 'cyan'}
                />
              </View>
              <Text style={[styles.meta, { color: text.secondary }]}>{item.subtitle}</Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Budgetmodus" subtitle="Verhinderungs- und Kurzzeitpflege">
        <BudgetInfoBanners profile={profile} />
        <BudgetModeSwitch
          profile={profile}
          clientId={clientId}
          isReadOnly={isReadOnly}
          onChanged={refreshAll}
        />
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title={`Budgets ${profile.budgetYear}`} subtitle="Konten und Aktionen">
        <BudgetAccountsEditableGrid
          profile={profile}
          clientId={clientId}
          isReadOnly={isReadOnly}
          onChanged={refreshAll}
        />
        {!isReadOnly ? (
          <View style={styles.actionRow}>
            <PremiumButton title="Korrektur buchen" variant="secondary" onPress={() => setModal('correction')} />
            <PremiumButton title="Neu berechnen" variant="secondary" onPress={() => setModal('recalc')} />
          </View>
        ) : null}
        {!isReadOnly && profile.budgetAccounts.length === 0 ? (
          <PremiumButton
            title="Budgetkonten aus Vorlage 2026 erzeugen"
            onPress={handleGenerate}
            disabled={!profile.careGrade}
          />
        ) : null}
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Abrechnungslogik" subtitle="Verbrauchsreihenfolge">
        {billingRules.length === 0 ? (
          <EmptyState
            title="Keine Abrechnungsregeln"
            message="Regeln werden nach Erzeugung der Budgetkonten angezeigt."
          />
        ) : (
          billingRules.map((r) => (
            <PremiumCard key={r.catalogKey} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={[styles.cardTitle, { color: text.primary }]}>
                  {r.priorityOrder}. {r.label}
                </Text>
                <PremiumBadge label={r.available ? 'verfügbar' : 'gesperrt'} variant={r.available ? 'green' : 'gray'} />
              </View>
            </PremiumCard>
          ))
        )}
        <View style={styles.linkRow}>
          <PremiumButton
            title="Einsätze & Termine"
            variant="secondary"
            onPress={() => router.push(`/business/office/clients/${clientId}?tab=einsaetze` as never)}
          />
          <PremiumButton
            title="Leistungsnachweise"
            variant="secondary"
            onPress={() => router.push(`/business/office/clients/${clientId}?tab=dokumente` as never)}
          />
          <PremiumButton
            title="Rechnungen"
            variant="secondary"
            onPress={() => router.push(`/business/office/clients/${clientId}?tab=abrechnung` as never)}
          />
        </View>
      </SectionPanel>

      {warnings.length > 0 ? (
        <SectionPanel {...FORM_CTX} title="Offene Warnungen" subtitle={`${warnings.length} Klärung${warnings.length > 1 ? 'en' : ''}`}>
          {warnings.map((w) => (
            <PremiumCard
              key={w.id}
              accentColor={w.severity === 'critical' ? colors.error : w.severity === 'warning' ? colors.orange : colors.cyan}
              style={styles.card}
            >
              <Text style={[styles.cardTitle, { color: text.primary }]}>{w.message}</Text>
              <PremiumBadge label={w.severity} variant={w.severity === 'critical' ? 'red' : 'orange'} />
              {!isReadOnly ? (
                <PremiumButton
                  title="Als geklärt markieren"
                  variant="secondary"
                  onPress={() => handleResolveWarning(w.id)}
                />
              ) : null}
            </PremiumCard>
          ))}
        </SectionPanel>
      ) : null}

      <SectionPanel {...FORM_CTX} title="Budgetverlauf" subtitle="Bewegungen mit Filter">
        <FilterChipGroup
          options={[
            { key: 'all', label: 'Alle' },
            { key: 'allocation', label: 'Zuteilung' },
            { key: 'usage', label: 'Verbrauch' },
            { key: 'reservation', label: 'Reservierung' },
            { key: 'adjustment', label: 'Korrektur' },
          ]}
          value={typeFilter}
          onChange={setTypeFilter}
        />
        {txQuery.loading && transactions.length === 0 ? (
          <LoadingState message="Buchungen werden geladen…" />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="Keine Buchungen"
            message="Budgetbewegungen erscheinen nach Konteneröffnung, Reservierung und Verbrauch."
          />
        ) : (
          transactions.map((tx) => (
            <PremiumCard
              key={tx.id}
              style={[styles.card, glass && { backgroundColor: 'rgba(255,255,255,0.04)' }]}
            >
              <Text style={[styles.cardTitle, { color: text.primary }]}>
                {CLIENT_BUDGET_TRANSACTION_LABELS[tx.transactionType]} · {formatCurrency(tx.amountCents, true)}
              </Text>
              <Text style={[styles.meta, { color: text.secondary }]}>
                {tx.accountLabel ?? tx.catalogKey} · {formatDateTime(tx.createdAt)}
              </Text>
              {tx.note ? <Text style={[styles.meta, { color: text.secondary }]}>{tx.note}</Text> : null}
              {tx.referenceType ? (
                <Text style={[styles.meta, { color: text.secondary }]}>
                  Referenz: {tx.referenceType}
                  {tx.referenceId ? ` (${tx.referenceId.slice(0, 8)}…)` : ''}
                </Text>
              ) : null}
            </PremiumCard>
          ))
        )}
      </SectionPanel>

      <EditCareGradeModal
        visible={modal === 'careGrade'}
        onClose={() => setModal(null)}
        onSaved={refreshAll}
        isReadOnly={isReadOnly}
        clientId={clientId}
        profile={profile}
      />
      <EditCareFundModal
        visible={modal === 'careFund'}
        onClose={() => setModal(null)}
        onSaved={refreshAll}
        isReadOnly={isReadOnly}
        clientId={clientId}
        profile={profile}
      />
      <EditValidFromModal
        visible={modal === 'validFrom'}
        onClose={() => setModal(null)}
        onSaved={refreshAll}
        isReadOnly={isReadOnly}
        clientId={clientId}
        profile={profile}
      />
      <ConversionToggleModal
        visible={modal === 'conversion'}
        onClose={() => setModal(null)}
        onSaved={refreshAll}
        isReadOnly={isReadOnly}
        clientId={clientId}
        profile={profile}
      />
      <BudgetCorrectionModal
        visible={modal === 'correction'}
        onClose={() => setModal(null)}
        onSaved={refreshAll}
        isReadOnly={isReadOnly}
        clientId={clientId}
        accounts={profile.budgetAccounts}
      />
      <BudgetRecalcModal
        visible={modal === 'recalc'}
        onClose={() => setModal(null)}
        onSaved={refreshAll}
        isReadOnly={isReadOnly}
        clientId={clientId}
        profile={profile}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, paddingBottom: spacing.lg },
  card: { marginBottom: spacing.sm },
  cardTitle: { ...typography.label },
  meta: { ...typography.caption, marginTop: spacing.xs },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
