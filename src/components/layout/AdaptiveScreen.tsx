import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';

type AdaptiveScreenProps = {
  phone: ReactNode;
  tablet?: ReactNode;
  desktop?: ReactNode;
};

/**
 * Renders different screen trees per device class without duplicating route files.
 */
export function AdaptiveScreen({ phone, tablet, desktop }: AdaptiveScreenProps) {
  const { shellVariant } = usePlatformLayout();

  if (shellVariant === 'desktop' && desktop) {
    return <View style={styles.fill}>{desktop}</View>;
  }

  if (shellVariant === 'tablet' && tablet) {
    return <View style={styles.fill}>{tablet}</View>;
  }

  return <View style={styles.fill}>{phone}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
