import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { PortalReadOnlyAvatar } from '@/components/portal/PortalReadOnlyAvatar';
import { PORTAL_EMPLOYEE_LABEL } from '@/lib/portal/portalDisplayLabels';
import { buildEmployeePortalProfileKpis } from '@/lib/portal/portalProfileStats';
import type { PortalEmployeeProfile } from '@/types/portal/employee';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { spacing } from '@/theme';
import { spatialCare } from '@/design/tokens/spatialCareSuite';

type PortalEmployeeProfileHeroProps = {
  profile: PortalEmployeeProfile;
};

function statusVariant(status: string) {
  return status === 'aktiv' ? ('green' as const) : ('orange' as const);
}

export function PortalEmployeeProfileHero({ profile }: PortalEmployeeProfileHeroProps) {
  const { colors, mode } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        layout: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        },
        avatarCol: {
          flexShrink: 0,
        },
        textCol: {
          flex: 1,
          gap: spacing.xs,
          minWidth: 0,
        },
        title: { ...heroText.title, color: spatialCare.textOnNight },
        meta: { ...heroText.meta, color: spatialCare.textOnNightMuted },
        badges: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        factRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginTop: spacing.md,
        },
        fact: {
          flexGrow: 1,
          flexBasis: 140,
          padding: spacing.md,
          gap: 2,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: spatialCare.border,
          backgroundColor: spatialCare.panelMuted,
        },
        factLabel: { fontSize: 11, fontWeight: '700', color: spatialCare.textOnNightMuted },
        factValue: { fontSize: 17, fontWeight: '800', color: spatialCare.textOnNight },
        factMeta: { fontSize: 12, color: spatialCare.textOnNightMuted },
      }),
    [heroText],
  );

  const kpis = buildEmployeePortalProfileKpis(profile, mode).slice(0, 2);
  const roleLine = [profile.jobTitleLabel, profile.departmentLabel]
    .filter((part) => part && part !== '—')
    .join(' · ');

  return (
    <PremiumListHeroFrame>
      <View style={styles.layout}>
        <View style={styles.avatarCol}>
          <PortalReadOnlyAvatar
            name={profile.displayName}
            avatarUrl={profile.avatarUrl}
            avatarVersion={profile.avatarUpdatedAt ?? profile.avatarUrl}
            accentColor={colors.cyan}
            size="xl"
          />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={2}>
            {profile.displayName}
          </Text>
          {roleLine ? (
            <Text style={styles.meta} numberOfLines={2}>
              {roleLine}
            </Text>
          ) : null}
          {profile.employeeNumber ? (
            <Text style={styles.meta}>Personalnummer {profile.employeeNumber}</Text>
          ) : null}
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
      {kpis.length > 0 ? (
        <View style={styles.factRow}>
          {kpis.map((kpi) => (
            <View key={kpi.id} style={styles.fact}>
              <Text style={styles.factLabel}>{kpi.label}</Text>
              <Text style={styles.factValue}>{kpi.value}</Text>
              {kpi.subValue ? <Text style={styles.factMeta}>{kpi.subValue}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </PremiumListHeroFrame>
  );
}
