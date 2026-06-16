import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MarketplaceBetaBanner, MarketplaceCategoryCard } from '@/components/marketplace';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { PremiumButton } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { canAdministerPartners, getMarketplaceCategories, getPartnersForCategory } from '@/lib/marketplace';
import { spacing } from '@/theme';

export function MarketplaceHubScreen() {
  const router = useRouter();
  const { can, check, roleLabel, roleKey } = usePermissions();
  const categories = getMarketplaceCategories();

  if (!can('connect.view')) {
    return (
      <ScreenShell title="Partner-Marktplatz" subtitle={roleLabel ?? 'Betrieb'}>
        <LockedActionBanner
          message={check('connect.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Partner-Marktplatz"
      subtitle="Kategorien & Dienstleister"
      rightSlot={
        canAdministerPartners(roleKey) ? (
          <PremiumButton
            title="Admin"
            size="sm"
            variant="ghost"
            onPress={() => router.push('/business/connect/marketplace/admin' as never)}
          />
        ) : null
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <MarketplaceBetaBanner />
        {categories.map((category) => (
          <MarketplaceCategoryCard
            key={category.categoryKey}
            category={category}
            partnerCount={getPartnersForCategory(category.categoryKey).length}
            onPress={() =>
              router.push(`/business/connect/marketplace/${category.categoryKey}` as never)
            }
          />
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.sm, paddingBottom: spacing.xxl },
});
