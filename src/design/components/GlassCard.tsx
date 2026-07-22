import { ReactNode, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { careSpacing } from '@/design/tokens/spacing';
import { spatialCare } from '@/design/tokens/spatialCareSuite';

type GlassCardProps = {
  children: ReactNode;
  onPress?: () => void;
  glow?: boolean;
  accentColor?: string;
  selected?: boolean;
  style?: import('react-native').StyleProp<ViewStyle>;
  variant?: 'pearl' | 'night';
};

/** One canonical spatial glass card for Office, Assist, portals and auth. */
export function GlassCard({ children, onPress, glow = false, accentColor, selected = false, style, variant = 'pearl' }: GlassCardProps) {
  const styles = useMemo(() => createStyles(accentColor, glow || selected, variant), [accentColor, glow, selected, variant]);
  const body = (
    <View style={[styles.card, style]}>
      <LinearGradient
        colors={variant === 'night'
          ? ['rgba(72,72,108,0.94)', 'rgba(34,35,65,0.96)']
          : ['rgba(255,255,255,0.98)', 'rgba(229,224,238,0.98)', 'rgba(211,225,240,0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {accentColor ? <View style={styles.accentEdge} /> : null}
      <View style={styles.highlight} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed ? styles.pressed : undefined}>{body}</Pressable>;
}

function createStyles(accentColor?: string, glow = false, variant: 'pearl' | 'night' = 'pearl') {
  return StyleSheet.create({
    card: {
      position: 'relative', overflow: 'hidden', padding: careSpacing.md,
      borderRadius: spatialCare.radius.card, borderWidth: 1,
      borderColor: accentColor ? `${accentColor}70` : variant === 'night' ? spatialCare.borderDark : 'rgba(255,255,255,0.86)',
      backgroundColor: variant === 'night' ? spatialCare.stageStrong : 'rgba(239,235,244,0.98)',
      ...(Platform.OS === 'web' ? ({
        boxShadow: glow && accentColor ? `0 18px 48px ${accentColor}32` : variant === 'night' ? spatialCare.shadowSoft : '0 18px 42px rgba(16,22,56,0.18)',
        backdropFilter: `blur(${spatialCare.blur.stage}px)`,
        transition: 'transform 160ms ease, box-shadow 160ms ease',
      } as unknown as ViewStyle) : null),
    },
    accentEdge: { position: 'absolute', left: 0, top: 18, bottom: 18, width: 4, borderRadius: 4, backgroundColor: accentColor },
    highlight: { position: 'absolute', left: 12, right: 12, top: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.24)' },
    content: { position: 'relative', gap: careSpacing.sm },
    pressed: { opacity: 0.94, transform: [{ scale: 0.988 }] },
  });
}
