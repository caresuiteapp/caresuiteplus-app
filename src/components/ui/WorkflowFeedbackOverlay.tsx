import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CareSuiteLoadingIndicator } from '@/components/brand/CareSuiteLoadingIndicator';
import { careSpacing } from '@/design/tokens/spacing';
import { spatialCare } from '@/design/tokens/spatialCareSuite';
import { typography } from '@/theme';

export type WorkflowFeedbackKind = 'success' | 'error' | 'warning' | 'info';

type Props = {
  message?: string | null;
  title?: string;
  kind?: WorkflowFeedbackKind;
  loading?: boolean;
  loadingMessage?: string;
  onDismiss?: () => void;
  autoDismissMs?: number | null;
  testID?: string;
};

const feedbackMeta: Record<WorkflowFeedbackKind, { icon: string; title: string; color: string }> = {
  success: { icon: '✓', title: 'Erfolgreich', color: '#48C98A' },
  error: { icon: '!', title: 'Fehler', color: '#F26C78' },
  warning: { icon: '!', title: 'Hinweis', color: '#F2B35E' },
  info: { icon: 'i', title: 'Information', color: '#69E8FF' },
};

export function WorkflowFeedbackOverlay({
  message,
  title,
  kind = 'info',
  loading = false,
  loadingMessage = 'Vorgang wird ausgeführt…',
  onDismiss,
  autoDismissMs = null,
  testID = 'workflow-feedback-overlay',
}: Props) {
  const [messageVisible, setMessageVisible] = useState(Boolean(message));
  const visible = loading || (messageVisible && Boolean(message));
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    setMessageVisible(Boolean(message));
  }, [kind, message]);

  useEffect(() => {
    if (!message || loading || !autoDismissMs) return;
    const timer = setTimeout(() => {
      setMessageVisible(false);
      onDismissRef.current?.();
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, kind, loading, message]);

  const dismiss = () => {
    if (loading) return;
    setMessageVisible(false);
    onDismissRef.current?.();
  };

  const meta = feedbackMeta[kind];
  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={loading ? undefined : dismiss}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        accessibilityRole="alert"
        accessibilityViewIsModal
        style={styles.viewport}
        testID={testID}
      >
        <View style={[styles.backdrop, loading && styles.loadingBackdrop]} />
        <View style={[styles.dialog, { borderColor: meta.color }]}>
          {loading ? (
            <View style={styles.loadingContent}>
              <CareSuiteLoadingIndicator width={240} />
              <Text style={styles.loadingTitle}>CareSuite lädt</Text>
              <Text style={styles.message}>{loadingMessage}</Text>
              <Text style={styles.wait}>Bitte warten und diese Seite nicht schließen.</Text>
            </View>
          ) : (
            <>
              <View style={styles.heading}>
                <View style={[styles.icon, { backgroundColor: meta.color }]}>
                  <Text style={styles.iconText}>{meta.icon}</Text>
                </View>
                <View style={styles.headingText}>
                  <Text style={styles.title}>{title ?? meta.title}</Text>
                  <Text style={styles.message}>{message}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Meldung schließen"
                  accessibilityRole="button"
                  onPress={dismiss}
                  style={styles.close}
                >
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>
              <Pressable accessibilityRole="button" onPress={dismiss} style={styles.action}>
                <Text style={styles.actionText}>Schließen</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: careSpacing.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 7, 22, 0.54)',
  },
  loadingBackdrop: { backgroundColor: 'rgba(5, 7, 22, 0.72)' },
  dialog: {
    width: '100%',
    maxWidth: 560,
    borderWidth: 1,
    borderRadius: spatialCare.radius.card,
    backgroundColor: 'rgba(31, 32, 58, 0.98)',
    padding: careSpacing.lg,
    gap: careSpacing.lg,
    shadowColor: '#050716',
    shadowOpacity: 0.45,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 },
    elevation: 24,
  },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: careSpacing.md },
  headingText: { flex: 1, minWidth: 0, gap: careSpacing.xs },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: '#0D1022', fontSize: 21, fontWeight: '900' },
  title: { ...typography.h3, color: spatialCare.textOnNight },
  message: { ...typography.body, color: spatialCare.textOnNight, lineHeight: 24 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: spatialCare.border,
  },
  closeText: { color: spatialCare.textOnNight, fontSize: 26, lineHeight: 28 },
  action: {
    minHeight: 48,
    borderRadius: spatialCare.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: spatialCare.border,
  },
  actionText: { ...typography.body, color: spatialCare.textOnNight, fontWeight: '800' },
  loadingContent: { alignItems: 'center', gap: careSpacing.sm, paddingVertical: careSpacing.md },
  loadingTitle: { ...typography.h2, color: spatialCare.textOnNight, textAlign: 'center' },
  wait: { ...typography.caption, color: spatialCare.textOnNightMuted, textAlign: 'center' },
});
