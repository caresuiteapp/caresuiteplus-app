import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import Constants from 'expo-constants';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { employeePortalExecutionSurface } from '@/lib/portal/employeePortalExecutionSurface';
import { copyTextToClipboard } from '@/lib/platform/clipboard';
import { persistEmployeePortalExecutionIncident } from '@/lib/portal/employeePortalExecutionIncidentStore';
import { spacing, typography } from '@/theme';

type Props = {
  children: ReactNode;
  onExit: () => void;
  assignmentId?: string | null;
};

type State = {
  failed: boolean;
  reference: string | null;
  technicalMessage: string | null;
  technicalStack: string | null;
  copied: boolean;
};

function createReference(): string {
  return `EINSATZ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function runtimeLabel(): string {
  const runtime = Constants.expoConfig?.extra?.runtime as
    | { releaseId?: unknown; liveConfigured?: unknown }
    | undefined;
  const version = Constants.expoConfig?.version ?? 'unbekannt';
  const releaseId = typeof runtime?.releaseId === 'string' ? runtime.releaseId : 'unbekannt';
  const live = runtime?.liveConfigured === true ? 'Live-Konfiguration: aktiv' : 'Live-Konfiguration: fehlt';
  return `App ${version} · Build ${releaseId} · ${live}`;
}

export class EmployeePortalExecutionErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, reference: null, technicalMessage: null, technicalStack: null, copied: false };

  static getDerivedStateFromError(error: Error): State {
    return {
      failed: true,
      reference: createReference(),
      technicalMessage: error.message?.trim() || 'Unbekannter Darstellungsfehler',
      technicalStack: error.stack ?? null,
      copied: false,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[EmployeePortalExecution]', this.state.reference, error, info.componentStack);
    if (!this.state.reference) return;
    void persistEmployeePortalExecutionIncident({
      reference: this.state.reference,
      assignmentId: this.props.assignmentId?.trim() || null,
      message: error.message || 'Unbekannter Darstellungsfehler',
      stack: error.stack ?? null,
      componentStack: info.componentStack ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  private copyReference = async () => {
    if (!this.state.reference) return;
    const copied = await copyTextToClipboard(
      [
        this.state.reference,
        runtimeLabel(),
        this.props.assignmentId ? `Einsatz: ${this.props.assignmentId}` : null,
        this.state.technicalMessage ? `Fehler: ${this.state.technicalMessage}` : null,
        this.state.technicalStack ? `Stack:\n${this.state.technicalStack}` : null,
      ].filter(Boolean).join('\n'),
    );
    this.setState({ copied });
  };

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
          <Text style={styles.reference}>{runtimeLabel()}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.referenceButton}
            onPress={() => void this.copyReference()}
          >
            <Text style={styles.referenceButtonText}>
              {this.state.copied ? 'Fehlerreferenz kopiert' : 'Fehlerreferenz kopieren'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.primaryButton}
            onPress={() => this.setState({ failed: false, reference: null, technicalMessage: null, technicalStack: null, copied: false })}
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
  referenceButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  referenceButtonText: { ...typography.bodyStrong, color: '#075DC7' },
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
