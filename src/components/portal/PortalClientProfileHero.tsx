import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import {
  isPortalProfileLiveReady,
  PORTAL_PROFILE_PREPARED_MESSAGE,
} from '@/lib/portal/portalModuleConfig';
import { buildClientPortalProfileKpis } from '@/lib/portal/portalProfileStats';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { getServiceMode } from '@/lib/services/mode';

import type { PortalClientProfile } from '@/types/portal/client';
import { designTokens, spacing } from '@/theme';

type PortalClientProfileHeroProps = {
  profile: PortalClientProfile;
};

function formatNextAppointment(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export function PortalClientProfileHero({ profile }: PortalClientProfileHeroProps) {
  const { colors, typography, gradients, mode } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
  topRow: { flexDirection: 'row', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
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


  const kpis = buildClientPortalProfileKpis(profile, mode);
  const profileDataLive = isPortalProfileLiveReady();
  const authLive = getServiceMode() === 'supabase';

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>KLIENT:INNENPORTAL · PROFIL</Text>
          <Text style={styles.title}>{profile.displayName}</Text>
          <Text style={styles.meta}>
            {profile.nextAppointmentTitle
              ? `Nächster Termin: ${profile.nextAppointmentTitle}`
              : 'Ihr persönlicher Portal-Bereich'}
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🏠</Text>
        </View>
      </View>
      <View style={styles.badges}>
        {profile.careLevel ? (
          <PremiumBadge label={formatCareLevel(profile.careLevel)} variant="green" dot />
        ) : null}
        {profileDataLive ? (
          <PremiumBadge label="Cloud Live" variant="green" dot />
        ) : authLive ? null : (
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
        {profile.nextAppointmentAt ? (
          <PremiumKpiCard
            label="Nächster Termin"
            value={formatNextAppointment(profile.nextAppointmentAt)}
            subValue={profile.nextAppointmentTitle ?? undefined}
            icon="📅"
            accentColor={colors.success}
            style={styles.kpiItem}
          />
        ) : null}
      </View>
      {!profileDataLive && !authLive ? (
        <Text style={styles.preparedHint}>{PORTAL_PROFILE_PREPARED_MESSAGE}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

