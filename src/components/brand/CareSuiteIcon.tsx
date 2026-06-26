import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { AppStartIconKey } from '@/data/landing/appStartEntries';
import {
  ACCENT_ICON_FRAME_GRADIENT,
  accentDarkSoftBorder,
} from '@/design/tokens/accentContrast';
import { withAlpha } from '@/design/tokens/motion';
import { useLegacyTheme } from '@/design/tokens/themeBridge';

const VECTOR_MAP: Record<AppStartIconKey, keyof typeof Feather.glyphMap> = {
  building: 'briefcase',
  user: 'user',
  home: 'home',
  sparkle: 'zap',
};

type CareSuiteIconProps = {
  emoji?: string;
  iconKey?: AppStartIconKey;
  accentColor?: string;
  size?: number;
  style?: ViewStyle;
  variant?: 'default' | 'aurora';
};

export function CareSuiteIcon({
  emoji,
  iconKey,
  accentColor = '#FF7A1A',
  size = 40,
  style,
  variant = 'default',
}: CareSuiteIconProps) {
  const { isLight } = useLegacyTheme();

  if (iconKey && variant === 'aurora') {
    const outerRadius = size * 0.28;
    const innerSize = size * 0.84;
    const innerRadius = innerSize * 0.24;
    const iconSize = size * 0.44;
    const webGlow =
      Platform.OS === 'web'
        ? ({
            boxShadow: `0 8px 28px ${withAlpha(accentColor, 0.45)}, 0 2px 8px ${withAlpha(accentColor, 0.28)}, inset 0 1px 0 rgba(255,255,255,0.35)`,
          } as ViewStyle)
        : null;

    return (
      <View
        style={[
          styles.auroraOuter,
          {
            width: size,
            height: size,
            borderRadius: outerRadius,
            shadowColor: accentColor,
          },
          webGlow,
          style,
        ]}
      >
        <LinearGradient
          colors={[
            withAlpha(accentColor, 0.88),
            withAlpha(accentColor, 0.52),
            withAlpha(accentColor, 0.24),
            'rgba(255,255,255,0.10)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.auroraRing, { borderRadius: outerRadius }]}
        >
          <LinearGradient
            colors={[...ACCENT_ICON_FRAME_GRADIENT]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={[
              styles.auroraInner,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerRadius,
                borderColor: withAlpha(accentColor, 0.62),
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.22)', 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.auroraSheen, { borderRadius: innerRadius }]}
              pointerEvents="none"
            />
            <Feather
              name={VECTOR_MAP[iconKey]}
              size={iconSize}
              color={accentColor}
              style={styles.auroraIcon}
            />
          </LinearGradient>
        </LinearGradient>
      </View>
    );
  }

  if (isLight) {
    const borderRadius = size * 0.25;
    return (
      <View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius,
            borderColor: accentDarkSoftBorder(accentColor),
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <LinearGradient
          colors={[...ACCENT_ICON_FRAME_GRADIENT]}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {iconKey ? (
          <Feather name={VECTOR_MAP[iconKey]} size={size * 0.42} color={accentColor} />
        ) : (
          <Text style={[styles.emoji, { fontSize: size * 0.45 }]}>{emoji}</Text>
        )}
      </View>
    );
  }

  if (iconKey) {
    return (
      <View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size * 0.25,
            backgroundColor: `${accentColor}22`,
            borderColor: `${accentColor}44`,
          },
          style,
        ]}
      >
        <Feather name={VECTOR_MAP[iconKey]} size={size * 0.42} color={accentColor} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size * 0.25,
          backgroundColor: `${accentColor}22`,
          borderColor: `${accentColor}44`,
        },
        style,
      ]}
    >
      <Text style={[styles.emoji, { fontSize: size * 0.45 }]}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emoji: {
    textAlign: 'center',
  },
  auroraOuter: {
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  auroraRing: {
    flex: 1,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  auroraInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  auroraSheen: {
    ...StyleSheet.absoluteFillObject,
  },
  auroraIcon: {
    textShadowColor: withAlpha('#FFFFFF', 0.35),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
