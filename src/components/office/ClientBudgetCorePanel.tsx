import { StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  initializeClientBudgetFromDefaults,
  listClientBudgetMovements,
  listClientBudgetSettings,
  listTenantBudgetDefaults,
} from '@/lib/client/clientBudgetSettingsService';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import type { ClientBudgetSetting } from '@/types/clientCore';
import { colors, spacing, typography } from '@/theme';

function BudgetSettingCard({
  clientId,
  setting,
  isReadOnly,
}: {
  clientId: string;
  setting: ClientBudgetSetting;
  isReadOnly: boolean;
}) {
  const tenantId = useServiceTenantId();
  const movementsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listClientBudgetMovements(tenantId, clientId, setting.id);
    },
    [tenantId, clientId, setting.id],
    { enabled: !!tenantId },
  );

  const movements = movementsQuery.data ?? [];

  return (
    <PremiumCard style={styles.card}>
      <Text style={styles.primary}>{setting.budgetTypeName ?? setting.budgetTypeKey}</Text>
      <Text style={styles.secondary}>
        Zugewiesen: {formatCurrency(setting.allocatedCents, true)}
        {' · '}Verbraucht: {formatCurrency(setting.usedCents, true)}
        {' · '}Reserviert: {formatCurrency(setting.reservedCents, true)}
      </Text>
      {setting.remainingCents != null ? (
        <Text style={styles.secondary}>Verfügbar: {formatCurrency(setting.remainingCents, true)}</Text>
      ) : null}
      {setting.conversionRatePct != null ? (
        <Text style={styles.secondary}>Umrechnung: {setting.conversionRatePct}%</Text>
      ) : null}
      {movements.length > 0 ? (
        <Text style={styles.secondary}>
          Letzte Bewegungen: {movements.slice(0, 3).map((m) => `${m.movementType} ${formatCurrency(m.amountCents, true)}`).join(' · ')}
        </Text>
      ) : null}
    </PremiumCard>
  );
}

type Props = {
  clientId: string;
  onRecordRefresh?: () => void;
};

export function ClientBudgetCorePanel({ clientId, onRecordRefresh }: Props) {
  const tenantId = useServiceTenantId();
  const { isReadOnly } = usePermissions();

  const settingsQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return listClientBudgetSettings(tenantId, clientId, 2026);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );

  const defaultsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTenantBudgetDefaults(tenantId, 2026);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  async function handleInitialize() {
    if (!tenantId || isReadOnly) return;
    const result = await initializeClientBudgetFromDefaults(tenantId, clientId, 2026);
    if (result.ok) {
      await settingsQuery.refresh();
      onRecordRefresh?.();
    }
  }

  const loading = settingsQuery.loading || defaultsQuery.loading;
  const error = settingsQuery.error ?? defaultsQuery.error;

  if (loading && !settingsQuery.data) {
    return <LoadingState message="Budget wird geladen…" />;
  }
  if (error && !settingsQuery.data) {
    return <ErrorState message={error} onRetry={() => { void settingsQuery.refresh(); void defaultsQuery.refresh(); }} />;
  }

  const settings = settingsQuery.data ?? [];
  const defaults = defaultsQuery.data ?? [];

  const lowBudgetWarnings = settings.filter(
    (s) => s.remainingCents != null && s.remainingCents <= 0,
  );

  return (
    <View style={styles.panel}>
      {lowBudgetWarnings.length > 0 ? (
        <SectionPanel title="Budget-Warnungen">
          {lowBudgetWarnings.map((s) => (
            <PremiumCard key={s.id} style={styles.card}>
              <Text style={styles.primary}>{s.budgetTypeName ?? s.budgetTypeKey}</Text>
              <Text style={styles.secondary}>Verfügbares Budget aufgebraucht oder überschritten.</Text>
            </PremiumCard>
          ))}
        </SectionPanel>
      ) : null}
      <SectionPanel title="Budget 2026">
        {settings.length === 0 ? (
          <EmptyState
            title="Kein Klient:innen-Budget hinterlegt"
            message={
              defaults.length > 0
                ? 'Mandanten-Vorlagen sind verfügbar. Budget aus Vorlage übernehmen oder manuell pflegen.'
                : 'Budget-Vorlagen werden unter Mandanten-Einstellungen gepflegt — nicht im Frontend hardcodiert.'
            }
            actionLabel={defaults.length > 0 && !isReadOnly ? 'Aus Vorlage übernehmen' : undefined}
            onAction={defaults.length > 0 && !isReadOnly ? handleInitialize : undefined}
          />
        ) : (
          settings.map((setting) => (
            <BudgetSettingCard
              key={setting.id}
              clientId={clientId}
              setting={setting}
              isReadOnly={isReadOnly}
            />
          ))
        )}
      </SectionPanel>
      {!isReadOnly && settings.length === 0 && defaults.length > 0 ? (
        <PremiumButton title="Budget aus Mandanten-Vorlage übernehmen" onPress={handleInitialize} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, paddingBottom: spacing.lg },
  card: { marginBottom: spacing.sm },
  primary: { ...typography.label },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
