import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PremiumBadge, PremiumButton, PremiumCard } from '@/components/ui';
import { MODULE_NAV_CONFIG } from '@/data/demo/navigation';
import { PRODUCT_LABELS } from '@/data/demo/products';
import { activateFreeModuleForTenant } from '@/lib/billing/moduleActivationService';
import { isFreePlatformEnabled } from '@/lib/billing/freePlatformService';
import { OFFICE_MODULE_KEY } from '@/lib/modules/constants';
import { resolveModuleNavState } from '@/lib/modules/moduleVisibilityService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import type { EffectiveModuleAccess } from '@/types';
import { colors, spacing, typography } from '@/theme';

type StatusBadge = {
  label: string;
  variant: 'green' | 'cyan' | 'orange' | 'muted' | 'red';
};

function getStatusBadges(module: EffectiveModuleAccess): StatusBadge[] {
  const badges: StatusBadge[] = [];

  if (module.billingStatus === 'admin_disabled') {
    badges.push({ label: 'Admin deaktiviert', variant: 'red' });
    return badges;
  }

  if (module.isEffective) {
    badges.push({ label: 'Freigeschaltet', variant: 'green' });
  } else {
    badges.push({ label: 'Verfügbar', variant: 'muted' });
  }

  if (module.productKey === OFFICE_MODULE_KEY) {
    badges.push({ label: 'Basis-Modul', variant: 'orange' });
  }

  if (module.accessSource === 'free_active' || module.billingStatus === 'free_active') {
    badges.push({ label: 'Aktiv', variant: 'cyan' });
  } else if (module.accessSource === 'free_available' || module.billingStatus === 'free_available') {
    badges.push({ label: 'Bereit', variant: 'muted' });
  } else if (module.accessSource === 'included_base') {
    badges.push({ label: 'Inklusive', variant: 'muted' });
  } else if (module.billingStatus === 'premium_prepared') {
    badges.push({ label: 'Premium vorbereitet', variant: 'orange' });
  }

  return badges;
}

type ModuleCardProps = {
  module: EffectiveModuleAccess;
  onActivated?: () => void;
};

export function ModuleCard({ module, onActivated }: ModuleCardProps) {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const config = MODULE_NAV_CONFIG[module.productKey];
  const badges = getStatusBadges(module);
  const navState = resolveModuleNavState(module.productKey, {
    tenantId,
    roleKey: profile?.roleKey ?? null,
  });
  const freePlatform = isFreePlatformEnabled();
  const isDisabled = module.billingStatus === 'admin_disabled';
  const isComingSoon = navState.effectiveStatus === 'coming_soon';
  const canActivate =
    freePlatform &&
    !module.isEffective &&
    !isDisabled &&
    !isComingSoon &&
    navState.effectiveStatus !== 'disabled' &&
    module.productKey !== OFFICE_MODULE_KEY;

  const handleActivate = () => {
    if (!tenantId || !canActivate) return;
    const result = activateFreeModuleForTenant(tenantId, module.productKey);
    if (result.ok) {
      onActivated?.();
    }
  };

  return (
    <PremiumCard accentColor={module.isEffective ? config.accentColor : colors.textMuted}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{config.icon}</Text>
          <View style={styles.titleCol}>
            <Text style={styles.title}>{PRODUCT_LABELS[module.productKey]}</Text>
            <Text style={styles.subtitle}>{config.description}</Text>
          </View>
        </View>
      </View>
      <View style={styles.row}>
        <PremiumBadge
          label={module.isEffective ? 'Aktiv' : isDisabled ? 'Deaktiviert' : 'Verfügbar'}
          variant={module.isEffective ? 'green' : isDisabled ? 'red' : 'muted'}
          dot
        />
        {badges.map((badge) => (
          <PremiumBadge key={badge.label} label={badge.label} variant={badge.variant} />
        ))}
        {navState.badgeLabel ? (
          <PremiumBadge label={navState.badgeLabel} variant="orange" />
        ) : null}
      </View>
      {module.accessSource === 'included_base' && module.includedByModuleKey ? (
        <Text style={styles.hint}>
          Enthalten über {PRODUCT_LABELS[module.includedByModuleKey]}
        </Text>
      ) : null}
      {module.isEffective && navState.isNavigable ? (
        <PremiumButton
          title="Modul öffnen"
          size="sm"
          onPress={() => router.push(config.path as never)}
        />
      ) : module.isEffective && isComingSoon ? (
        <PremiumButton title="In Vorbereitung" variant="secondary" size="sm" disabled />
      ) : canActivate ? (
        <PremiumButton title="Aktivieren" size="sm" onPress={handleActivate} />
      ) : isDisabled ? (
        <PremiumButton title="Durch Admin deaktiviert" variant="secondary" size="sm" disabled />
      ) : (
        <PremiumButton title="Aktivieren" variant="secondary" size="sm" disabled />
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  icon: { fontSize: 24, marginTop: 2 },
  titleCol: { flex: 1 },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
});
