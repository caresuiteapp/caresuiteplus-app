import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { useResponsiveValue } from '@/hooks/useResponsiveValue';

type AdaptiveFormProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function AdaptiveForm({ children, style }: AdaptiveFormProps) {
  const columns = useResponsiveValue({
    phone: 1,
    tablet: 2,
    desktop: 2,
    wide: 3,
  });

  return (
    <View
      style={[
        styles.root,
        columns > 1 ? styles.multiColumn : styles.singleColumn,
        { gap: careSpacing.md },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  singleColumn: {
    flexDirection: 'column',
  },
  multiColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
