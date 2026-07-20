import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/theme';
import { PLATFORM_COLORS } from './PlatformColors';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

type Props = { children: ReactNode };
type State = { error: Error | null; incidentId: string | null };

function incidentId(): string {
  return `PLT-${Date.now().toString(36).toUpperCase()}`;
}

export class PlatformErrorBoundary extends Component<Props, State> {
  state: State = { error: null, incidentId: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, incidentId: incidentId() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PlatformConsole]', this.state.incidentId, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap} accessibilityRole="alert">
        <View style={styles.icon}><Text style={styles.iconText}>!</Text></View>
        <Text style={styles.title}>Diese Platform-Seite konnte nicht geladen werden</Text>
        <Text style={styles.message}>
          Die Navigation bleibt verfügbar. Laden Sie nur diesen Bereich neu oder öffnen Sie eine andere Seite.
        </Text>
        <Text style={styles.incident}>Fehlerreferenz: {this.state.incidentId}</Text>
        <Pressable
          style={styles.button}
          onPress={() => this.setState({ error: null, incidentId: null })}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Bereich erneut laden</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    maxWidth: 720,
    marginHorizontal: 'auto',
    marginVertical: spacing.xl,
    padding: spacing.xl,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: systemLiquidGlass.panelStrong,
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
  },
  iconText: { color: '#B91C1C', fontSize: 24, fontWeight: '800' },
  title: { color: PLATFORM_COLORS.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  message: { color: PLATFORM_COLORS.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  incident: { color: PLATFORM_COLORS.muted, fontSize: 11 },
  button: {
    marginTop: spacing.sm,
    borderRadius: 10,
    backgroundColor: PLATFORM_COLORS.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
});
