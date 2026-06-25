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
import { ensureClientBudgetAccountsForDate, listClientBudgetTransactions } from '@/lib/assist/clientBudgetAccountService';
import { formatBudgetPeriodLabelCapitalized } from '@/lib/assist/budgetPeriodLabels';
import { resolveClientBillingWarning } from '@/lib/assist/clientBillingWarningsService';
import {
  BudgetAccountsEditableGrid,
  BudgetInfoBanners,
  BudgetModeSwitch,
} from '@/components/office/ClientBudgetAccountsGrid';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { formatDate, formatDateTime } from '@/lib/formatters/dateTimeFormatters';
import {
  BUDGET_TEMPLATE_LABELS,
  CLIENT_BUDGET_TRANSACTION_LABELS,
  type ClientAssistBillingProfile,
} from '@/types/assist/clientAssistBilling';
import { colors, spacing, typography } from '@/theme';

const FORM_CTX = { viewContext: 'form' as const };

function useBillingProfile(clientId: string, enabled = true) {
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
    { enabled: enabled && !!tenantId && !!clientId },
  );
}

export function ClientPflegegradAnspruchPanel({ clientId }: { clientId: string }) {
  const text = useAuroraAdaptiveText();
  const query = useBillingProfile(clientId);

  if (query.loading && !query.data) return <LoadingState message="Pflegegrad & Anspruch werden geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;

  const profile = query.data;
  if (!profile) return null;

  return (
    <View style={styles.panel}>
      <SectionPanel {...FORM_CTX} title="Pflegegrad & Anspruch">
        <PremiumCard style={styles.card}>
          <Text style={[styles.cardTitle, { color: text.primary }]}>
            {formatCareLevel(profile.careGrade ?? 'kein') || 'Kein Pflegegrad'}
          </Text>
          {profile.careEntitlement ? (
            <>
              <Text style={[styles.meta, { color: text.secondary }]}>
                Gültig ab {formatDate(profile.careEntitlement.validFrom)}
                {profile.careEntitlement.careFundName ? ` · ${profile.careEntitlement.careFundName}` : ''}
              </Text>
              <PremiumBadge
                label={profile.conversionEligible ? 'Umwandlung aktiv' : 'Nur § 45b'}
                variant={profile.conversionEligible ? 'green' : 'cyan'}
              />
            </>
          ) : (
            <Text style={[styles.meta, { color: text.secondary }]}>
              Kein Anspruchsdatensatz — Pflegegrad in Stammdaten oder Aufnahme pflegen.
            </Text>
          )}
        </PremiumCard>
        <SectionPanel {...FORM_CTX} title="Geltende Vorlagen 2026" subtitle="Aus Budget-Katalog — versioniert">
          {profile.templates.filter((t) => t.isStatutory).map((t) => (
            <PremiumCard key={t.id} style={styles.card}>
              <Text style={[styles.cardTitle, { color: text.primary }]}>{t.label}</Text>
              <Text style={[styles.meta, { color: text.secondary }]}>
                {t.defaultAmountCents != null
                  ? formatCurrency(t.defaultAmountCents, true)
                  : 'Individuell'}
                {' · '}
                {formatBudgetPeriodLabelCapitalized(t.period, t.catalogKey)}
                {' · Priorität '}
                {t.billingPriority}
                {t.catalogKey.startsWith('umwandlung_') ? ' · § 45a monatlich' : ''}
              </Text>
            </PremiumCard>
          ))}
        </SectionPanel>
      </SectionPanel>
    </View>
  );
}

