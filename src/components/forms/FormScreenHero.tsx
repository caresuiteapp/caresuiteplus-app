import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumKpiCard, PremiumListHeroFrame } from '@/components/ui';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';
import { designTokens, spacing } from '@/theme';

export type FormScreenHeroProps = {
  eyebrow: string;
  title: string;
  meta?: string;
  icon?: string;
  formMode?: 'create' | 'edit';
  wpNumber?: number;
  step?: { current: number; total: number };
  preparedOnly?: boolean;
  preparedMessage?: string;
  accentColor?: string;
};

export function FormScreenHero({
  eyebrow,
  title,
  meta,
  icon = '📝',
  formMode = 'create',
  wpNumber,
  step,
  preparedOnly = true,
  preparedMessage,
  accentColor,
}: FormScreenHeroProps) {
  const { colors, typography, gradients } = useLegacyTheme();
  const isLive = getServiceMode() === 'supabase';
  const tenantName = useTenantDisplayName();
  const accent = accentColor ?? colors.orange;
  const modeLabel = formMode === 'create' ? 'Anlegen' : 'Bearbeiten';
  const showPrepared = !isLive && preparedOnly;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        topRow: { flexDirection: 'row', gap: spacing.md },
        textCol: { flex: 1, gap: 2 },
        eyebrow: {
          ...typography.caption,
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
        },
        iconText: { fontSize: 22 },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        kpiItem: { flex: 1, minWidth: 100 },
        hint: { ...typography.caption, color: colors.textMuted },
      }),
    [colors, typography, gradients],
  );

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        <View style={[styles.iconBadge, { borderColor: `${accent}59` }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={modeLabel} variant="orange" dot />
        {wpNumber ? <PremiumBadge label={`WP ${wpNumber}`} variant="muted" /> : null}
        {step ? (
          <PremiumBadge label={`Schritt ${step.current}/${step.total}`} variant="cyan" />
        ) : null}
        {isDemoMode() ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        {showPrepared ? <PremiumBadge label="preparedOnly" variant="muted" /> : null}
      </View>
      {isLive ? (
        <View style={styles.kpiRow}>
          <PremiumKpiCard
            label="Modus"
            value={modeLabel}
            subValue="Live-Speicherung"
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
            value="Live"
            subValue="Supabase"
            icon="✓"
            accentColor={colors.green}
            style={styles.kpiItem}
          />
        </View>
      ) : (
        <View style={styles.kpiRow}>
          <PremiumKpiCard
            label="Modus"
            value={modeLabel}
            subValue="Demo-Persistenz"
            icon="📋"
            accentColor={accent}
            style={styles.kpiItem}
          />
          <PremiumKpiCard
            label="Mandant"
            value="Demo"
            subValue="Tenant-Store"
            icon="🏢"
            accentColor={colors.cyan}
            style={styles.kpiItem}
          />
          <PremiumKpiCard
            label="Status"
            value="Prototyp"
            subValue="Kein Store-Release"
            icon="⚠️"
            accentColor={colors.violet}
            style={styles.kpiItem}
          />
        </View>
      )}
      {showPrepared && preparedMessage ? (
        <Text style={styles.hint}>{preparedMessage}</Text>
      ) : null}
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
