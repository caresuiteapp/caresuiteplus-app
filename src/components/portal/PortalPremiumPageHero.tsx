import type { ComponentProps } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { portalPremium, type PortalPremiumKind } from '@/design/tokens/portalPremium';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  kind: PortalPremiumKind;
  title: string;
  subtitle?: string;
  eyebrow: string;
  compact?: boolean;
};

function resolveIcon(title: string, kind: PortalPremiumKind): IoniconName {
  const value = title.toLocaleLowerCase('de-DE');
  if (value.includes('nachricht') || value.includes('chat')) return 'chatbubbles-outline';
  if (value.includes('dokument') || value.includes('upload')) return 'folder-open-outline';
  if (value.includes('unterschrift')) return 'create-outline';
  if (value.includes('einsatz') || value.includes('termin')) return 'calendar-outline';
  if (value.includes('profil')) return 'person-circle-outline';
  if (value.includes('hilfe') || value.includes('notfall')) return 'medical-outline';
  if (value.includes('gehalt') || value.includes('budget')) return 'wallet-outline';
  if (value.includes('arbeitszeit') || value.includes('zeit')) return 'time-outline';
  if (value.includes('kalender')) return 'calendar-clear-outline';
  if (value.includes('klienten')) return 'people-outline';
  if (value.includes('aufgabe')) return 'checkmark-done-outline';
  return kind === 'employee' ? 'briefcase-outline' : 'shield-checkmark-outline';
}

const breakLongWords = Platform.OS === 'web'
  ? ({ overflowWrap: 'anywhere', wordBreak: 'break-word' } as unknown as TextStyle)
  : null;

export function PortalPremiumPageHero({ kind, title, subtitle, eyebrow, compact = false }: Props) {
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const mobile = isPhone || width < 760;
  const icon = resolveIcon(title, kind);

  return (
    <View
      style={[styles.hero, compact && styles.heroCompact, mobile && styles.heroMobile]}
      testID={`${kind}-portal-premium-page-hero`}
    >
      <LinearGradient
        colors={kind === 'employee'
          ? ['#FFFFFF', '#F1F7FF', '#DCEBFF']
          : ['#FFFFFF', '#EDF6FF', '#D9ECFF']}
        locations={[0, 0.58, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.glowLarge} pointerEvents="none" />
      <View style={styles.glowSmall} pointerEvents="none" />

      <View style={styles.copy}>
        <View style={styles.pill}>
          <Ionicons name={kind === 'employee' ? 'briefcase' : 'shield-checkmark'} color={portalPremium.accent.blueDark} size={14} />
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        </View>
        <Text style={[type.h1, styles.title, mobile && styles.titleMobile, breakLongWords]}>{title}</Text>
        {subtitle ? <Text style={[type.body, styles.subtitle, breakLongWords]}>{subtitle}</Text> : null}
      </View>

      {!mobile ? (
        <View style={styles.iconStage} pointerEvents="none">
          <View style={styles.iconHalo} />
          <View style={styles.iconTile}>
            <Ionicons name={icon} color={portalPremium.accent.blue} size={34} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const shadow = Platform.OS === 'web'
  ? ({ boxShadow: portalPremium.shadow.panel } as unknown as ViewStyle)
  : ({ shadowColor: '#001C44', shadowOpacity: 0.2, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 } as ViewStyle);

const styles = StyleSheet.create({
  hero: {
    minHeight: 150,
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: careSpacing.xl,
    paddingVertical: careSpacing.lg,
    borderWidth: 1,
    borderColor: portalPremium.border,
    borderRadius: portalPremium.radius.panel,
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.lg,
    ...shadow,
  },
  heroCompact: {
    minHeight: 118,
    paddingVertical: careSpacing.md,
  },
  heroMobile: {
    minHeight: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 19,
  },
  glowLarge: {
    position: 'absolute',
    right: -80,
    top: -155,
    width: 360,
    height: 360,
    borderRadius: 999,
    backgroundColor: 'rgba(53,151,255,0.18)',
  },
  glowSmall: {
    position: 'absolute',
    left: '42%',
    bottom: -140,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: 'rgba(109,74,255,0.06)',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  pill: {
    alignSelf: 'flex-start',
    minHeight: 30,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: portalPremium.borderSoft,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    color: portalPremium.accent.blueDark,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    color: portalPremium.text.primary,
    fontWeight: '900',
    letterSpacing: -0.65,
  },
  titleMobile: {
    letterSpacing: -0.35,
  },
  subtitle: {
    maxWidth: 780,
    color: portalPremium.text.secondary,
    fontWeight: '600',
  },
  iconStage: {
    width: 94,
    height: 94,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHalo: {
    position: 'absolute',
    width: 94,
    height: 94,
    borderRadius: 999,
    backgroundColor: 'rgba(5,108,232,0.09)',
  },
  iconTile: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderColor: portalPremium.borderStrong,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

