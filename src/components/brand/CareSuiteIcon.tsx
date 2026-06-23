import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { AppStartIconKey } from '@/data/landing/appStartEntries';
import {
  ACCENT_ICON_FRAME_GRADIENT,
  accentDarkSoftBorder,
} from '@/design/tokens/accentContrast';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careRadius } from '@/design/tokens/radius';

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
    const innerSize = size * 0.82;
    const iconSize = size * 0.38;

    return (
      <View
        style={[
          styles.auroraOuter,
          {
            width: size,
            height: size,
            borderRadius: size * 0.28,
            shadowColor: accentColor,
          },
          style,
        ]}
      >
        <LinearGradient
          colors={[`${accentColor}66`, `${accentColor}22`, 'rgba(255,255,255,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.auroraRing, { borderRadius: size * 0.28 }]}
        >
          <View
            style={[
              styles.auroraInner,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerSize * 0.26,
                borderColor: `${accentColor}55`,
                backgroundColor: `${accentColor}18`,
              },
            ]}
          >
            <Feather name={VECTOR_MAP[iconKey]} size={iconSize} color={accentColor} />
          </View>
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
    shadowOpacity: 0.42,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  auroraRing: {
    flex: 1,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  auroraInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: careRadius.md,
  },
});
