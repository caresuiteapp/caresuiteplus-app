import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';

type CareSuiteLoadingIndicatorProps = { width?: number };

/** A bounded, light loading mark; its spinner never rotates around the wordmark. */
export function CareSuiteLoadingIndicator({ width = 280 }: CareSuiteLoadingIndicatorProps) {
  const reducedMotion = usePrefersReducedMotion();
  const boundedWidth = Math.max(120, Math.min(Number.isFinite(width) ? width : 280, 360));
  return (
    <View
      accessibilityLabel="CareSuite HealthOS wird geladen"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={[styles.stage, { width: boundedWidth }]}
      testID="caresuite-loading-indicator"
    >
      <Text style={[styles.wordmark, { fontSize: Math.min(26, boundedWidth / 10) }]}>
        CareSuite <Text style={styles.brandAccent}>HealthOS</Text>
      </Text>
      <View style={styles.spinnerFrame} testID="caresuite-loading-motion">
        {reducedMotion ? (
          <View style={styles.staticRing} testID="caresuite-loading-reduced-motion" />
        ) : (
          <ActivityIndicator size="large" color="#0876E8" accessibilityElementsHidden />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    maxWidth: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingVertical: 12,
    gap: 20,
  },
  wordmark: { color: '#123251', fontWeight: '800', textAlign: 'center', letterSpacing: -0.6 },
  brandAccent: { color: '#0876E8' },
  spinnerFrame: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  staticRing: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: '#B8D8FC', borderTopColor: '#0876E8' },
});
