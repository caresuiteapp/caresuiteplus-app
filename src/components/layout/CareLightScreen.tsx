import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CareSuiteLightBackground } from '@/components/brand/CareSuiteLightBackground';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';

type CareLightScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
};

/** Light premium screen wrapper — replaces dark ScreenShell on main dashboards. */
export function CareLightScreen({ children, scroll = true, padded = true }: CareLightScreenProps) {
  const contentStyle = padded ? styles.padded : styles.unpadded;

  const content = scroll ? (
    <ScrollView contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <CareSuiteLightBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {content}
      </SafeAreaView>
    </CareSuiteLightBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  padded: {
    padding: careSpacing.md,
    gap: careSpacing.md,
    paddingBottom: careSpacing.xxl,
  },
  unpadded: {
    flexGrow: 1,
  },
});
