import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BudgetDetailHero } from '@/components/office';
import { DetailInfoRow } from '@/components/detail';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useBudgetDetail } from '@/hooks/useBudgetDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { spacing } from '@/theme';

const PERIOD_LABELS = {
  monthly: 'Monatlich',
  quarterly: 'Quartal',
  yearly: 'Jährlich',
} as const;

export function BudgetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, roleLabel } = usePermissions();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data: budget, loading, error, refresh, notFound } = useBudgetDetail(id);

  if (!can('office.budgets.view')) {
    return (
      <ScreenShell title="Budget" subtitle="Kein Zugriff">
        <ErrorState
          title="Zugriff verweigert"
          message={`Budgets sind für ${roleLabel ?? 'Ihre Rolle'} nicht freigegeben.`}
        />
      </ScreenShell>
    );
  }

  if (loading) {
    return (
      <ScreenShell title="Budget" subtitle="Wird geladen…">
        <LoadingState message="Budget wird geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Budget" subtitle="Fehler">
        <ErrorState message={error ?? 'Budget nicht gefunden.'} onRetry={refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!budget) return null;

  return (
    <ScreenShell title={budget.label} subtitle={budget.clientName}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <BudgetDetailHero budget={budget} roleKey={roleKey} />

        <SectionPanel title="Details">
          <DetailInfoRow label="Klient:in" value={budget.clientName} />
          <DetailInfoRow label="Zeitraum" value={PERIOD_LABELS[budget.period]} />
          {budget.notes ? <DetailInfoRow label="Hinweise" value={budget.notes} /> : null}
        </SectionPanel>

        {budget.linkedInvoiceIds.length > 0 ? (
          <SectionPanel title="Verknüpfte Rechnungen" subtitle="Demo-Verknüpfung über Klient:in">
            {budget.linkedInvoiceIds.map((invId) => (
              <PremiumButton
                key={invId}
                title={`Rechnung ${invId}`}
                variant="secondary"
                size="sm"
                onPress={() => router.push(`/office/invoices/${invId}` as never)}
                style={styles.invBtn}
              />
            ))}
          </SectionPanel>
        ) : null}

        <PremiumButton
          title="Zur Klient:in"
          variant="secondary"
          fullWidth
          onPress={() => router.push(clientRecordRoute(budget.clientId) as never)}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  invBtn: { marginBottom: spacing.xs },
});
