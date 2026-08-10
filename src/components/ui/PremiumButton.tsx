import React, { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { LlganGlassShell } from '@/design/web/applyLlganGlassDom';
import { portalPremium, usePortalPremiumTheme } from '@/design/tokens/portalPremium';
import { useAccessibility } from '@/hooks/useAccessibility';
import { buttonHeights, motion, radius } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  onDarkSurface?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

/**
 * Canonical system action.
 *
 * Internal product routes render the single-surface ORBIT implementation.
 * Portal routes retain their established premium presentation and therefore
 * remain outside the internal redesign contract.
 */
export function PremiumButton(props: Props) {
  const portal = usePortalPremiumTheme();
  return portal.active ? <PortalPremiumButton {...props} /> : <OrbitPremiumButton {...props} />;
}

const ORBIT_SIZE = {
  sm: { height: 40, minWidth: 88, padding: 14, fontSize: 14, lineHeight: 19, radius: 11 },
  md: { height: 46, minWidth: 112, padding: 18, fontSize: 15, lineHeight: 20, radius: 13 },
  lg: { height: 52, minWidth: 132, padding: 22, fontSize: 16, lineHeight: 22, radius: 15 },
} as const;

const ORBIT_VARIANT = {
  primary: {
    background: '#086FDF',
    backgroundHover: '#075FC4',
    border: '#075BB8',
    borderHover: '#064D9E',
    label: '#FFFFFF',
    shadow: 'rgba(8,111,223,0.24)',
  },
  secondary: {
    background: '#FFFFFF',
    backgroundHover: '#F1F7FF',
    border: 'rgba(8,111,223,0.30)',
    borderHover: 'rgba(8,95,196,0.48)',
    label: '#075DBF',
    shadow: 'rgba(37,78,128,0.12)',
  },
  ghost: {
    background: 'transparent',
    backgroundHover: 'rgba(8,111,223,0.07)',
    border: 'transparent',
    borderHover: 'rgba(8,111,223,0.18)',
    label: '#334155',
    shadow: 'rgba(37,78,128,0)',
  },
  danger: {
    background: '#D92D4C',
    backgroundHover: '#BE2440',
    border: '#B8203B',
    borderHover: '#9F1C34',
    label: '#FFFFFF',
    shadow: 'rgba(217,45,76,0.22)',
  },
} as const;

function OrbitPremiumButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  fullWidth = false,
  accessibilityLabel,
  testID,
  leadingIcon,
  trailingIcon,
}: Props) {
  const { scaleFontSize } = useAccessibility();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;
  const dimensions = ORBIT_SIZE[size];
  const colors = ORBIT_VARIANT[variant];

  const localStyles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          height: dimensions.height,
          minHeight: dimensions.height,
          maxHeight: dimensions.height,
          minWidth: fullWidth ? undefined : dimensions.minWidth,
          width: fullWidth ? '100%' : undefined,
          paddingHorizontal: dimensions.padding,
          paddingVertical: 0,
          borderWidth: 1,
          borderColor: hovered && !isDisabled ? colors.borderHover : colors.border,
          borderRadius: dimensions.radius,
          backgroundColor: hovered && !isDisabled ? colors.backgroundHover : colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          opacity: isDisabled ? 0.46 : 1,
          ...(Platform.OS === 'web'
            ? ({
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                boxSizing: 'border-box',
                outline: focused ? '3px solid rgba(22,131,255,0.24)' : 'none',
                outlineOffset: focused ? 2 : 0,
                boxShadow:
                  variant === 'ghost' || isDisabled
                    ? 'none'
                    : hovered
                      ? `0 9px 22px ${colors.shadow}`
                      : `0 5px 14px ${colors.shadow}`,
                transition:
                  'background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, opacity 150ms ease',
              } as unknown as ViewStyle)
            : null),
        },
        label: {
          color: colors.label,
          fontSize: Platform.OS === 'web' ? dimensions.fontSize : scaleFontSize(dimensions.fontSize),
          lineHeight: Platform.OS === 'web' ? dimensions.lineHeight : scaleFontSize(dimensions.lineHeight),
          fontWeight: '700',
          letterSpacing: -0.12,
          textAlign: 'center',
        },
      }),
    [colors, dimensions, focused, fullWidth, hovered, isDisabled, scaleFontSize, variant],
  );

  return (
    <Animated.View style={[animatedStyle, fullWidth && styles.fullWidth]} pointerEvents="box-none">
      <Pressable
        disabled={isDisabled}
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPressIn={() => {
          if (!isDisabled) scale.value = withSpring(0.985, motion.spring);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring);
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        testID={testID}
        style={[localStyles.button, style]}
        {...(Platform.OS === 'web'
          ? ({
              dataSet: {
                csHealthosComponent: 'button',
                csHealthosVariant: variant,
                csOrbitButton: 'root',
                csOrbitButtonSize: size,
              },
            } as object)
          : {})}
      >
        <View style={styles.content} pointerEvents="none">
          {!loading && leadingIcon ? <View style={styles.icon}>{leadingIcon}</View> : null}
          {loading ? (
            <ActivityIndicator color={colors.label} />
          ) : (
            <Text allowFontScaling style={localStyles.label} numberOfLines={1}>
              {title}
            </Text>
          )}
          {!loading && trailingIcon ? <View style={styles.icon}>{trailingIcon}</View> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Existing portal presentation, intentionally isolated from ORBIT. */
function PortalPremiumButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  fullWidth = false,
  accessibilityLabel,
  testID,
}: Props) {
  const { scaleFontSize } = useAccessibility();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;
  const resolvedSize = size === 'lg' ? 'md' : size;
  const height = resolvedSize === 'sm' ? buttonHeights.sm : buttonHeights.md;
  const portalVariant = variant === 'danger' ? 'primary' : variant;

  const localStyles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          minHeight: height,
          minWidth: fullWidth ? undefined : resolvedSize === 'sm' ? 96 : 120,
          width: fullWidth ? '100%' : undefined,
          borderRadius: radius.lg,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: resolvedSize === 'sm' ? 16 : 20,
          paddingVertical: resolvedSize === 'sm' ? 8 : 10,
          borderWidth: 1,
          borderColor:
            portalVariant === 'primary' ? portalPremium.accent.blue : portalPremium.borderStrong,
          backgroundColor:
            portalVariant === 'ghost'
              ? 'transparent'
              : portalVariant === 'secondary'
                ? 'rgba(255,255,255,0.82)'
                : portalPremium.accent.blue,
          ...(Platform.OS === 'web'
            ? ({
                boxShadow:
                  portalVariant === 'primary'
                    ? '0 10px 24px rgba(5,108,232,0.24)'
                    : '0 8px 18px rgba(0,38,82,0.10)',
              } as unknown as ViewStyle)
            : null),
        },
        label: {
          color:
            portalVariant === 'primary'
              ? portalPremium.text.onStrong
              : portalPremium.accent.blueDark,
          fontSize: Platform.OS === 'web' ? 16 : scaleFontSize(16),
          lineHeight: Platform.OS === 'web' ? 21 : scaleFontSize(21),
          fontWeight: '800',
          textAlign: 'center',
        },
      }),
    [fullWidth, height, portalVariant, resolvedSize, scaleFontSize],
  );

  const content = (
    <LlganGlassShell kind="button" style={[localStyles.button, isDisabled && styles.disabled, style]}>
      {portalVariant === 'primary' ? (
        <LinearGradient
          colors={[portalPremium.accent.blue, '#0879F5', portalPremium.accent.blueDark]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : portalVariant === 'secondary' ? (
        <LinearGradient
          colors={['rgba(255,255,255,0.96)', 'rgba(232,244,255,0.94)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {loading ? (
        <ActivityIndicator
          color={
            portalVariant === 'primary'
              ? portalPremium.text.onStrong
              : portalPremium.accent.blueDark
          }
        />
      ) : (
        <Text allowFontScaling style={localStyles.label}>
          {title}
        </Text>
      )}
    </LlganGlassShell>
  );

  return (
    <Animated.View style={[animatedStyle, fullWidth && styles.fullWidth]} pointerEvents="box-none">
      <Pressable
        disabled={isDisabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        testID={testID}
        style={Platform.OS === 'web' ? ({ cursor: isDisabled ? 'default' : 'pointer' } as ViewStyle) : undefined}
        onPressIn={() => {
          if (!isDisabled) scale.value = withSpring(0.96, motion.spring);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, motion.spring);
        }}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.42 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
