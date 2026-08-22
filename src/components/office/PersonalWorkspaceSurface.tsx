import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';

export const PERSONAL_SURFACE_DATASET = { csPersonalSurface: 'light' } as const;

export function PersonalWorkspaceSurface({
  children,
  style,
  padded = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <SurfaceContrastProvider tone="light">
      <View
        style={[styles.root, padded ? styles.padded : null, style]}
        {...(Platform.OS === 'web' ? ({ dataSet: PERSONAL_SURFACE_DATASET } as object) : {})}
      >
        {children}
      </View>
    </SurfaceContrastProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: '#F4F8FC',
  },
  padded: { padding: 16 },
});
