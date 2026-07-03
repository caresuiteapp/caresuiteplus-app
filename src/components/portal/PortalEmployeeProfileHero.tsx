import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { PortalReadOnlyAvatar } from '@/components/portal/PortalReadOnlyAvatar';
import { PORTAL_EMPLOYEE_LABEL } from '@/lib/portal/portalDisplayLabels';
import { buildEmployeePortalProfileKpis } from '@/lib/portal/portalProfileStats';
import type { PortalEmployeeProfile } from '@/types/portal/employee';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { spacing } from '@/theme';

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
        title: heroText.title,
        meta: heroText.meta,
        badges: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        kpiRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginTop: spacing.md,
        },
        kpiItem: {
          flex: 1,
          minWidth: 100,
        },
      }),
    [heroText],
  );

  const kpis = buildEmployeePortalProfileKpis(profile, mode);
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
      ) : null}
    </PremiumListHeroFrame>
  );
}
