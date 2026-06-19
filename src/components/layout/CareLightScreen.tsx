import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CareSuiteLightBackground } from '@/components/brand/CareSuiteLightBackground';
import { careSpacing } from '@/design/tokens/spacing';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';

type CareLightScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
};

/** Light premium screen wrapper — transparent passthrough when PlatformShell hosts Aurora. */
export function CareLightScreen({ children, scroll = true, padded = true }: CareLightScreenProps) {
  const shellHostsAurora = useShellHostsAurora();
  const contentStyle = padded ? styles.padded : styles.unpadded;

  const content = scroll ? (
    <ScrollView contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  if (shellHostsAurora) {
    return (
      <View style={styles.auroraRoot}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          {content}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <CareSuiteLightBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {content}
      </SafeAreaView>
    </CareSuiteLightBackground>
  );
}

const styles = StyleSheet.create({
  auroraRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
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
