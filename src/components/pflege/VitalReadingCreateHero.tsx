import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumListHeroFrame } from '@/components/ui';
import { ROLE_LABELS } from '@/data/constants';
import { usePremiumHeroTextStyles } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import type { RoleKey } from '@/types';
import { designTokens, spacing } from '@/theme';

type Props = { roleKey: RoleKey; isReadOnly: boolean };

export function VitalReadingCreateHero({ roleKey, isReadOnly }: Props) {
  const { colors, typography } = useLegacyTheme();
  const heroText = usePremiumHeroTextStyles();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return;
      animation = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1150, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1150, useNativeDriver: true }),
      ]));
      animation.start();
    });
    return () => animation?.stop();
  }, [pulse]);

  const styles = useMemo(() => StyleSheet.create({
    topRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    textCol: { flex: 1, gap: 3 },
    title: heroText.title,
    meta: heroText.meta,
    subtitle: { ...typography.caption, color: 'rgba(255,255,255,0.88)' },
    iconWrap: { width: iconSize + 16, height: iconSize + 16, alignItems: 'center', justifyContent: 'center' },
    halo: { position: 'absolute', width: iconSize + 12, height: iconSize + 12, borderRadius: 999,
      borderWidth: 2, borderColor: 'rgba(21,189,160,0.52)' },
    iconBadge: { width: iconSize, height: iconSize, borderRadius: iconSize / 2,
      backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: 'rgba(255,255,255,0.32)' },
    iconText: { fontSize: 24 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  }), [colors.success, heroText.meta, heroText.title, typography.caption]);

  return (
    <PremiumListHeroFrame>
      <View style={styles.topRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Vitalwerte live erfassen</Text>
          <Text style={styles.meta}>Pflege · Intensivpflege · klientenbezogen</Text>
          <Text style={styles.subtitle}>
            Datum, Uhrzeit und angemeldete Mitarbeiter:in werden unveränderbar serverseitig protokolliert.
          </Text>
        </View>
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.halo, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.82] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1.12] }) }] }]} />
          <View style={styles.iconBadge}><Text style={styles.iconText}>💓</Text></View>
        </View>
      </View>
      <View style={styles.badges}>
        <PremiumBadge label={ROLE_LABELS[roleKey]} variant="orange" dot />
        <PremiumBadge label="Live-Daten" variant="green" dot />
        <PremiumBadge label="Audit-Protokoll aktiv" variant="green" dot />
        {isReadOnly ? <PremiumBadge label="Lesemodus" variant="orange" dot /> : null}
      </View>
    </PremiumListHeroFrame>
  );
}

const iconSize = designTokens.hero.iconBadgeSize;
