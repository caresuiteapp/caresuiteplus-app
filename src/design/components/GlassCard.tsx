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
};

/** One canonical spatial pearl card for Office, Assist, portals and auth. */
export function GlassCard({ children, onPress, glow = false, accentColor, selected = false, style }: GlassCardProps) {
  const styles = useMemo(() => createStyles(accentColor, glow || selected), [accentColor, glow, selected]);
  const body = (
    <View style={[styles.card, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.94)', 'rgba(235,227,241,0.90)']}
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

function createStyles(accentColor?: string, glow = false) {
  return StyleSheet.create({
    card: {
      position: 'relative', overflow: 'hidden', padding: careSpacing.md,
      borderRadius: spatialCare.radius.card, borderWidth: 1,
      borderColor: accentColor ? `${accentColor}70` : spatialCare.borderDark,
      backgroundColor: spatialCare.stageStrong,
      ...(Platform.OS === 'web' ? ({
        boxShadow: glow && accentColor ? `0 18px 48px ${accentColor}32` : spatialCare.shadowSoft,
        backdropFilter: `blur(${spatialCare.blur.stage}px)`,
        transition: 'transform 160ms ease, box-shadow 160ms ease',
      } as unknown as ViewStyle) : null),
    },
    accentEdge: { position: 'absolute', left: 0, top: 18, bottom: 18, width: 4, borderRadius: 4, backgroundColor: accentColor },
    highlight: { position: 'absolute', left: 12, right: 12, top: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.95)' },
    content: { position: 'relative', gap: careSpacing.sm },
    pressed: { opacity: 0.94, transform: [{ scale: 0.988 }] },
  });
}
