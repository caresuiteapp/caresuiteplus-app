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
  spatialCareGradients,
} from '@/design/tokens/spatialCareSuite';
import { withAlpha } from '@/design/tokens/motion';
import { motion, radius } from '@/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accentColor?: string;
  variant?: 'default' | 'elevated' | 'pearl';
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
  onPress,
  accentColor = spatialCareColors.cyanLight,
  variant = 'default',
  sheen = true,
}: Props) {
  const isNight = variant === 'elevated';
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
          borderColor: isNight ? withAlpha(accentColor, 0.72) : 'rgba(255,255,255,0.82)',
          shadowColor: accentColor,
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: isNight ? 0.24 : 0.13,
          shadowRadius: isNight ? 24 : 18,
          elevation: isNight ? 12 : 8,
          ...(Platform.OS === 'web'
            ? ({
                boxShadow:
                  isNight
                    ? `0 22px 48px ${withAlpha(spatialCareColors.nightDeep, 0.5)}, 0 0 30px ${withAlpha(accentColor, 0.16)}`
                    : `0 15px 34px ${withAlpha(spatialCareColors.nightDeep, 0.4)}`,
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
          backgroundColor: withAlpha(accentColor, isNight ? 0.2 : 0.1),
        },
        floor: {
          position: 'absolute',
          left: '13%',
          right: '13%',
          bottom: -68,
          height: 142,
          borderRadius: 999,
          backgroundColor: withAlpha(accentColor, 0.14),
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
          borderColor: spatialCare.borderGlow,
        },
        content: {
          padding: 20,
          zIndex: 2,
        },
      }),
    [accentColor, isNight],
  );

  const body = (
    <LlganGlassShell kind="card" style={styles.host}>
      <LinearGradient
         colors={
           isNight
             ? [...spatialCareGradients.nightGlass]
             : [...spatialCareGradients.pearl]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
        pointerEvents="none"
      />
      {sheen ? <View style={styles.glow} pointerEvents="none" /> : null}
      {sheen ? <View style={styles.floor} pointerEvents="none" /> : null}
      <View style={styles.innerBorder} pointerEvents="none" />
      <View style={styles.edge} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
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
