import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { withAlpha } from '@/design/tokens/motion';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { designTokens, spacing } from '@/theme';

export type FormScreenHeroProps = {
  eyebrow: string;
  title: string;
  meta?: string;
  icon?: string;
  formMode?: 'create' | 'edit';
  wpNumber?: number;
  step?: { current: number; total: number };
  accentColor?: string;
  preparedMessage?: string;
  preparedOnly?: boolean;
};

export function FormScreenHero({
  eyebrow,
  title,
  meta,
  icon = '📝',
  formMode = 'create',
  wpNumber,
  step,
  accentColor,
}: FormScreenHeroProps) {
  const { colors, typography } = useLegacyTheme();
  const tenantName = useTenantDisplayName();
  const accent = accentColor ?? careSuiteAuroraTheme.accent.pink;
  const modeLabel = formMode === 'create' ? 'Anlegen' : 'Bearbeiten';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        topRow: { flexDirection: 'row', gap: spacing.md },
        textCol: { flex: 1, gap: 2 },
        eyebrow: {
          ...typography.caption,
          letterSpacing: designTokens.hero.eyebrowLetterSpacing,
          color: withAlpha('#FFFFFF', 0.85),
        },
        title: { ...typography.h2, color: '#FFFFFF', fontWeight: '800' },
        meta: { ...typography.caption, color: withAlpha('#FFFFFF', 0.75) },
        iconBadge: {
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize / 2,
          backgroundColor: withAlpha('#FFFFFF', 0.16),
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: withAlpha('#FFFFFF', 0.4),
        },
        iconText: { fontSize: 22 },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiItem: { flex: 1, minWidth: 100 },
      }),
    [colors, typography],
  );

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        <View style={[styles.iconBadge, { borderColor: `${accent}59` }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={modeLabel} variant="cyan" dot />
        {step ? (
          <PremiumBadge label={`Schritt ${step.current}/${step.total}`} variant="cyan" />
        ) : null}
      </View>
      <View style={styles.kpiRow}>
        <PremiumKpiCard
          label="Modus"
          value={modeLabel}
          subValue="Datenspeicherung aktiv"
          icon="📋"
          accentColor={accent}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Mandant"
          value={tenantName}
          subValue="Mandantengebunden"
          icon="🏢"
          accentColor={colors.cyan}
          style={styles.kpiItem}
        />
        <PremiumKpiCard
          label="Status"
          value="Bereit"
          subValue="Speichern möglich"
          icon="✓"
          accentColor={colors.success}
          style={styles.kpiItem}
        />
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
