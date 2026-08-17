import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';

type ClientWorkspaceKpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: string;
  accentColor: string;
  active?: boolean;
  compact?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ClientWorkspaceKpiCard({
  label,
  value,
  hint,
  icon,
  accentColor,
  active = false,
  compact = false,
  onPress,
  style,
}: ClientWorkspaceKpiCardProps) {
  const { typography } = useLegacyTheme();
  const card = (
    <View
      style={[
        styles.kpiCard,
        compact && styles.kpiCardCompact,
        active && styles.kpiCardActive,
        { borderColor: active ? accentColor : careSuiteAuroraTheme.glass.border },
        onPress ? styles.kpiPressableCard : style,
      ]}
    >
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.12)',
          'rgba(255,255,255,0.035)',
          'rgba(255,255,255,0.015)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={[styles.kpiAccent, { backgroundColor: accentColor }]} pointerEvents="none" />
      <View style={styles.kpiTopRow}>
        <View style={[styles.kpiIcon, { borderColor: accentColor }]}>
          <Text style={styles.kpiIconText}>{icon}</Text>
        </View>
        <Text style={[typography.caption, styles.kpiLabel]}>{label}</Text>
      </View>
      <Text style={[typography.h2, styles.kpiValue, { color: accentColor }]}>{value}</Text>
      {hint ? (
        <Text style={[typography.caption, styles.kpiHint]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return card;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      {card}
    </Pressable>
  );
}

type ClientWorkspacePanelProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  accessory?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function ClientWorkspacePanel({
  eyebrow,
  title,
  subtitle,
  accessory,
  children,
  style,
  contentStyle,
  compact = false,
}: ClientWorkspacePanelProps) {
  const { typography } = useLegacyTheme();
  const showHeader = Boolean(eyebrow || title || subtitle || accessory);

  return (
    <View style={[styles.panel, compact && styles.panelCompact, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.085)', 'rgba(255,255,255,0.018)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {showHeader ? (
        <View style={styles.panelHeader}>
          <View style={styles.panelTitleColumn}>
            {eyebrow ? (
              <Text style={[typography.caption, styles.panelEyebrow]}>{eyebrow}</Text>
            ) : null}
            {title ? <Text style={[typography.h3, styles.panelTitle]}>{title}</Text> : null}
            {subtitle ? (
              <Text style={[typography.caption, styles.panelSubtitle]}>{subtitle}</Text>
            ) : null}
          </View>
          {accessory ? <View style={styles.panelAccessory}>{accessory}</View> : null}
        </View>
      ) : null}
      <View style={[styles.panelContent, contentStyle]}>{children}</View>
    </View>
  );
}

export function ClientWorkspaceLiveBadge({
  label,
  connected = true,
}: {
  label: string;
  connected?: boolean;
}) {
  const { typography } = useLegacyTheme();
  return (
    <View style={styles.liveBadge}>
      <View
        style={[
          styles.liveDot,
          {
            backgroundColor: connected
              ? careSuiteAuroraTheme.accent.cyan
              : careSuiteAuroraTheme.text.muted,
          },
        ]}
      />
      <Text style={[typography.caption, styles.liveBadgeText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.82 },
  kpiPressableCard: { flex: 1, width: '100%' },
  kpiCard: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 132,
    minWidth: 150,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    padding: careSpacing.md,
    gap: careSpacing.xs,
    backgroundColor: careSuiteAuroraTheme.glass.backgroundStrong,
  },
  kpiCardCompact: {
    minHeight: 108,
    minWidth: 124,
    padding: careSpacing.sm,
  },
  kpiCardActive: {
    borderWidth: 2,
  },
  kpiAccent: {
    position: 'absolute',
    top: 0,
    left: careSpacing.md,
    right: careSpacing.md,
    height: 2,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.xs,
  },
  kpiIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
  },
  kpiIconText: { fontSize: 17 },
  kpiLabel: {
    flex: 1,
    color: careSuiteAuroraTheme.text.secondary,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  kpiValue: {
    color: careSuiteAuroraTheme.text.primary,
    fontWeight: '900',
  },
  kpiHint: {
    color: careSuiteAuroraTheme.text.muted,
    fontWeight: '600',
  },
  panel: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: careRadius.xl,
    borderWidth: 1,
    borderColor: careSuiteAuroraTheme.glass.border,
    backgroundColor: careSuiteAuroraTheme.glass.background,
    padding: careSpacing.lg,
    gap: careSpacing.md,
  },
  panelCompact: {
    padding: careSpacing.md,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: careSpacing.md,
  },
  panelTitleColumn: { flex: 1, minWidth: 0, gap: 3 },
  panelEyebrow: {
    color: careSuiteAuroraTheme.accent.cyan,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  panelTitle: {
    color: careSuiteAuroraTheme.text.primary,
    fontWeight: '900',
  },
  panelSubtitle: {
    color: careSuiteAuroraTheme.text.secondary,
  },
  panelAccessory: { flexShrink: 0 },
  panelContent: { gap: careSpacing.sm },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: careSuiteAuroraTheme.glass.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveBadgeText: {
    color: careSuiteAuroraTheme.text.primary,
    fontWeight: '800',
  },
});
