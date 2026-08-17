import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { systemLiquidGlass, SYSTEM_BLUE_GRADIENT, SYSTEM_LIQUID_COLORS } from '@/design/tokens/systemLiquidGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';

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

export function ClientWorkspaceKpiCard({ label, value, hint, icon, accentColor, active = false, compact = false, onPress, style }: ClientWorkspaceKpiCardProps) {
  const { typography } = useLegacyTheme();
  const card = (
    <View style={[styles.kpiCard, compact && styles.kpiCardCompact, active && styles.kpiCardActive, { borderColor: active ? accentColor : systemLiquidGlass.border }, onPress ? styles.kpiPressableCard : style]}>
      <LinearGradient colors={['#FFFFFF', '#F7FBFF', '#EEF6FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      <View style={[styles.kpiAccent, { backgroundColor: accentColor }]} pointerEvents="none" />
      <View style={styles.kpiTopRow}>
        <View style={[styles.kpiIcon, { borderColor: accentColor, backgroundColor: `${accentColor}12` }]}><Text style={styles.kpiIconText}>{icon}</Text></View>
        <Text style={[typography.caption, styles.kpiLabel]}>{label}</Text>
      </View>
      <Text style={[typography.h2, styles.kpiValue, { color: accentColor }]}>{value}</Text>
      {hint ? <Text style={[typography.caption, styles.kpiHint]} numberOfLines={2}>{hint}</Text> : null}
    </View>
  );

  if (!onPress) return card;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={({ pressed }) => [style, pressed && styles.pressed]}>{card}</Pressable>;
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

export function ClientWorkspacePanel({ eyebrow, title, subtitle, accessory, children, style, contentStyle, compact = false }: ClientWorkspacePanelProps) {
  const { typography } = useLegacyTheme();
  const showHeader = Boolean(eyebrow || title || subtitle || accessory);
  return (
    <View style={[styles.panel, compact && styles.panelCompact, style]}>
      <LinearGradient colors={['#FFFFFF', '#F8FBFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      {showHeader ? (
        <View style={styles.panelHeader}>
          <View style={styles.panelTitleColumn}>
            {eyebrow ? <Text style={[typography.caption, styles.panelEyebrow]}>{eyebrow}</Text> : null}
            {title ? <Text style={[typography.h3, styles.panelTitle]}>{title}</Text> : null}
            {subtitle ? <Text style={[typography.caption, styles.panelSubtitle]}>{subtitle}</Text> : null}
          </View>
          {accessory ? <View style={styles.panelAccessory}>{accessory}</View> : null}
        </View>
      ) : null}
      <View style={[styles.panelContent, contentStyle]}>{children}</View>
    </View>
  );
}

export function ClientWorkspaceLiveBadge({ label, connected = true, inverse = false }: { label: string; connected?: boolean; inverse?: boolean }) {
  const { typography } = useLegacyTheme();
  return (
    <View style={[styles.liveBadge, inverse && styles.liveBadgeInverse]}>
      <View style={[styles.liveDot, { backgroundColor: connected ? '#14B884' : '#7A8798' }]} />
      <Text style={[typography.caption, styles.liveBadgeText, inverse && styles.liveBadgeTextInverse]}>{label}</Text>
    </View>
  );
}

export function ClientWorkspaceButton({ label, onPress, variant = 'secondary', disabled = false, loading = false, compact = false, style }: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const primary = variant === 'primary';
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: isDisabled }} disabled={isDisabled} onPress={onPress} style={({ pressed }) => [styles.buttonHost, style, pressed && !isDisabled && styles.buttonPressed]}>
      <View style={[styles.button, compact && styles.buttonCompact, variant === 'secondary' && styles.buttonSecondary, variant === 'ghost' && styles.buttonGhost, variant === 'danger' && styles.buttonDanger, isDisabled && styles.buttonDisabled]}>
        {primary ? <LinearGradient colors={[...SYSTEM_BLUE_GRADIENT]} style={StyleSheet.absoluteFillObject} pointerEvents="none" /> : null}
        {loading ? <ActivityIndicator color={primary ? '#FFFFFF' : SYSTEM_LIQUID_COLORS.electricBlue} /> : (
          <Text style={[styles.buttonLabel, primary && styles.buttonLabelPrimary, variant === 'danger' && styles.buttonLabelDanger]}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}

const webPanelShadow = Platform.OS === 'web' ? ({ boxShadow: systemLiquidGlass.shadowSoft } as unknown as ViewStyle) : null;

const styles = StyleSheet.create({
  pressed: { opacity: 0.82 },
  kpiPressableCard: { flex: 1, width: '100%' },
  kpiCard: { position: 'relative', overflow: 'hidden', minHeight: 124, minWidth: 150, borderRadius: careRadius.lg, borderWidth: 1, padding: careSpacing.md, gap: careSpacing.xs, backgroundColor: '#FFFFFF', ...webPanelShadow },
  kpiCardCompact: { minHeight: 104, minWidth: 124, padding: careSpacing.sm },
  kpiCardActive: { borderWidth: 2, backgroundColor: systemLiquidGlass.rowSelected },
  kpiAccent: { position: 'absolute', top: 0, left: careSpacing.md, right: careSpacing.md, height: 3, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  kpiTopRow: { flexDirection: 'row', alignItems: 'center', gap: careSpacing.xs },
  kpiIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  kpiIconText: { fontSize: 17 },
  kpiLabel: { flex: 1, color: '#031127', fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  kpiValue: { fontWeight: '900' },
  kpiHint: { color: '#34445A', fontWeight: '600' },
  panel: { position: 'relative', overflow: 'hidden', borderRadius: careRadius.xl, borderWidth: 1, borderColor: systemLiquidGlass.borderStrong, backgroundColor: '#FFFFFF', padding: careSpacing.lg, gap: careSpacing.md, ...webPanelShadow },
  panelCompact: { padding: careSpacing.md },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: careSpacing.md },
  panelTitleColumn: { flex: 1, minWidth: 0, gap: 3 },
  panelEyebrow: { color: SYSTEM_LIQUID_COLORS.electricBlue, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  panelTitle: { color: SYSTEM_LIQUID_COLORS.navy, fontWeight: '900' },
  panelSubtitle: { color: '#34445A', fontWeight: '600' },
  panelAccessory: { flexShrink: 0 },
  panelContent: { gap: careSpacing.md },
  liveBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, paddingHorizontal: careSpacing.sm, paddingVertical: 6, borderRadius: careRadius.full, borderWidth: 1, borderColor: systemLiquidGlass.borderStrong, backgroundColor: '#F5FAFF' },
  liveBadgeInverse: { borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.14)' },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveBadgeText: { color: SYSTEM_LIQUID_COLORS.navy, fontWeight: '800' },
  liveBadgeTextInverse: { color: '#FFFFFF' },
  buttonHost: { flexShrink: 0 },
  button: { minHeight: 48, minWidth: 132, paddingHorizontal: careSpacing.lg, borderRadius: careRadius.lg, borderWidth: 1, borderColor: SYSTEM_LIQUID_COLORS.electricBlue, backgroundColor: SYSTEM_LIQUID_COLORS.electricBlue, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buttonCompact: { minHeight: 42, minWidth: 104, paddingHorizontal: careSpacing.md },
  buttonSecondary: { backgroundColor: '#FFFFFF' },
  buttonGhost: { backgroundColor: '#F1F7FF', borderColor: systemLiquidGlass.borderStrong },
  buttonDanger: { backgroundColor: '#FFF5F5', borderColor: '#D43737' },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.78 },
  buttonLabel: { color: SYSTEM_LIQUID_COLORS.electricBlue, fontSize: 15, lineHeight: 20, fontWeight: '800', textAlign: 'center' },
  buttonLabelPrimary: { color: '#FFFFFF' },
  buttonLabelDanger: { color: '#B42318' },
});
