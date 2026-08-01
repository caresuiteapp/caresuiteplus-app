import { ReactNode, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { careSpacing } from '@/design/tokens/spacing';
import {
  liquidColors,
  liquidRadius,
  liquidSpace,
} from '@/liquid-command/foundation/tokens';
import { portalPremium, usePortalPremiumTheme } from '@/design/tokens/portalPremium';

type GlassCardProps = {
  children: ReactNode;
  onPress?: () => void;
  glow?: boolean;
  accentColor?: string;
  selected?: boolean;
  style?: import('react-native').StyleProp<ViewStyle>;
};

/** One canonical spatial glass card for Office, Assist, portals and auth. */
export function GlassCard({ children, onPress, glow = false, accentColor, selected = false, style }: GlassCardProps) {
  const portal = usePortalPremiumTheme();
  const styles = useMemo(
    () => createStyles(accentColor, glow || selected, portal.active),
    [accentColor, glow, portal.active, selected],
  );
  const body = (
    <View style={[styles.card, style]}>
      <LinearGradient
        colors={portal.active
          ? ['#FFFFFF', '#F3F9FF', '#E4F1FF']
          : ['rgba(6,27,53,0.94)', 'rgba(3,17,39,0.98)']}
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

function createStyles(accentColor?: string, glow = false, portalActive = false) {
  return StyleSheet.create({
    card: {
      position: 'relative', overflow: 'hidden', padding: careSpacing.md,
      borderRadius: liquidRadius.card, borderWidth: 1,
      borderColor: accentColor
        ? `${accentColor}70`
        : portalActive
          ? portalPremium.border
          : liquidColors.white12,
      backgroundColor: portalActive ? portalPremium.surface : liquidColors.navy800,
      ...(Platform.OS === 'web' ? ({
        boxShadow: glow && accentColor
          ? `0 18px 48px ${accentColor}32`
          : portalActive
            ? portalPremium.shadow.card
            : `0 18px 48px ${liquidColors.black24}`,
        backdropFilter: `blur(${liquidSpace.xxl}px)`,
        transition: 'transform 160ms ease, box-shadow 160ms ease',
      } as unknown as ViewStyle) : null),
    },
    accentEdge: { position: 'absolute', left: 0, top: 18, bottom: 18, width: 4, borderRadius: 4, backgroundColor: accentColor },
    highlight: {
      position: 'absolute', left: 12, right: 12, top: 0, height: 1,
      backgroundColor: portalActive ? portalPremium.innerBorder : 'rgba(255,255,255,0.24)',
    },
    content: { position: 'relative', gap: careSpacing.sm },
    pressed: { opacity: 0.94, transform: [{ scale: 0.988 }] },
  });
}
