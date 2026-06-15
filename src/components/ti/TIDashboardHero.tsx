import { useMemo } from 'react';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { TIConnectionStatusBadge } from './TIConnectionStatusBadge';
import { ROLE_LABELS } from '@/data/demo';
import { isTILiveReady } from '@/lib/ti/tiModuleConfig';
import { isDemoMode } from '@/lib/supabase/config';
import type { RoleKey } from '@/types';
import type { TIDashboardSnapshot } from '@/types/modules/ti';
import { designTokens, spacing } from '@/theme';

type TIDashboardHeroProps = {
  data: TIDashboardSnapshot;
  roleKey: RoleKey;
};

export function TIDashboardHero({ data, roleKey }: TIDashboardHeroProps) {
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
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
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
  iconText: {
    fontSize: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kpiItem: {
    flex: 1,
    minWidth: 120,
  },
}),
    [colors, typography, gradients],
  );


  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>BUSINESS · TELEMATIK</Text>
          <Text style={styles.title}>Telematikinfrastruktur</Text>
          <Text style={styles.meta}>
            KIM · eGK · ePA · eMP · E-Rezept · {data.unreadKimCount} ungelesene KIM
          </Text>
          <Text style={styles.subtitle}>
            TI-Status, KIM-Postfach und Einwilligungen — Demo-Vorschau bis Live-Connector.
          </Text>
        </View>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>🏥</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        <TIConnectionStatusBadge status={data.connectionStatus} />
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {!isTILiveReady() ? <PremiumBadge label="TI in Vorbereitung" variant="orange" dot /> : null}
      </View>
      <View style={styles.kpiRow}>
        {data.kpis.map((kpi) => (
          <PremiumKpiCard
            key={kpi.id}
            label={kpi.label}
            value={String(kpi.value)}
            subValue={kpi.subValue}
            style={styles.kpiItem}
          />
        ))}
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;

