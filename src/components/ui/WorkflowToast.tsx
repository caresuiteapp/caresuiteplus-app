import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

export function WorkflowToast({ message, kind = 'success', onDismiss }: {
  message: string | null;
  kind?: 'success' | 'error';
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(Boolean(message));
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return;
    const timer = setTimeout(() => { setVisible(false); onDismissRef.current?.(); }, 5000);
    return () => clearTimeout(timer);
  }, [kind, message]);
  if (!visible || !message) return null;
  return (
    <View pointerEvents="box-none" style={styles.host}>
      <View style={[styles.toast, kind === 'error' && styles.error]}>
        <Text style={styles.icon}>{kind === 'error' ? '!' : '✓'}</Text>
        <Text numberOfLines={1} style={styles.text}>{message}</Text>
        <Pressable onPress={() => { setVisible(false); onDismiss?.(); }} accessibilityLabel="Meldung schließen"><Text style={styles.close}>×</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: spacing.sm, left: spacing.md, right: spacing.md, zIndex: 1000, alignItems: 'center' },
  toast: { maxWidth: 720, width: '100%', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 10, backgroundColor: colors.success },
  error: { backgroundColor: colors.danger },
  icon: { color: '#fff', fontWeight: '800' }, text: { ...typography.body, color: '#fff', flex: 1 }, close: { color: '#fff', fontSize: 22 },
});
