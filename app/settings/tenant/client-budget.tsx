import { ScreenShell } from '@/components/layout';
import { EmptyState, PremiumButton } from '@/components/ui';
import { listTenantBudgetDefaults } from '@/lib/client/clientBudgetSettingsService';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useRouter } from 'expo-router';

/** Mandanten-Budget-Vorlagen — Core K.1 Stub (Werte aus DB, nicht hardcodiert). */
export default function TenantClientBudgetDefaultsScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTenantBudgetDefaults(tenantId, 2026);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const defaults = query.data ?? [];
  const sample = defaults[0];

  return (
    <ScreenShell
      title="Klient:innen-Budget-Vorlagen"
      subtitle="Budgetjahre und Entlastungsbudget"
      rightSlot={<PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />}
    >
      <EmptyState
        title={defaults.length > 0 ? 'Budget-Vorlage 2026 aktiv' : 'Budget-Vorlagen'}
        message={
          sample
            ? `Entlastungsbudget: ${formatCurrency(sample.monthlyAmountCents ?? 0, true)}/Monat, ${sample.conversionRatePct ?? 0}% Umrechnung, ${formatCurrency(sample.yearlyAmountCents ?? sample.amountCents, true)}/Jahr — editierbar in der Datenbank.`
            : '2026-Vorlagen werden bei seed_tenant_client_core_templates angelegt. Keine Hardcodes im React-Frontend.'
        }
        actionLabel="Zu Mandanten-Einstellungen"
        onAction={() => router.push('/settings/tenant' as never)}
      />
    </ScreenShell>
  );
}
