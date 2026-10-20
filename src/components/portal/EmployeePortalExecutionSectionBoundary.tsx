import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { persistEmployeePortalExecutionIncident } from '@/lib/portal/employeePortalExecutionIncidentStore';
import { spacing, typography } from '@/theme';

type Props = { assignmentId: string; section: string; children: ReactNode };
type State = { error: Error | null; retry: number };

export class EmployeePortalExecutionSectionBoundary extends Component<Props, State> {
  state: State = { error: null, retry: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const reference = `EINSATZ-ABSCHNITT-${Date.now().toString(36).toUpperCase()}`;
    console.error('[EmployeePortalExecutionSection]', this.props.section, error, info.componentStack);
    void persistEmployeePortalExecutionIncident({
      reference,
      assignmentId: this.props.assignmentId,
      message: `${this.props.section}: ${error.message || 'Unbekannter Abschnittsfehler'}`,
      stack: error.stack ?? null,
      componentStack: info.componentStack ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.title}>{this.props.section} vorübergehend nicht verfügbar</Text>
        <Text style={styles.copy}>Der übrige Einsatz bleibt bedienbar; gespeicherte Daten bleiben erhalten.</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => this.setState((state) => ({ error: null, retry: state.retry + 1 }))}
        >
          <Text style={styles.buttonText}>Abschnitt erneut laden</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: '#F59E0B', borderRadius: 16, backgroundColor: '#FFFBEB' },
  title: { ...typography.bodyStrong, color: '#78350F' },
  copy: { ...typography.caption, color: '#92400E' },
  button: { alignSelf: 'flex-start', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  buttonText: { ...typography.bodyStrong, color: '#075DC7' },
});
