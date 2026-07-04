import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { PremiumBadge, PremiumButton } from '@/components/ui';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { fxMotion, neonGlow, withAlpha } from '@/design/tokens/motion';
import type { DashboardQuickAction, DashboardSnapshot } from '@/types/dashboard';
import { ROLE_LABELS } from '@/data/constants';
import { radius, spacing } from '@/theme';
import { useClientGreeting } from '@/hooks/useClientGreeting';

type DashboardHeroProps = {
  snapshot: DashboardSnapshot;
  displayName: string;
  onPrimaryAction?: (action: DashboardQuickAction) => void;
};

/** Vivid violet→pink→cyan liquid-glass hero banner (dark) with floating depth. */
const HERO_GRADIENT_DARK: [string, string, string] = ['#7C3AED', '#EC4899', '#06B6D4'];

export function DashboardHero({
  snapshot,
  displayName,
  onPrimaryAction,
}: DashboardHeroProps) {
  const { colors, typography, gradients, isDark } = useLegacyTheme();
  const greeting = useClientGreeting(snapshot.greeting);
  const moduleLabel = snapshot.moduleLabel ?? 'CareSuite+';

  const roleLabel = ROLE_LABELS[snapshot.roleKey] ?? snapshot.roleKey;
  const primaryAction = snapshot.primaryAction;
  const primaryActionTitle = primaryAction
    ? `${primaryAction.icon} ${primaryAction.label}`
    : 'Dashboard öffnen';

  const float = useSharedValue(0);
  useEffect(() => {
    if (!isDark) return;
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: fxMotion.float, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: fxMotion.float, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [float, isDark]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 * float.value }],
  }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: isDark ? withAlpha('#EC4899', 0.35) : colors.borderSoft,
          overflow: 'hidden',
          marginBottom: spacing.sm,
          ...(isDark ? neonGlow('#EC4899', 0.35, 28, 16) : null),
        },
        gradient: { ...StyleSheet.absoluteFillObject },
        overlay: { ...StyleSheet.absoluteFillObject },
        sheen: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '52%',
        },
        orbA: {
          position: 'absolute',
          top: -60,
          right: -30,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: withAlpha('#FFFFFF', 0.12),
        },
        orbB: {
          position: 'absolute',
          bottom: -80,
          left: '30%',
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: withAlpha('#06B6D4', 0.22),
        },
        content: { padding: spacing.md, gap: spacing.sm },
        topRow: { flexDirection: 'row', gap: spacing.md },
        textCol: { flex: 1, gap: 2 },
        eyebrow: {
          ...typography.caption,
          color: isDark ? withAlpha('#FFFFFF', 0.85) : colors.cyan,
          letterSpacing: 1.4,
          fontWeight: '700',
        },
        greeting: {
          ...typography.h2,
          color: isDark ? '#FFFFFF' : colors.textPrimary,
        },
        tenant: {
          ...typography.bodyStrong,
          color: isDark ? withAlpha('#FFFFFF', 0.92) : colors.orange,
        },
        meta: {
          ...typography.caption,
          color: isDark ? withAlpha('#FFFFFF', 0.75) : colors.textMuted,
        },
        avatar: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: isDark ? withAlpha('#FFFFFF', 0.16) : colors.orange,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: withAlpha('#FFFFFF', 0.4),
        },
        avatarText: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
      }),
    [colors, typography, gradients, isDark],
  );

  return (
    <Animated.View style={[styles.wrapper, floatStyle]}>
      <LinearGradient
        colors={isDark ? HERO_GRADIENT_DARK : [...gradients.hero.list]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      {isDark ? (
        <>
          <View style={styles.orbA} pointerEvents="none" />
          <View style={styles.orbB} pointerEvents="none" />
          <LinearGradient
            colors={['rgba(11,16,32,0.10)', 'rgba(11,16,32,0.45)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.overlay}
            pointerEvents="none"
          />
        </>
      ) : null}
      <LinearGradient
        colors={[withAlpha('#FFFFFF', isDark ? 0.22 : 0.12), 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.sheen}
        pointerEvents="none"
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.textCol}>
            <Text style={styles.greeting}>
              {greeting}, {displayName}
            </Text>
            <Text style={styles.tenant}>{snapshot.tenantName}</Text>
            <Text style={styles.meta}>{snapshot.heroSubtitle}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(displayName[0] ?? '?').toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.badges}>
          <PremiumBadge label={roleLabel} variant="orange" dot />
        </View>
        <PremiumButton
          title={primaryActionTitle}
          onPress={() => primaryAction && onPrimaryAction?.(primaryAction)}
          fullWidth
        />
      </View>
    </Animated.View>
  );
}
