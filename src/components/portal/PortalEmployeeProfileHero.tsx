import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { StyleSheet, Text, View } from 'react-native';
import { TopbarProfileAvatar } from '@/components/layout/TopbarProfileAvatar';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { PORTAL_EMPLOYEE_LABEL } from '@/lib/portal/portalDisplayLabels';
import { buildEmployeePortalProfileKpis } from '@/lib/portal/portalProfileStats';
import { resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';

import type { PortalEmployeeProfile } from '@/types/portal/employee';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { designTokens, spacing } from '@/theme';

type PortalEmployeeProfileHeroProps = {
  profile: PortalEmployeeProfile;
};

function statusVariant(status: string) {
  return status === 'aktiv' ? ('green' as const) : ('orange' as const);
}

export function PortalEmployeeProfileHero({ profile }: PortalEmployeeProfileHeroProps) {
  const { profile: authProfile } = useAuth();
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: heroText.eyebrow,
  title: heroText.title,
  meta: heroText.meta,
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(98,243,255,0.35)',
    overflow: 'hidden',
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
}),
    [colors, typography, gradients],
  );

  const kpis = buildEmployeePortalProfileKpis(profile, mode);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{profile.displayName}</Text>
          <Text style={styles.meta}>
            {profile.jobTitle ? `${resolveEmployeeRoleLabel(profile.jobTitle)} · ` : ''}
            {profile.teamName}
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <TopbarProfileAvatar
            name={profile.displayName}
            avatarUrl={authProfile?.avatarUrl}
            accentColor={colors.cyan}
            size="md"
          />
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[profile.status]}
          variant={statusVariant(profile.status)}
          dot
        />
        <PremiumBadge label={PORTAL_EMPLOYEE_LABEL} variant="cyan" />
      </View>
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            subValue={kpi.subValue}
            icon={kpi.icon}
            accentColor={kpi.accentColor}
            style={styles.kpiItem}
          />
        ))}
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

