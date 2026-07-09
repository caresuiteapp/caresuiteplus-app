import React from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { careLightColors } from '@/design/tokens/lightTheme';
import { colors, typography } from '@/theme';

type Size = 'sm' | 'md' | 'lg' | 'xl';

type Props = {
  name: string;
  imageUri?: string;
  size?: Size;
  accentColor?: string;
  showOnline?: boolean;
  style?: ViewStyle;
};

const SIZE_CONFIG: Record<Size, { dimension: number; fontSize: number; ring: number }> = {
  sm: { dimension: 32, fontSize: 12, ring: 2 },
  md: { dimension: 44, fontSize: 16, ring: 2 },
  lg: { dimension: 56, fontSize: 20, ring: 3 },
  xl: { dimension: 104, fontSize: 36, ring: 3 },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function PremiumAvatar({
  name,
  imageUri,
  size = 'md',
  accentColor = colors.orange,
  showOnline = false,
  style,
}: Props) {
  const cfg = SIZE_CONFIG[size];
  const initials = getInitials(name);

  return (
    <View style={[styles.wrapper, { width: cfg.dimension, height: cfg.dimension }, style]}>
      <View
        style={[
          styles.ring,
          {
            width: cfg.dimension,
            height: cfg.dimension,
            borderRadius: cfg.dimension / 2,
            borderWidth: cfg.ring,
            borderColor: accentColor,
          },
        ]}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={[
              styles.image,
              {
                width: cfg.dimension - cfg.ring * 2,
                height: cfg.dimension - cfg.ring * 2,
                borderRadius: (cfg.dimension - cfg.ring * 2) / 2,
              },
            ]}
          />
        ) : (
          <LinearGradient
            colors={[careLightColors.surface, careLightColors.page]}
            style={[
              styles.fallback,
              {
                width: cfg.dimension - cfg.ring * 2,
                height: cfg.dimension - cfg.ring * 2,
                borderRadius: (cfg.dimension - cfg.ring * 2) / 2,
              },
            ]}
          >
            <Text style={[styles.initials, { fontSize: cfg.fontSize }]}>{initials}</Text>
          </LinearGradient>
        )}
      </View>
      {showOnline ? (
        <View
          style={[
            styles.onlineDot,
            {
              width: cfg.dimension * 0.25,
              height: cfg.dimension * 0.25,
              borderRadius: cfg.dimension * 0.125,
              right: cfg.ring,
              bottom: cfg.ring,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    backgroundColor: colors.bgElevated,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  onlineDot: {
    position: 'absolute',
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.bgBase,
  },
});
