import { StyleSheet, Text, View } from 'react-native';
import { liquidTokens } from '../tokens';

export function RotateDeviceScreen() {
  return (
    <View style={styles.root} accessibilityRole="alert">
      <View style={styles.symbol}>
        <Text style={styles.symbolText}>↻</Text>
      </View>
      <Text style={styles.title}>Bitte Gerät drehen</Text>
      <Text style={styles.body}>
        CareSuite HealthOS wird auf dem Smartphone im Hochformat verwendet.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: liquidTokens.color.navy950,
  },
  symbol: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: liquidTokens.color.blue500,
  },
  symbolText: {
    color: liquidTokens.color.white,
    fontSize: 40,
  },
  title: {
    marginTop: 24,
    color: liquidTokens.color.white,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    color: liquidTokens.color.white64,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 480,
  },
});

