import { ScrollView, StyleSheet } from 'react-native';
import { MarketplaceBetaBanner, MarketplacePartnerRow } from '@/components/marketplace';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, InfoBanner, PremiumButton } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  DEMO_MARKETPLACE_PARTNERS,
  MARKETPLACE_PARTNER_STATUS_LABELS,
  approvePartnerStatus,
} from '@/lib/marketplace';
import { spacing } from '@/theme';

export function MarketplaceAdminScreen() {
  const { can, check, roleLabel, roleKey } = usePermissions();
  const tenantId = useServiceTenantId();
  const isAdmin = roleKey === 'business_admin';

  if (!can('connect.view')) {
    return (
      <ScreenShell title="Marktplatz-Admin" subtitle={roleLabel ?? 'Betrieb'}>
        <LockedActionBanner
          message={check('connect.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (!isAdmin) {
    return (
      <ScreenShell title="Marktplatz-Admin" subtitle="Nur Administratoren">
        <LockedActionBanner
          message="Partner-Freigabe nur für business_admin."
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  async function handleApprove(partnerId: string) {
    if (!tenantId) return;
    await approvePartnerStatus(tenantId, partnerId, 'active', roleKey);
  }

  return (
    <ScreenShell title="Marktplatz-Admin" subtitle="Partner-Freigabe & Onboarding">
      <ScrollView contentContainerStyle={styles.scroll}>
        <MarketplaceBetaBanner />
        <InfoBanner
          title="Admin-Prüfung"
          message="Partner werden erst nach Vereinbarung auf aktiv gesetzt. Keine automatische Aktivierung."
        />
        {DEMO_MARKETPLACE_PARTNERS.length === 0 ? (
          <EmptyState title="Keine Partner" message="Keine Partner zur Prüfung." />
        ) : (
          DEMO_MARKETPLACE_PARTNERS.map((partner) => (
            <ScrollView key={partner.id} contentContainerStyle={styles.partnerBlock}>
              <MarketplacePartnerRow partner={partner} />
              <InfoBanner
                title="Status"
                message={MARKETPLACE_PARTNER_STATUS_LABELS[partner.status]}
              />
              {partner.status !== 'active' ? (
                <PremiumButton
                  title="Als aktiv freigeben (nach Vereinbarung)"
                  size="sm"
                  variant="secondary"
                  onPress={() => handleApprove(partner.id)}
                />
              ) : null}
            </ScrollView>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  partnerBlock: { gap: spacing.sm },
});
