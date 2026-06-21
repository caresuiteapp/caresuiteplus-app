import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  isPortalProfileLiveReady,
  PORTAL_PROFILE_PREPARED_MESSAGE,
} from '@/lib/portal/portalModuleConfig';
import { buildEmployeePortalProfileKpis } from '@/lib/portal/portalProfileStats';

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
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: { ...typography.h2 },
  meta: { ...typography.caption, color: colors.textMuted },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(98,243,255,0.35)',
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
  preparedHint: { ...typography.caption, color: colors.textMuted },
}),
    [colors, typography, gradients],
  );


  const kpis = buildEmployeePortalProfileKpis(profile, mode);
  const isLive = isPortalProfileLiveReady();

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>MITARBEITERPORTAL · PROFIL</Text>
          <Text style={styles.title}>{profile.displayName}</Text>
          <Text style={styles.meta}>
            {profile.jobTitle ? `${profile.jobTitle} · ` : ''}
            {profile.teamName}
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>👤</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[profile.status]}
          variant={statusVariant(profile.status)}
          dot
        />
        {isLive ? (
          <PremiumBadge label="Cloud Live" variant="green" dot />
        ) : (
          <PremiumBadge label="Demo / preparedOnly" variant="muted" />
        )}
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
      {!isLive ? <Text style={styles.preparedHint}>{PORTAL_PROFILE_PREPARED_MESSAGE}</Text> : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

