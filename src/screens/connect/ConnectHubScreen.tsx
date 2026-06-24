import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ConnectCategoryCard,
  ConnectHubHero,
  ConnectPreparedBanner,
} from '@/components/connect';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { PremiumButton } from '@/components/ui';
import { useConnectCatalog } from '@/hooks/useConnectCatalog';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { getVisibleConnectIntegrations } from '@/lib/connect';
import { spacing } from '@/theme';

function ConnectRoadmapPanel() {
  return null;
}

export function ConnectHubScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { categories } = useConnectCatalog();

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
          {categories.map((category) => (
            <ConnectCategoryCard
              key={category.key}
              category={category}
              visibleCount={getVisibleConnectIntegrations(category).length}
              onPress={() => router.push(`/business/connect/${category.key}` as never)}
            />
          ))}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  grid: { gap: spacing.sm },
});
