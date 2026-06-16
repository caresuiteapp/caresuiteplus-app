import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MarketplaceBetaBanner, MarketplacePartnerRow } from '@/components/marketplace';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, PremiumButton } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import {
  DEMO_MARKETPLACE_PARTNERS,
  getMarketplaceCategory,
  getPartnersForCategory,
} from '@/lib/marketplace';
import type { MarketplaceCategoryKey } from '@/types/marketplace';
import { spacing } from '@/theme';

export function MarketplaceCategoryScreen() {
  const { category: categoryKey } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const category = categoryKey
    ? getMarketplaceCategory(categoryKey as MarketplaceCategoryKey)
    : undefined;
  const activePartners = categoryKey
    ? getPartnersForCategory(categoryKey as MarketplaceCategoryKey)
    : [];
  const allPartners = categoryKey
    ? DEMO_MARKETPLACE_PARTNERS.filter((item) => item.categoryKey === categoryKey)
    : [];

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

  if (!category) {
    return (
      <ScreenShell title="Partner-Marktplatz" subtitle="Kategorie">
        <EmptyState title="Kategorie nicht gefunden" message="Die gewählte Kategorie existiert nicht." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={category.label} subtitle={category.description}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <MarketplaceBetaBanner />
        {allPartners.length === 0 ? (
          <EmptyState
            title="Keine Partner"
            message="In dieser Kategorie sind derzeit keine Partner hinterlegt."
          />
        ) : (
          allPartners.map((partner) => (
            <MarketplacePartnerRow
              key={partner.id}
              partner={partner}
              onPress={() =>
                router.push(
                  `/business/connect/marketplace/${category.categoryKey}/${partner.id}` as never,
                )
              }
            />
          ))
        )}
        {activePartners.length === 0 ? (
          <EmptyState
            title="Keine aktiven Partner"
            message="Partner werden erst nach Vereinbarung und Admin-Freigabe als aktiv angezeigt."
          />
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.sm, paddingBottom: spacing.xxl },
});
