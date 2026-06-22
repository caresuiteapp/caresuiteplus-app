import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PremiumBadge, PremiumButton, PremiumCard } from '@/components/ui';
import { MODULE_NAV_CONFIG } from '@/data/navigation/moduleNavConfig';
import { PRODUCT_LABELS } from '@/data/constants/productLabels';
import { isFreePlatformEnabled } from '@/lib/billing/freePlatformService';
import { OFFICE_MODULE_KEY } from '@/lib/modules/constants';
import { setTenantModuleEnabled } from '@/lib/tenant/tenantModuleToggleService';
import { isTenantCenterProductKey } from '@/lib/tenant/tenantModuleSettingsCache';
import { useServiceTenantId } from '@/hooks/useTenantId';
import type { EffectiveModuleAccess, RoleKey } from '@/types';
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
    badges.push({ label: 'Kostenlos aktiv', variant: 'cyan' });
  } else if (module.accessSource === 'free_available' || module.billingStatus === 'free_available') {
    badges.push({ label: 'Kostenlos verfügbar', variant: 'muted' });
  } else if (module.accessSource === 'included_base') {
    badges.push({ label: 'Inklusive', variant: 'muted' });
  } else if (module.billingStatus === 'premium_prepared') {
    badges.push({ label: 'Premium vorbereitet', variant: 'orange' });
  }

  return badges;
}

type ModuleCardProps = {
  module: EffectiveModuleAccess;
  tenantId?: string | null;
  roleKey?: RoleKey | null;
  onChanged?: () => void;
  /** @deprecated use onChanged */
  onActivated?: () => void;
};

export function ModuleCard({
  module,
  tenantId: tenantIdProp,
  roleKey,
  onChanged,
  onActivated,
}: ModuleCardProps) {
  const router = useRouter();
  const serviceTenantId = useServiceTenantId();
  const tenantId = tenantIdProp ?? serviceTenantId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = MODULE_NAV_CONFIG[module.productKey];
  const badges = getStatusBadges(module);
  const freePlatform = isFreePlatformEnabled();
  const isAdminDisabled = module.billingStatus === 'admin_disabled';
  const isOfficeBase = module.productKey === OFFICE_MODULE_KEY;
  const canToggle =
    !isAdminDisabled &&
    !isOfficeBase &&
    (isTenantCenterProductKey(module.productKey) || module.productKey === 'akademie');

  const notifyChange = () => {
    onChanged?.();
    onActivated?.();
  };

  const handleOpen = () => {
    router.push(config.path as never);
  };

  const handleToggle = async (enabled: boolean) => {
    if (!tenantId?.trim() || !canToggle || busy) return;
    setBusy(true);
    setError(null);
    const result = await setTenantModuleEnabled(tenantId, module.productKey, enabled, roleKey);
    setBusy(false);
    if (result.ok) {
      notifyChange();
      return;
    }
    setError(result.error ?? 'Änderung fehlgeschlagen.');
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
        <Text style={styles.price}>
          {freePlatform ? 'Kostenlos' : module.accessSource === 'included_base' ? 'Inklusive (Basisverwaltung)' : '—'}
        </Text>
      </View>
      <View style={styles.row}>
        <PremiumBadge
          label={module.isEffective ? 'Aktiv' : isAdminDisabled ? 'Deaktiviert' : 'Inaktiv'}
          variant={module.isEffective ? 'green' : isAdminDisabled ? 'red' : 'muted'}
          dot
        />
        {badges.map((badge) => (
          <PremiumBadge key={badge.label} label={badge.label} variant={badge.variant} />
        ))}
      </View>
      {module.accessSource === 'included_base' && module.includedByModuleKey ? (
        <Text style={styles.hint}>
          Enthalten über {PRODUCT_LABELS[module.includedByModuleKey]}
        </Text>
      ) : null}
      {isOfficeBase ? (
        <Text style={styles.hint}>
          Office erscheint in Navigation und Dashboard, sobald mindestens ein Fachmodul aktiv ist.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        {canToggle ? (
          module.isEffective ? (
            <PremiumButton
              title="Deaktivieren"
              variant="secondary"
              size="sm"
              fullWidth
              loading={busy}
              onPress={() => void handleToggle(false)}
            />
          ) : (
            <PremiumButton
              title="Aktivieren"
              size="sm"
              fullWidth
              loading={busy}
              onPress={() => void handleToggle(true)}
            />
          )
        ) : isAdminDisabled ? (
          <PremiumButton title="Durch Admin deaktiviert" variant="secondary" size="sm" fullWidth disabled />
        ) : null}
        {module.isEffective ? (
          <PremiumButton title="Modul öffnen" size="sm" fullWidth onPress={handleOpen} />
        ) : null}
      </View>
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
  price: { ...typography.caption, color: colors.cyan, marginTop: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
});
