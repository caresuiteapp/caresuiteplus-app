import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { employeePortalExecutionSurface } from '@/lib/portal/employeePortalExecutionSurface';
import { spacing, typography } from '@/theme';

type Props = {
  children: ReactNode;
  onExit: () => void;
};

type State = {
  failed: boolean;
  reference: string | null;
};

function createReference(): string {
  return `EINSATZ-${Date.now().toString(36).toUpperCase()}`;
}

export class EmployeePortalExecutionErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, reference: null };

  static getDerivedStateFromError(): State {
    return { failed: true, reference: createReference() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[EmployeePortalExecution]', this.state.reference, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.page} accessibilityRole="alert">
        <View style={styles.card}>
          <Text style={styles.title}>Der Einsatz bleibt gespeichert</Text>
          <Text style={styles.message}>
            Die Ansicht konnte nach dem Serverabgleich nicht vollständig aufgebaut werden. Ihre
            Unterschrift und Dokumentation gehen dadurch nicht verloren.
          </Text>
          <Text style={styles.reference}>Fehlerreferenz: {this.state.reference}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.primaryButton}
            onPress={() => this.setState({ failed: false, reference: null })}
          >
            <Text style={styles.primaryButtonText}>Einsatzansicht erneut aufbauen</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={this.props.onExit}>
            <Text style={styles.secondaryButtonText}>Zur Einsatzübersicht</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 420,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: employeePortalExecutionSurface.background,
  },
  card: {
    width: '100%',
    maxWidth: 680,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#8BC2FF',
    borderRadius: 22,
    backgroundColor: '#F8FBFF',
  },
  title: { ...typography.h3, color: '#10233E' },
  message: { ...typography.body, color: '#334E68' },
  reference: { ...typography.caption, color: '#64748B' },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#056CE8',
  },
  primaryButtonText: { ...typography.bodyStrong, color: '#FFFFFF', textAlign: 'center' },
  secondaryButton: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: '#8BC2FF',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: { ...typography.bodyStrong, color: '#075DC7', textAlign: 'center' },
});
