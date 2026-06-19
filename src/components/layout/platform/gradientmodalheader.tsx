import { useMemo, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { resolveGalaxyGradientColors } from '@/design/tokens/galaxy';
import { glassFx, neonGlow } from '@/design/tokens/motion';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

export type GradientModalHeaderProps = {
  title: string;
  onBack?: () => void;
  onClose: () => void;
  actions?: ReactNode;
};

export function GradientModalHeader({
  title,
  onBack,
  onClose,
  actions,
}: GradientModalHeaderProps) {
  const { isDark, c } = useCareLightPalette();
  const useHero = isDark;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: careSpacing.md,
          paddingTop: careSpacing.md,
          paddingBottom: careSpacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          gap: careSpacing.sm,
        },
        heroHeader: {
          overflow: 'hidden',
          borderBottomWidth: 0,
          ...Platform.select({
            web: neonGlow(c.violet, 0.28, 20, 8) as object,
            default: {},
          }),
        },
        heroSheen: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60%',
        },
        headerLeading: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: careSpacing.sm,
          flex: 1,
          minWidth: 0,
        },
        headerTrailing: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: careSpacing.sm,
          flexShrink: 1,
        },
        title: {
          ...careTypography.h3,
          color: c.text,
          flex: 1,
        },
        heroTitle: {
          color: '#FFFFFF',
        },
        iconBtn: {
          width: 36,
          height: 36,
          borderRadius: careRadius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : c.surfaceAlt,
        },
        heroIconBtn: {
          borderColor: 'rgba(255,255,255,0.28)',
          backgroundColor: 'rgba(255,255,255,0.12)',
        },
        iconLabel: {
          ...careTypography.bodyStrong,
          color: c.muted,
          fontSize: 18,
          lineHeight: 20,
        },
        heroIconLabel: {
          color: '#FFFFFF',
        },
      }),
    [c, isDark],
  );

  const content = (
    <>
      <View style={styles.headerLeading}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={[styles.iconBtn, useHero && styles.heroIconBtn]}
            accessibilityRole="button"
            accessibilityLabel="Zurück"
          >
            <Text style={[styles.iconLabel, useHero && styles.heroIconLabel]}>←</Text>
          </Pressable>
        ) : null}
        <Text style={[styles.title, useHero && styles.heroTitle]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={styles.headerTrailing}>
        {actions}
        <Pressable
          onPress={onClose}
          style={[styles.iconBtn, useHero && styles.heroIconBtn]}
          accessibilityRole="button"
          accessibilityLabel="Schließen"
        >
          <Text style={[styles.iconLabel, useHero && styles.heroIconLabel]}>×</Text>
        </Pressable>
      </View>
    </>
  );

  if (useHero) {
    return (
      <View style={[styles.header, styles.heroHeader]}>
        <LinearGradient
          colors={[...resolveGalaxyGradientColors('dashboardHero')]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={glassFx.sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.6 }}
          style={styles.heroSheen}
          pointerEvents="none"
        />
        {content}
      </View>
    );
  }

  return <View style={styles.header}>{content}</View>;
}
