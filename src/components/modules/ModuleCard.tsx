import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import { PremiumBadge, PremiumButton, PremiumCard } from '@/components/ui';
import { MODULE_NAV_CONFIG } from '@/data/navigation/moduleNavConfig';
import { PRODUCT_LABELS } from '@/data/constants/productLabels';
import { OFFICE_MODULE_KEY } from '@/lib/modules/constants';
import {
  buildModuleInfoBody,
  buildModuleStatusChips,
  MODULE_CARD_DESCRIPTIONS,
  resolveModuleActivityStatus,
} from '@/lib/modules/moduleManagementLabels';
import { setTenantModuleEnabled } from '@/lib/tenant/tenantModuleToggleService';
import { isTenantCenterProductKey } from '@/lib/tenant/tenantModuleSettingsCache';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { confirmAction } from '@/lib/platform/confirmAction';
import { sanitizeUserFacingError } from '@/lib/ui/uiVisibility';
import type { EffectiveModuleAccess, RoleKey } from '@/types';
import { colors, spacing, typography } from '@/theme';

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
  const [infoOpen, setInfoOpen] = useState(false);
  const config = MODULE_NAV_CONFIG[module.productKey];
  const chips = buildModuleStatusChips(module);
  const activity = resolveModuleActivityStatus(module);
  const isAdminDisabled = module.billingStatus === 'admin_disabled';
  const isPrepared = activity === 'In Vorbereitung';
  const isOfficeBase = module.productKey === OFFICE_MODULE_KEY;
  const canToggle =
    !isAdminDisabled &&
    !isOfficeBase &&
    !isPrepared &&
    (isTenantCenterProductKey(module.productKey) || module.productKey === 'akademie');

  const description = MODULE_CARD_DESCRIPTIONS[module.productKey] ?? config.description;

  const notifyChange = () => {
    onChanged?.();
    onActivated?.();
  };

  const handleOpen = () => {
    if (!module.isEffective || isPrepared) return;
    router.push(config.path as never);
  };

  const handleSettings = () => {
    router.push('/business/office/access/module-permissions' as never);
  };

  const handleToggle = async (enabled: boolean) => {
    if (!tenantId?.trim() || !canToggle || busy) return;

    const moduleName = PRODUCT_LABELS[module.productKey];
    const confirmed = await confirmAction({
      title: enabled ? 'Modul aktivieren?' : 'Modul deaktivieren?',
      message: enabled
        ? `${moduleName} wird für diesen Mandanten freigeschaltet. Navigation und Portale werden entsprechend aktualisiert.`
        : `${moduleName} wird deaktiviert. Das Modul verschwindet aus der Navigation. Laufende Daten bleiben erhalten, Portalfunktionen werden deaktiviert.`,
      confirmLabel: enabled ? 'Kostenlos aktivieren' : 'Deaktivieren',
    });

    if (!confirmed) return;

    setBusy(true);
    setError(null);
    const result = await setTenantModuleEnabled(tenantId, module.productKey, enabled, roleKey);
    setBusy(false);
    if (result.ok) {
      notifyChange();
      return;
    }
    setError(sanitizeUserFacingError(result.error));
  };

  return (
    <>
      <PremiumCard accentColor={module.isEffective ? config.accentColor : colors.textMuted}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.icon}>{config.icon}</Text>
            <View style={styles.titleCol}>
              <Text style={styles.title}>{PRODUCT_LABELS[module.productKey]}</Text>
              <Text style={styles.subtitle}>{description}</Text>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          {chips.map((chip) => (
            <PremiumBadge key={chip.label} label={chip.label} variant={chip.variant} />
          ))}
        </View>

        {isOfficeBase ? (
          <Text style={styles.hint}>Office ist das Basismodul der Plattform und immer aktiv.</Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          {isPrepared ? (
            <>
              <PremiumButton title="In Vorbereitung" size="sm" fullWidth disabled />
              <PremiumButton
                title="Mehr erfahren"
                variant="secondary"
                size="sm"
                fullWidth
                onPress={() => setInfoOpen(true)}
              />
            </>
          ) : module.isEffective ? (
            <>
              <PremiumButton title="Modul öffnen" size="sm" fullWidth onPress={handleOpen} />
              <View style={styles.secondaryRow}>
                <PremiumButton
                  title="Einstellungen"
                  variant="secondary"
                  size="sm"
                  style={styles.secondaryBtn}
                  onPress={handleSettings}
                />
                {canToggle ? (
                  <PremiumButton
                    title="Deaktivieren"
                    variant="ghost"
                    size="sm"
                    style={styles.secondaryBtn}
                    loading={busy}
                    onPress={() => void handleToggle(false)}
                  />
                ) : null}
              </View>
            </>
          ) : canToggle ? (
            <>
              <PremiumButton
                title="Kostenlos aktivieren"
                size="sm"
                fullWidth
                loading={busy}
                onPress={() => void handleToggle(true)}
              />
              <PremiumButton
                title="Mehr Informationen"
                variant="secondary"
                size="sm"
                fullWidth
                onPress={() => setInfoOpen(true)}
              />
            </>
          ) : isAdminDisabled ? (
            <PremiumButton title="Durch Admin gesperrt" variant="secondary" size="sm" fullWidth disabled />
          ) : (
            <PremiumButton
              title="Mehr Informationen"
              variant="secondary"
              size="sm"
              fullWidth
              onPress={() => setInfoOpen(true)}
            />
          )}
        </View>
      </PremiumCard>

      <AppGlassModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={PRODUCT_LABELS[module.productKey]}
        subtitle="Modulinformation"
      >
        <Text style={styles.modalBody}>{buildModuleInfoBody(module.productKey)}</Text>
        <View style={styles.modalChips}>
          {chips.map((chip) => (
            <PremiumBadge key={`info-${chip.label}`} label={chip.label} variant={chip.variant} />
          ))}
        </View>
      </AppGlassModal>
    </>
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
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm },
  secondaryBtn: { flex: 1 },
  modalBody: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.md },
  modalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
