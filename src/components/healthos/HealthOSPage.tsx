import { useMemo, type ReactNode } from 'react';
import {
  ScrollView,
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
      }),
    [variant],
  );

  if (scroll) {
    return (
      <ScrollView
        style={[styles.root, style]}
        contentContainerStyle={[styles.inner, contentContainerStyle]}
        testID={testID}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.root, styles.inner, style]} testID={testID}>
      {children}
    </View>
  );
}
