import { useMemo } from 'react';
import { useLegacyTheme, type LegacyColors } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumListHeroFrame } from '@/components/ui';
import type { DashboardQuickAction, DashboardSnapshot } from '@/types/dashboard';
import { ROLE_LABELS } from '@/data/constants';

import type { DashboardScope } from '@/types/dashboard';
import { spacing } from '@/theme';

type PortalDashboardHeroProps = {
  snapshot: DashboardSnapshot;
  displayName: string;
  onPrimaryAction?: (action: DashboardQuickAction) => void;
};

const PORTAL_CONFIG = (
  colors: LegacyColors,
): Record<
  Extract<DashboardScope, 'portal_client' | 'portal_employee'>,
  { eyebrow: string; icon: string; accent: string; subtitle: string }
> => ({
  portal_employee: {
    eyebrow: 'MITARBEITERPORTAL',
    icon: '👷',
    accent: colors.orange,
    subtitle: 'Einsätze, Dokumentation und Nachrichten — nur Ihre freigegebenen Inhalte.',
  },
  portal_client: {
    eyebrow: 'KLIENT:INNENPORTAL',
    icon: '🏠',
    accent: colors.cyan,
    subtitle: 'Termine, Dokumente und Betreuungsteam — nach Portal-Freigabe gefiltert.',
  },
});

export function PortalDashboardHero({
  snapshot,
  displayName,
  onPrimaryAction,
}: PortalDashboardHeroProps) {
  const { colors, typography, gradients } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.caption,
    letterSpacing: 1,
  },
  greeting: heroText.title,
  tenant: {
    ...typography.bodyStrong,
    color: colors.orange,
  },
  meta: heroText.meta,
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  iconText: {
    fontSize: 24,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
}),
    [colors, typography, gradients, heroText.meta, heroText.title],
  );


  const scope = snapshot.scope as 'portal_client' | 'portal_employee';
  const config =
    scope === 'portal_client' || scope === 'portal_employee'
      ? PORTAL_CONFIG(colors)[scope]
      : PORTAL_CONFIG(colors).portal_employee;

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.greeting}>
            {snapshot.greeting}, {displayName}
          </Text>
          <Text style={styles.tenant}>{snapshot.tenantName}</Text>
          <Text style={styles.meta}>{config.subtitle}</Text>
        </View>
        <View style={[styles.iconBadge, { borderColor: `${config.accent}55` }]}>
          <Text style={styles.iconText}>{config.icon}</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[snapshot.roleKey]} variant="orange" dot />
        <PremiumBadge label="Portal-Sicht" variant="cyan" />
      </View>
      <PremiumButton
        title={`${snapshot.primaryAction.icon} ${snapshot.primaryAction.label}`}
        onPress={() => onPrimaryAction?.(snapshot.primaryAction)}
        fullWidth
      />
    </PremiumListHeroFrame>
  );
}

