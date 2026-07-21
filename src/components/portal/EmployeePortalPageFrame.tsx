import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { careSpacing } from '@/design/tokens/spacing';
import { spatialCare, spatialCareColors } from '@/design/tokens/spatialCareSuite';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  compact?: boolean;
};

/**
 * Verbindlicher Seitenrahmen des Mitarbeitendenportals.
 *
 * Jede Route erhält dieselbe Reihenfolge: Kontext -> Titel -> Beschreibung -> Inhalt.
 * Fachscreens liefern nur noch ihren Inhalt und kein eigenes konkurrierendes Layout.
 */
export function EmployeePortalPageFrame({
  title,
  subtitle,
  eyebrow = 'CARESUITE+ · MITARBEITENDENPORTAL',
  children,
  compact = false,
}: Props) {
  return (
    <View style={styles.page} testID="employee-portal-page-frame">
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <LinearGradient
          colors={['rgba(51,53,89,0.96)', 'rgba(22,24,49,0.98)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.heroGlow} pointerEvents="none" />
        <View style={styles.heroObject} pointerEvents="none">
          <View style={styles.heroObjectCore} />
          <View style={styles.heroObjectRing} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    gap: careSpacing.md,
  },
  hero: {
    minHeight: 132,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: careSpacing.lg,
    paddingVertical: careSpacing.lg,
    borderRadius: spatialCare.radius.stage,
    borderWidth: 1,
    borderColor: spatialCare.borderGlow,
    backgroundColor: spatialCare.stageStrong,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: spatialCare.shadow, backdropFilter: `blur(${spatialCare.blur.stage}px)` } as unknown as ViewStyle)
      : { shadowColor: spatialCareColors.nightDeep, shadowOpacity: 0.3, shadowRadius: 22, elevation: 10 }),
  },
  heroCompact: { minHeight: 108, paddingVertical: careSpacing.md },
  heroGlow: {
    position: 'absolute', left: 0, top: 22, bottom: 22, width: 4,
    borderRadius: 8, backgroundColor: spatialCareColors.cyanLight,
  },
  heroObject: {
    position: 'absolute', right: 28, top: 24, width: 76, height: 76,
    alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }],
  },
  heroObjectCore: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: 'rgba(105,232,255,0.20)',
    borderWidth: 1, borderColor: 'rgba(186,249,255,0.90)',
    shadowColor: spatialCareColors.cyanLight, shadowOpacity: 0.9, shadowRadius: 18,
  },
  heroObjectRing: {
    position: 'absolute', width: 62, height: 62, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(105,232,255,0.28)',
  },
  heroCopy: { maxWidth: '78%', gap: 4 },
  eyebrow: {
    color: spatialCareColors.cyanLight, fontSize: 10, lineHeight: 14,
    fontWeight: '800', letterSpacing: 1.05,
  },
  title: {
    color: spatialCare.textOnNight, fontSize: 28, lineHeight: 34,
    fontWeight: '850', letterSpacing: -0.7,
  },
  subtitle: {
    color: spatialCare.textOnNightMuted, fontSize: 14, lineHeight: 20, fontWeight: '500',
  },
  content: { width: '100%', gap: careSpacing.md },
});
