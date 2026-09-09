import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CareSignatureCanvas } from '@/components/inputs/CareSignatureCanvas.web';
import { PremiumButton } from '@/components/ui';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import { useWebVisualViewport } from '@/hooks/useWebVisualViewport.web';

type Props = {
  visible: boolean;
  label: string;
  onConfirm: (dataUrl: string) => void | Promise<unknown>;
  onClose: () => void;
  disabled?: boolean;
  closeDisabled?: boolean;
  statusMessage?: string | null;
  onCheckStatus?: () => void;
  dismissScope?: string;
  forceFullscreen?: boolean;
};

/** One stable writing surface across desktop, tablet, orientation and viewport changes. */
export function CareSignatureModal({ visible, label, onConfirm, onClose, disabled = false,
  closeDisabled, statusMessage, onCheckStatus, dismissScope = 'signature' }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const viewport = useWebVisualViewport();
  const height = viewport.height ?? windowHeight;
  const width = viewport.width ?? windowWidth;
  const offsetTop = viewport.offsetTop ?? 0;
  const offsetLeft = viewport.offsetLeft ?? 0;
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const busy = submitting || (closeDisabled ?? disabled);
  const confirmLeave = useUnsavedWebChanges(visible && dirty, visible && busy,
    'Die gezeichnete Unterschrift ist noch nicht bestätigt. Möchten Sie die Zeichnung verwerfen und das Fenster schließen?');
  const requestClose = useCallback(async () => {
    if (busy || submittingRef.current) return;
    if (await confirmLeave()) onClose();
  }, [busy, confirmLeave, onClose]);
  useEffect(() => { if (!visible) { setDirty(false); setError(null); } }, [visible, dismissScope]);
  const confirm = async (dataUrl: string) => {
    if (disabled || submittingRef.current) return;
    submittingRef.current = true; setSubmitting(true); setError(null);
    try { await onConfirm(dataUrl); }
    catch { setError('Die Speicherung konnte nicht bestätigt werden. Die Zeichnung bleibt erhalten. Bitte erneut versuchen.'); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };
  const feedback = error ?? statusMessage ?? (submitting ? 'Unterschrift wird übertragen. Bitte das Fenster geöffnet lassen.' : null);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => void requestClose()}>
      <View
        style={[
          styles.viewport,
          { height, width, top: offsetTop, left: offsetLeft },
        ]}
        accessibilityViewIsModal
      >
        <View style={[styles.sheet, { height: Math.max(420, height) }]}>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>Unterschrift</Text>
              <Text style={styles.hint}>{label} · Bitte innerhalb der weißen Fläche unterschreiben.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Unterschrift schließen"
              accessibilityState={{ disabled: busy }} disabled={busy}
              onPress={() => void requestClose()} style={[styles.close, busy && styles.disabled]}>
              <Text style={styles.closeLabel}>×</Text>
            </Pressable>
          </View>
          {feedback ? <View style={styles.feedback}>
            <Text accessibilityRole="alert" style={styles.hint}>{feedback}</Text>
            {onCheckStatus ? <PremiumButton title="Status erneut prüfen" variant="secondary" onPress={onCheckStatus} disabled={submitting} /> : null}
          </View> : null}
          <View style={styles.canvas}>
            <CareSignatureCanvas key={dismissScope} size="large" fillAvailable actionLayout="bar"
              showLabel={false} disabled={disabled || submitting} onDirtyChange={setDirty}
              onConfirm={(dataUrl) => void confirm(dataUrl)} onCancel={() => void requestClose()} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  viewport: {
    position: 'fixed',
    zIndex: 2147483000,
    overflow: 'scroll',
    backgroundColor: '#f3f7fc',
  },
  sheet: { width: '100%', maxWidth: 1600, alignSelf: 'center', padding: 12, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, flexShrink: 0 },
  heading: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: font(24), lineHeight: font(30), fontWeight: '800', color: '#102d4c' },
  hint: { fontSize: font(15), lineHeight: font(22), color: '#365570' },
  close: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: '#accbea', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  closeLabel: { fontSize: font(28), color: '#102d4c' },
  disabled: { opacity: 0.45 },
  feedback: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#e2efff', flexShrink: 0 },
  canvas: { flex: 1, minHeight: 200, minWidth: 0 },
});
