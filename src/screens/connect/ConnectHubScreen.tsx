import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ConnectCategoryDashboardCard,
  ConnectHubHero,
  ConnectPreparedBanner,
  ConnectRoadmapPanel,
} from '@/components/connect';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { PremiumButton } from '@/components/ui';
import { useConnectDashboard } from '@/hooks/useConnectDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { spacing } from '@/theme';

export function ConnectHubScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { categories, categoryStats } = useConnectDashboard();

  if (!can('connect.view')) {
    return (
      <ScreenShell title="CareSuite+ Connect" subtitle={roleLabel ?? 'Betrieb'} showBack={false}>
        <LockedActionBanner
          message={check('connect.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="CareSuite+ Connect"
      subtitle="Integrationskatalog & Schnittstellen"
      showBack={false}
      rightSlot={
        can('connect.configure') ? (
          <PremiumButton
            title="Anbieter"
            size="sm"
            variant="ghost"
            onPress={() => router.push('/business/connect/providers' as never)}
          />
        ) : null
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <ConnectHubHero categories={categories} roleKey={roleKey} />
        <ConnectPreparedBanner />
        {can('connect.configure') ? <ConnectRoadmapPanel /> : null}

        <View style={styles.grid}>
          {categories.map((category) => {
            const stats = categoryStats.find((item) => item.categoryKey === category.key);
            if (!stats) return null;
            return (
              <ConnectCategoryDashboardCard
                key={category.key}
                category={category}
                stats={stats}
                onPress={() => router.push(`/business/connect/${category.key}` as never)}
              />
            );
          })}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  grid: { gap: spacing.sm },
});
