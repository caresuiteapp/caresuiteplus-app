import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { MarketplaceBetaBanner } from '@/components/marketplace';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, InfoBanner, PremiumButton } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import {
  MARKETPLACE_PARTNER_STATUS_LABELS,
  getMarketplaceCategory,
  getPartnerById,
  isPartnerSelectable,
} from '@/lib/marketplace';
import type { MarketplaceCategoryKey } from '@/types/marketplace';
import { spacing, typography } from '@/theme';

export function MarketplacePartnerProfileScreen() {
  const { category: categoryKey, partnerId } = useLocalSearchParams<{
    category: string;
    partnerId: string;
  }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const partner = partnerId ? getPartnerById(partnerId) : undefined;
  const category = categoryKey
    ? getMarketplaceCategory(categoryKey as MarketplaceCategoryKey)
    : undefined;
  const selectable = partner ? isPartnerSelectable(partner) : false;

  if (!can('connect.view')) {
    return (
      <ScreenShell title="Partner-Profil" subtitle={roleLabel ?? 'Betrieb'}>
        <LockedActionBanner
          message={check('connect.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (!partner || !category) {
    return (
      <ScreenShell title="Partner-Profil" subtitle="Nicht gefunden">
        <EmptyState title="Partner nicht gefunden" message="Der gewählte Partner existiert nicht." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={partner.name} subtitle={category.label}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <MarketplaceBetaBanner />
        <InfoBanner
          title="Status"
          message={MARKETPLACE_PARTNER_STATUS_LABELS[partner.status]}
        />
        <Text style={styles.description}>{partner.longDescription}</Text>
        <DetailInfoRow label="Onboarding" value={partner.onboardingStatus} />
        <DetailInfoRow
          label="Vereinbarung"
          value={partner.agreementSignedAt ? 'Unterzeichnet' : 'Ausstehend'}
        />
        <DetailInfoRow label="Demo-Partner" value={partner.isDemo ? 'Ja' : 'Nein'} />

        <PremiumButton
          title="Anfrage vorbereiten"
          disabled={!selectable}
          onPress={() =>
            router.push(
              `/business/connect/marketplace/${category.categoryKey}/${partner.id}/request` as never,
            )
          }
        />
        {!selectable ? (
          <InfoBanner
            variant="warning"
            title="Anfrage nicht möglich"
            message="Nur aktive Partner mit abgeschlossener Vereinbarung können angefragt werden."
          />
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  description: { ...typography.body },
});
