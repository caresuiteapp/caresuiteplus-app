import { StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import {
  listTenantBudgetDefaults,
  listTenantBudgetYears,
  listTenantBudgetTypes,
} from '@/lib/client/clientBudgetSettingsService';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { colors, spacing, typography } from '@/theme';

/** Mandanten-Budget-Vorlagen — Core K.4 years, types, 2026 template. */
export default function TenantClientBudgetDefaultsScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();

  const yearsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTenantBudgetYears(tenantId);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const typesQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTenantBudgetTypes(tenantId);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const defaultsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTenantBudgetDefaults(tenantId, 2026);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const loading = yearsQuery.loading || typesQuery.loading || defaultsQuery.loading;
  const years = yearsQuery.data ?? [];
  const types = typesQuery.data ?? [];
  const defaults = defaultsQuery.data ?? [];

  return (
    <ScreenShell
      title="Klient:innen-Budget-Vorlagen"
      subtitle="Budgetjahre und Entlastungsbudget"
      rightSlot={<PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />}
    >
      {loading ? <LoadingState message="Budget-Vorlagen werden geladen…" /> : null}

      <SectionPanel title="Budgetjahre">
        {years.length === 0 ? (
          <EmptyState title="Keine Budgetjahre" message="2026-Vorlage wird bei seed_tenant_client_core_templates angelegt." />
        ) : (
          years.map((year) => (
            <PremiumCard key={year.id} style={styles.card}>
              <Text style={styles.primary}>{year.label ?? year.budgetYear}</Text>
              <Text style={styles.secondary}>{year.isActive ? 'Aktiv' : 'Inaktiv'}</Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>

      <SectionPanel title="Budgettypen">
        {types.map((type) => (
          <PremiumCard key={type.id} style={styles.card}>
            <Text style={styles.primary}>{type.name}</Text>
            <Text style={styles.secondary}>{type.period} · {type.budgetTypeKey}</Text>
          </PremiumCard>
        ))}
      </SectionPanel>

      <SectionPanel title="Vorlage 2026 (aus DB)">
        {defaults.length === 0 ? (
          <EmptyState title="Keine Defaults" message="Werte werden in der Datenbank gepflegt — nicht im Frontend hardcodiert." />
        ) : (
          defaults.map((def) => (
            <PremiumCard key={def.id} style={styles.card}>
              <Text style={styles.secondary}>
                Monat: {formatCurrency(def.monthlyAmountCents ?? 0, true)}
                {' · '}{def.conversionRatePct ?? 0}% Umrechnung
                {' · '}Jahr: {formatCurrency(def.yearlyAmountCents ?? def.amountCents, true)}
              </Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  primary: { ...typography.label },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
