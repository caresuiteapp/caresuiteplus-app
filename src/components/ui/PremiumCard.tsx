import { useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { LlganGlassShell } from '@/design/web/applyLlganGlassDom';
import {
  spatialCare,
  spatialCareColors,
} from '@/design/tokens/spatialCareSuite';
import { withAlpha } from '@/design/tokens/motion';
import { motion, radius } from '@/theme';
import { portalPremium, usePortalPremiumTheme } from '@/design/tokens/portalPremium';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accentColor?: string;
  variant?: 'default' | 'elevated';
  sheen?: boolean;
};

const webCursor =
  Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

/**
 * Verbindliche Systemkarte für Office, Assist und alle Portale.
 * Keine Light-/Dark-/Modul-Sonderpfade: Struktur, Tiefe und Lesbarkeit bleiben überall gleich.
 */
export function PremiumCard({
  children,
  style,
  contentStyle,
  onPress,
  accentColor = spatialCareColors.cyanLight,
  variant = 'default',
  sheen = true,
}: Props) {
  const portal = usePortalPremiumTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        host: {
          borderRadius: radius.card,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: portal.active
            ? withAlpha(accentColor, variant === 'elevated' ? 0.48 : 0.3)
            : withAlpha(accentColor, variant === 'elevated' ? 0.58 : 0.34),
          shadowColor: accentColor,
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: variant === 'elevated' ? 0.24 : 0.14,
          shadowRadius: variant === 'elevated' ? 24 : 18,
          elevation: variant === 'elevated' ? 12 : 8,
          ...(Platform.OS === 'web'
            ? ({
                boxShadow:
                  variant === 'elevated'
                    ? portal.active
                      ? portalPremium.shadow.panel
                      : `0 22px 48px rgba(37,78,128,0.14), 0 0 30px ${withAlpha(accentColor, 0.10)}`
                    : portal.active
                      ? portalPremium.shadow.card
                      : '0 15px 34px rgba(37,78,128,0.11)',
              } as unknown as ViewStyle)
            : null),
        },
        gradient: {
          ...StyleSheet.absoluteFillObject,
        },
        glow: {
          position: 'absolute',
          top: -76,
          right: -40,
          width: 210,
          height: 210,
          borderRadius: 105,
          backgroundColor: withAlpha(accentColor, variant === 'elevated' ? 0.2 : 0.12),
        },
        edge: {
          position: 'absolute',
          top: 0,
          left: 24,
          right: 24,
          height: 2,
          borderRadius: 2,
          backgroundColor: accentColor,
          shadowColor: accentColor,
          shadowOpacity: 0.8,
          shadowRadius: 10,
        },
        innerBorder: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: portal.active ? portalPremium.innerBorder : spatialCare.borderGlow,
        },
        content: {
          padding: 20,
          zIndex: 2,
        },
      }),
    [accentColor, portal.active, variant],
  );

  const body = (
    <LlganGlassShell
      kind="card"
      style={styles.host}
      dataSet={{ csHealthosComponent: onPress ? 'interactive-card' : 'card' }}
    >
      <LinearGradient
        colors={portal.active
          ? variant === 'elevated'
            ? ['#FFFFFF', '#EEF6FF', '#DDEEFF']
            : ['#FFFFFF', '#F5FAFF', '#E8F3FF']
          : variant === 'elevated'
            ? ['#FFFFFF', '#F2F8FF', '#EAF4FF']
            : ['#FFFFFF', '#F7FBFF', '#EEF7FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
        pointerEvents="none"
      />
      {sheen ? <View style={styles.glow} pointerEvents="none" /> : null}
      <View style={styles.innerBorder} pointerEvents="none" />
      <View style={styles.edge} pointerEvents="none" />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </LlganGlassShell>
  );

  return (
    <Animated.View style={[animatedStyle, style]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            scale.value = withSpring(0.986, motion.spring);
          }}
          onPressOut={() => {
            scale.value = withSpring(1, motion.spring);
          }}
          style={webCursor}
          accessibilityRole="button"
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
    </Animated.View>
  );
}
