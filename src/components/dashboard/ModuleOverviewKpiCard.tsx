import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { kpiNoBreakTextProps } from '@/components/adaptive/AdaptiveKpiGrid';
import { SpaceKpiIcon } from '@/components/icons/space';
import {
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useAuroraGlassCardStyle,
} from '@/design/tokens/auroraGlass';
import { resolveLlganModuleCardGlow } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { radius } from '@/theme';

const KPI_CARD_MIN_HEIGHT = 150;

type ModuleOverviewKpiCardProps = {
  label: string;
  value: string | number;
  icon?: string;
  accentColor: string;
  moduleKey?: string;
  onPress: () => void;
  style?: ViewStyle;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

export function ModuleOverviewKpiCard({
  label,
  value,
  icon,
  accentColor,
  moduleKey,
  onPress,
  style,
}: ModuleOverviewKpiCardProps) {
  const auroraActive = useAuroraGlassActive();
  const { colors, typography, gradients, isLight } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const glassCardStyle = useAuroraGlassCardStyle({ intensity: 'strong' });
  const lightGlass = isLight && auroraActive;
  const moduleGlow = resolveLlganModuleCardGlow(moduleKey);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          alignSelf: 'center',
          width: '88%',
          maxWidth: '100%',
          minHeight: KPI_CARD_MIN_HEIGHT,
          flexShrink: 0,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: lightGlass ? 'rgba(255,255,255,0.55)' : auroraActive ? colors.borderSoft : colors.borderSoft,
          backgroundColor: lightGlass ? 'transparent' : auroraActive ? colors.bgSurface : gradients.card.default[0],
          overflow: 'hidden',
        },
        moduleGlow: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: radius.lg,
          backgroundColor: moduleGlow ?? 'transparent',
        },
        innerBorder: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.55)',
        },
        rim: {
          height: 2,
          width: '42%',
          alignSelf: 'center',
          borderRadius: 1,
          opacity: 0.9,
        },
        content: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 10,
          paddingVertical: 16,
          gap: 12,
        },
        labelWrap: {
          width: '100%',
          minHeight: 18,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        label: {
          ...typography.caption,
          fontSize: 12,
          lineHeight: 16,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0,
          textAlign: 'center',
          color: text.secondary,
          width: '100%',
          ...(Platform.OS === 'web'
            ? ({ whiteSpace: 'nowrap', maxWidth: '100%' } as TextStyle)
            : null),
        },
        valueWrap: {
          minHeight: 44,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        },
        value: {
          fontSize: 34,
          lineHeight: 40,
          fontWeight: '800',
          letterSpacing: -0.5,
          textAlign: 'center',
          color: accentColor,
          ...(lightGlass && Platform.OS === 'web'
            ? ({ textShadow: `0 0 18px ${accentColor}33` } as TextStyle)
            : null),
        },
      }),
    [accentColor, auroraActive, colors.bgSurface, colors.borderSoft, gradients.card.default, lightGlass, moduleGlow, text.secondary, typography.caption],
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrapper,
        lightGlass ? glassCardStyle : null,
        webCursor,
        pressed ? { opacity: 0.88, transform: [{ scale: 0.985 }] } : null,
        style,
      ]}
      accessibilityRole="link"
    >
      {lightGlass ? (
        <>
          {moduleGlow ? <View style={styles.moduleGlow} pointerEvents="none" /> : null}
          <View style={styles.innerBorder} pointerEvents="none" />
        </>
      ) : null}
      <View style={[styles.rim, { backgroundColor: accentColor }]} />
      <View style={styles.content}>
        {icon ? <SpaceKpiIcon icon={icon} accentColor={accentColor} size={40} /> : null}
        <View style={styles.labelWrap}>
          <Text style={styles.label} {...kpiNoBreakTextProps} minimumFontScale={0.68}>
            {label}
          </Text>
        </View>
        <View style={styles.valueWrap}>
          <Text style={styles.value} {...kpiNoBreakTextProps} minimumFontScale={0.8}>
            {value}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