export function ClientLeistungenAbrechnungPanel({ clientId }: { clientId: string }) {
  const text = useAuroraAdaptiveText();
  const router = useRouter();
  const query = useBillingProfile(clientId);

  if (query.loading && !query.data) return <LoadingState message="Leistungen & Abrechnung werden geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;

  const profile = query.data;
  if (!profile) return null;

  return (
    <View style={styles.panel}>
      <SectionPanel {...FORM_CTX} title="Pflegegrad">
        <PremiumCard accentColor={colors.cyan} style={styles.card}>
          <Text style={[styles.cardTitle, { color: text.primary }]}>
            {formatCareLevel(profile.careGrade ?? 'kein')}
          </Text>
          <Text style={[styles.meta, { color: text.secondary }]}>
            Umwandlung: {profile.conversionEligible ? 'berechtigt' : 'nicht vorgesehen (PG1)'}
          </Text>
        </PremiumCard>
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Leistungs-Ansprüche">
        {profile.serviceEntitlements.length === 0 ? (
          <EmptyState title="Keine Leistungsansprüche" message="Leistungsprofile unter Leistungsbereiche pflegen." />
        ) : (
          profile.serviceEntitlements.map((s) => (
            <PremiumCard key={s.id} style={styles.card}>
              <Text style={[styles.cardTitle, { color: text.primary }]}>
                {s.serviceTypeKey ?? 'Leistung'}
              </Text>
              <Text style={[styles.meta, { color: text.secondary }]}>
                Modus: {s.billingMode}
                {s.hourlyRateCents ? ` · ${formatCurrency(s.hourlyRateCents, true)}/Std.` : ''}
              </Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Budgetübersicht">
        <BudgetAccountsEditableGrid
          profile={profile}
          clientId={clientId}
          isReadOnly
          onChanged={() => query.refresh()}
        />
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Abrechnungs-Priorität">
        {profile.priorityRules.map((r) => (
          <PremiumCard key={r.id} style={styles.card}>
            <Text style={[styles.cardTitle, { color: text.primary }]}>
              {BUDGET_TEMPLATE_LABELS[r.catalogKey as keyof typeof BUDGET_TEMPLATE_LABELS] ?? r.catalogKey}
            </Text>
            <Text style={[styles.meta, { color: text.secondary }]}>Priorität {r.priorityOrder}</Text>
          </PremiumCard>
        ))}
      </SectionPanel>

      <SectionPanel {...FORM_CTX} title="Verknüpfte Bereiche">
        <View style={styles.linkRow}>
          <PremiumButton title="Einsätze & Termine" variant="secondary" onPress={() => router.push(`/business/office/clients/${clientId}?tab=einsaetze` as never)} />
          <PremiumButton title="Leistungsnachweise" variant="secondary" onPress={() => router.push(`/business/office/clients/${clientId}?tab=dokumente` as never)} />
          <PremiumButton title="Rechnungen" variant="secondary" onPress={() => router.push(`/business/office/clients/${clientId}?tab=abrechnung` as never)} />
        </View>
      </SectionPanel>
    </View>
  );
}

export function ClientBudgetAccountsPanel({
  clientId,
  onRecordRefresh,
}: {
  clientId: string;
  onRecordRefresh?: () => void;
}) {
  const tenantId = useServiceTenantId();
  const { isReadOnly } = usePermissions();
  const query = useBillingProfile(clientId);

  async function refreshAll() {
    await query.refresh();
    onRecordRefresh?.();
  }

  async function handleGenerate() {
    if (!tenantId || isReadOnly || !query.data?.careGrade) return;
    await ensureClientBudgetAccountsForDate(tenantId, clientId, query.data.careGrade);
    await refreshAll();
  }

  if (query.loading && !query.data) return <LoadingState message="Budgets werden geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;

  const profile = query.data;
  if (!profile) return null;

  return (
    <View style={styles.panel}>
      <SectionPanel {...FORM_CTX} title={`Budgets ${profile.budgetYear}`}>
        <BudgetInfoBanners profile={profile} />
        <BudgetModeSwitch
          profile={profile}
          clientId={clientId}
          isReadOnly={isReadOnly}
          onChanged={refreshAll}
        />
        <BudgetAccountsEditableGrid
          profile={profile}
          clientId={clientId}
          isReadOnly={isReadOnly}
          onChanged={refreshAll}
        />
        {!isReadOnly && profile.budgetAccounts.length === 0 ? (
          <PremiumButton
            title="Budgetkonten aus Vorlage 2026 erzeugen"
            onPress={handleGenerate}
            disabled={!profile.careGrade}
          />
        ) : null}
      </SectionPanel>
    </View>
  );
}

export function ClientBudgetVerlaufPanel({ clientId }: { clientId: string }) {
  const tenantId = useServiceTenantId();
  const text = useAuroraAdaptiveText();
  const [typeFilter, setTypeFilter] = useState('all');

  const txQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return listClientBudgetTransactions(tenantId, clientId, {
        budgetYear: 2026,
        transactionType: typeFilter === 'all' ? undefined : typeFilter,
        limit: 100,
      });
    },
    [tenantId, clientId, typeFilter],
    { enabled: !!tenantId && !!clientId },
  );

  if (txQuery.loading && !txQuery.data) return <LoadingState message="Budgetverlauf wird geladen…" />;
  if (txQuery.error && !txQuery.data) return <ErrorState message={txQuery.error} onRetry={txQuery.refresh} />;

  const transactions = txQuery.data ?? [];

  return (
    <View style={styles.panel}>
      <SectionPanel {...FORM_CTX} title="Budgetverlauf" subtitle="Filter nach Bewegungstyp">
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
        {transactions.length === 0 ? (
          <EmptyState title="Keine Buchungen" message="Budgetbewegungen erscheinen nach Konteneröffnung und Verbrauch." />
        ) : (
          transactions.map((tx) => (
            <PremiumCard key={tx.id} style={styles.card}>
              <Text style={[styles.cardTitle, { color: text.primary }]}>
                {CLIENT_BUDGET_TRANSACTION_LABELS[tx.transactionType]} · {formatCurrency(tx.amountCents, true)}
              </Text>
              <Text style={[styles.meta, { color: text.secondary }]}>
                {tx.accountLabel ?? tx.catalogKey} · {formatDateTime(tx.createdAt)}
              </Text>
              {tx.note ? <Text style={[styles.meta, { color: text.secondary }]}>{tx.note}</Text> : null}
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

export function ClientBillingWarningsPanel({
  clientId,
  onRecordRefresh,
}: {
  clientId: string;
  onRecordRefresh?: () => void;
}) {
  const tenantId = useServiceTenantId();
  const { isReadOnly } = usePermissions();
  const text = useAuroraAdaptiveText();
  const query = useBillingProfile(clientId);

  async function handleResolve(warningId: string) {
    if (!tenantId || isReadOnly) return;
    await resolveClientBillingWarning(tenantId, clientId, warningId);
    await query.refresh();
    onRecordRefresh?.();
  }

  if (query.loading && !query.data) return <LoadingState message="Warnungen werden geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;

  const warnings = query.data?.warnings ?? [];

  return (
    <View style={styles.panel}>
      <SectionPanel {...FORM_CTX} title="Warnungen & offene Klärungen">
        {warnings.length === 0 ? (
          <EmptyState title="Keine offenen Warnungen" message="Automatische Prüfungen laufen bei Profilaufruf." />
        ) : (
          warnings.map((w) => (
            <PremiumCard
              key={w.id}
              accentColor={w.severity === 'critical' ? colors.error : w.severity === 'warning' ? colors.orange : colors.cyan}
              style={styles.card}
            >
              <Text style={[styles.cardTitle, { color: text.primary }]}>{w.message}</Text>
              <PremiumBadge label={w.severity} variant={w.severity === 'critical' ? 'red' : 'orange'} />
              {!isReadOnly ? (
                <PremiumButton title="Als geklärt markieren" variant="secondary" onPress={() => handleResolve(w.id)} />
              ) : null}
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

/** Compact read-only summary for AssignmentCreateForm integration. */
export function ClientBillingProfileSummary({ clientId }: { clientId: string }) {
  const text = useAuroraAdaptiveText();
  const glass = useAuroraGlassActive();
  const query = useBillingProfile(clientId, !!clientId);

  if (!clientId) return null;
  if (query.loading) {
    return <Text style={[styles.meta, { color: text.secondary }]}>Abrechnungsprofil wird geladen…</Text>;
  }
  if (!query.data) return null;

  const p = query.data;
  const primary = p.budgetAccounts[0];

  return (
    <View style={[styles.summaryBox, glass && { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
      <Text style={[styles.summaryTitle, { color: text.primary }]}>Abrechnungsprofil (readonly)</Text>
      <Text style={[styles.meta, { color: text.secondary }]}>
        PG: {formatCareLevel(p.careGrade ?? 'kein')}
        {primary ? ` · ${primary.label ?? primary.catalogKey}: ${formatCurrency(primary.remainingCents ?? 0, true)} verfügbar` : ''}
      </Text>
      {p.warnings.length > 0 ? (
        <Text style={[styles.meta, { color: colors.orange }]}>
          {p.warnings.length} offene Warnung{p.warnings.length > 1 ? 'en' : ''}
        </Text>
      ) : null}
      {p.budgetAccounts.slice(0, 3).map((a) => (
        <Text key={a.id} style={[styles.meta, { color: text.secondary }]}>
          {a.label ?? a.catalogKey}:{' '}
          {formatBudgetPeriodLabelCapitalized(a.period, a.catalogKey)},{' '}
          {p.canUseBudgetByCatalogKey[a.catalogKey] ? 'verfügbar' : 'nicht verfügbar'}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, paddingBottom: spacing.lg },
  card: { marginBottom: spacing.sm },
  cardTitle: { ...typography.label },
  meta: { ...typography.caption, marginTop: spacing.xs },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summaryBox: { padding: spacing.sm, borderRadius: 8, marginTop: spacing.sm },
  summaryTitle: { ...typography.caption, fontWeight: '600' },
});
