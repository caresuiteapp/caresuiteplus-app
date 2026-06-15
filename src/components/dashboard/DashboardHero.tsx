import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PremiumBadge, PremiumButton } from '@/components/ui';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import type { DashboardQuickAction, DashboardSnapshot } from '@/types/dashboard';
import { ROLE_LABELS } from '@/data/demo';
import { isDemoMode } from '@/lib/supabase/config';
import { radius, spacing } from '@/theme';

type DashboardHeroProps = {
  snapshot: DashboardSnapshot;
  displayName: string;
  onPrimaryAction?: (action: DashboardQuickAction) => void;
  showDemoBadge?: boolean;
};

export function DashboardHero({
  snapshot,
  displayName,
  onPrimaryAction,
  showDemoBadge = isDemoMode(),
}: DashboardHeroProps) {
  const { colors, typography, gradients } = useLegacyTheme();
  const moduleLabel = snapshot.moduleLabel ?? 'CareSuite+';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.borderSoft,
          overflow: 'hidden',
          marginBottom: spacing.sm,
        },
        gradient: {
          ...StyleSheet.absoluteFillObject,
        },
        sheen: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.12)',
        },
        content: {
          padding: spacing.md,
          gap: spacing.sm,
        },
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
          letterSpacing: 1,
        },
        greeting: {
          ...typography.h2,
        },
        tenant: {
          ...typography.bodyStrong,
          color: colors.orange,
        },
        meta: {
          ...typography.caption,
          color: colors.textMuted,
        },
        avatar: {
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.orange,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: 'rgba(255,149,0,0.4)',
        },
        avatarText: {
          fontSize: 22,
          fontWeight: '800',
          color: '#0A0500',
        },
        badges: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
        },
      }),
    [colors, typography, gradients],
  );

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[...gradients.hero.list]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      <View style={styles.sheen} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.textCol}>
            <Text style={styles.eyebrow}>{moduleLabel.toUpperCase()}</Text>
            <Text style={styles.greeting}>
              {snapshot.greeting}, {displayName}
            </Text>
            <Text style={styles.tenant}>{snapshot.tenantName}</Text>
            <Text style={styles.meta}>{snapshot.heroSubtitle}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(displayName[0] ?? '?').toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.badges}>
          <PremiumBadge label={ROLE_LABELS[snapshot.roleKey]} variant="orange" dot />
          {showDemoBadge ? <PremiumBadge label="Demo-Modus" variant="cyan" /> : null}
        </View>
        <PremiumButton
          title={`${snapshot.primaryAction.icon} ${snapshot.primaryAction.label}`}
          onPress={() => onPrimaryAction?.(snapshot.primaryAction)}
          fullWidth
        />
      </View>
    </View>
  );
}
