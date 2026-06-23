import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ACCENT_ICON_FRAME_GRADIENT,
  accentDarkSoftBorder,
} from '@/design/tokens/accentContrast';

type AccentIconBackdropProps = {
  accentColor: string;
  size?: number;
  active?: boolean;
  borderRadius?: number;
  circular?: boolean;
  children: ReactNode;
  style?: ViewStyle;
};

/** Dark soft rounded backing for colored icons on light orbital surfaces. */
export function AccentIconBackdrop({
  accentColor,
  size = 32,
  active = false,
  borderRadius = 10,
  circular = false,
  children,
  style,
}: AccentIconBackdropProps) {
  const resolvedRadius = circular ? size / 2 : borderRadius;

  return (
    <View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: resolvedRadius,
          borderColor: accentDarkSoftBorder(accentColor, active),
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
      <View style={styles.stage}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
