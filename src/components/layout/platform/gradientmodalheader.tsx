import { useMemo, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveGalaxyGradientColors } from '@/design/tokens/galaxy';
import { glassFx, neonGlow } from '@/design/tokens/motion';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

export type GradientModalHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onClose: () => void;
  actions?: ReactNode;
};

export function GradientModalHeader({
  title,
  subtitle,
  onBack,
  onClose,
  actions,
}: GradientModalHeaderProps) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          overflow: 'hidden',
          ...Platform.select({
            web: neonGlow('#C44BA8', 0.28, 20, 8) as object,
            default: {},
          }),
        },
        gradientBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: careSpacing.md,
          paddingTop: careSpacing.md,
          paddingBottom: careSpacing.sm,
          gap: careSpacing.sm,
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
          color: '#FFFFFF',
          fontWeight: '700',
          flex: 1,
        },
        iconBtn: {
          width: 36,
          height: 36,
          borderRadius: careRadius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.28)',
          backgroundColor: 'rgba(255,255,255,0.12)',
        },
        iconLabel: {
          ...careTypography.bodyStrong,
          color: '#FFFFFF',
          fontSize: 18,
          lineHeight: 20,
        },
        statusBar: {
          backgroundColor: 'rgba(11, 16, 32, 0.88)',
          paddingHorizontal: careSpacing.md,
          paddingVertical: careSpacing.xs,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.08)',
        },
        statusText: {
          ...careTypography.caption,
          color: 'rgba(255,255,255,0.78)',
        },
      }),
    [],
  );

  const gradientContent = (
    <>
      <View style={styles.headerLeading}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Zurück"
          >
            <Text style={styles.iconLabel}>←</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={styles.headerTrailing}>
        {actions}
        <Pressable
          onPress={onClose}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Schließen"
        >
          <Text style={styles.iconLabel}>×</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.gradientBar}>
        <LinearGradient
          colors={[...resolveGalaxyGradientColors('modalHeader')]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={glassFx.sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.6 }}
          style={styles.heroSheen}
          pointerEvents="none"
        />
        {gradientContent}
      </View>
      {subtitle ? (
        <View style={styles.statusBar}>
          <Text style={styles.statusText} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
