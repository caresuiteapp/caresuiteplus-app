import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import type { TrackingListKpi } from '@/data/demo/trackingStats';
import { ROLE_LABELS } from '@/data/demo';
import { isGpsTrackingLiveReady } from '@/lib/assist/gpsTrackingConfig';
import { GeoPreparedBanner } from '@/components/geo/GeoPreparedBanner';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type TrackingListHeroProps = {
  kpis: TrackingListKpi[];
  roleKey: RoleKey;
  positionCount: number;
  eventCount: number;
  isReadOnly: boolean;
  compact?: boolean;
};

export function TrackingListHero({
  kpis,
  roleKey,
  positionCount,
  eventCount,
  isReadOnly,
  compact = false,
}: TrackingListHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
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
    color: colors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
  },
  title: {
    ...typography.h2,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,193,7,0.35)',
  },
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiItem: {
    flex: 1,
    minWidth: 100,
  },
}),
    [colors, typography, gradients],
  );


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>ASSIST</Text>
          <Text style={styles.title}>Live-Tracking</Text>
          <Text style={styles.meta}>
            {positionCount} Positionen · {eventCount} Geofence-Ereignisse
            {isReadOnly ? ' · Lesemodus' : ''}
          </Text>
        </View>
        {!compact ? (
          <View style={styles.iconBadge}>
            <Text style={styles.iconText}>📍</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {!isGpsTrackingLiveReady() ? (
          <PremiumBadge label="GPS extern" variant="orange" dot />
        ) : null}
        <PremiumBadge label="Geofence-Snapshot" variant="muted" />
      </View>
      {!isGpsTrackingLiveReady() ? <GeoPreparedBanner compact={compact} /> : null}
      {!compact ? (
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

const iconSize = designTokens.hero.iconBadgeSize;

