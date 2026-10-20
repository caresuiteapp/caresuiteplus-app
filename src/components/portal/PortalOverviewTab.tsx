import { StyleSheet, Text, View } from 'react-native';
import { DashboardView } from '@/components/dashboard';
import { PortalDashboardHero } from '@/components/portal/PortalDashboardHero';
import { SuccessState } from '@/components/ui';
import { useDashboard } from '@/hooks/useDashboard';
import type { DashboardScope } from '@/types/dashboard';
import { spacing, typography } from '@/theme';
import { portalPremium } from '@/design/tokens/portalPremium';

type PortalOverviewTabProps = {
  scope: DashboardScope;
  displayName: string;
  showSuccess?: boolean;
  onRefresh: () => void;
};

export function PortalOverviewTab({
  scope,
  displayName,
  showSuccess,
  onRefresh,
}: PortalOverviewTabProps) {
  const { data, loading, error, refresh } = useDashboard(scope);

  const handleRefresh = async () => {
    await refresh();
    onRefresh();
  };

  return (
    <View style={styles.container}>
      {showSuccess ? (
        <SuccessState message="Daten erfolgreich aktualisiert." />
      ) : null}
      <DashboardView
        snapshot={data}
        loading={loading}
        error={error}
        displayName={displayName}
        onRefresh={handleRefresh}
        HeroComponent={PortalDashboardHero}
        footer={
          <Text style={styles.hint}>
            Sichtbarkeit nach Portal-Rolle gefiltert — nur freigegebene Inhalte.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: portalPremium.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
