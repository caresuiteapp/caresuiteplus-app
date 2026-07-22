import { useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { healthosDensity } from './tokens';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  variant?: 'default' | 'portal';
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function HealthOSPage({
  children,
  scroll = false,
  variant = 'default',
  style,
  contentContainerStyle,
  testID,
}: Props) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
        },
        inner: {
          paddingHorizontal:
            variant === 'portal'
              ? healthosDensity.portal.padding
              : healthosDensity.page.paddingHorizontal,
          paddingVertical: healthosDensity.page.paddingVertical,
          gap: healthosDensity.page.gap,
        },
        scrollContent: {
          flex: 0,
          flexGrow: 0,
          minHeight: 0,
        },
      }),
    [variant],
  );

  // Scrolling belongs to ScreenShell/PortalShellLayout. A second ScrollView here
  // created nested fixed-height viewports and clipped dashboards and long lists.
  return (
    <View
      style={[
        styles.root,
        styles.inner,
        scroll ? styles.scrollContent : null,
        contentContainerStyle,
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}
