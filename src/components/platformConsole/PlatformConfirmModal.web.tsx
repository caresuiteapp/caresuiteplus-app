import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { careSuiteModalScrim } from '@/design/tokens/lightTheme';
import { PLATFORM_COLORS } from './PlatformColors';
import { spacing } from '@/theme';

type PlatformConfirmModalProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  requireTypedConfirmation?: string;
  requireReason?: boolean;
  danger?: boolean;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export function PlatformConfirmModal({
  visible,
  title,
  description,
  confirmLabel = 'Bestätigen',
  requireTypedConfirmation,
  requireReason = true,
  danger = false,
  loading = false,
  error,
  onCancel,
  onConfirm,
}: PlatformConfirmModalProps) {
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const lock = useRef(false);
  useEffect(() => { if (!visible) { setReason(''); setTyped(''); lock.current = false; } }, [visible]);
  useEffect(() => { if (!loading) lock.current = false; }, [loading]);

  const canConfirm = useMemo(() => {
    if (requireReason && reason.trim().length < 5) return false;
    if (requireTypedConfirmation && typed.trim() !== requireTypedConfirmation) return false;
    return true;
  }, [reason, requireReason, requireTypedConfirmation, typed]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: careSuiteModalScrim,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        },
        card: {
          width: '100%',
          maxWidth: 600,
          maxHeight: '100%',
          minHeight: 0,
          backgroundColor: PLATFORM_COLORS.panel,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: danger ? PLATFORM_COLORS.danger : PLATFORM_COLORS.border,
          padding: spacing.lg,
          gap: spacing.md,
        },
        title: { color: PLATFORM_COLORS.text, fontSize: 23, lineHeight: 30, fontWeight: '700' },
        desc: { color: PLATFORM_COLORS.muted, fontSize: 14, lineHeight: 20 },
        label: { color: PLATFORM_COLORS.muted, fontSize: 15, lineHeight: 22, marginBottom: 4 },
        input: {
          borderWidth: 1,
          borderColor: PLATFORM_COLORS.border,
          borderRadius: 8,
          paddingHorizontal: spacing.sm,
          paddingVertical: 10,
          color: PLATFORM_COLORS.text,
          backgroundColor: '#FFFFFF',
          fontSize: 16, lineHeight: 24, minHeight: 48,
        },
        actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm },
      }),
    [danger],
  );

  function handleConfirm() {
    if (!canConfirm || loading || lock.current) return;
    lock.current = true;
    onConfirm(reason.trim());
  }

  function handleCancel() {
    if (loading) return;
    setReason('');
    setTyped('');
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <ScrollView style={{ minHeight: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.desc}>{description}</Text>
          {error ? <Text accessibilityRole="alert" style={{ color: "#942A24", fontSize: 15, lineHeight: 23 }}>{error}</Text> : null}
          {requireReason ? (
            <View>
              <Text style={styles.label}>Grund (Pflicht)</Text>
              <TextInput
                style={styles.input}
                editable={!loading}
                accessibilityLabel="Grund der Änderung"
                value={reason}
                onChangeText={setReason}
                placeholder="Warum wird diese Aktion durchgeführt?"
                placeholderTextColor={PLATFORM_COLORS.muted}
                multiline
              />
            </View>
          ) : null}
          {requireTypedConfirmation ? (
            <View>
              <Text style={styles.label}>Zur Bestätigung „{requireTypedConfirmation}" eingeben</Text>
              <TextInput
                style={styles.input}
                editable={!loading}
                accessibilityLabel="Bestätigungstext"
                value={typed}
                onChangeText={setTyped}
                placeholder={requireTypedConfirmation}
                placeholderTextColor={PLATFORM_COLORS.muted}
                autoCapitalize="characters"
              />
            </View>
          ) : null}
          </ScrollView>
          <View style={styles.actions}>
            <PremiumButton title="Abbrechen" variant="secondary" onPress={handleCancel} disabled={loading} />
            <PremiumButton
              title={confirmLabel}
              variant="primary"
              onPress={handleConfirm}
              disabled={!canConfirm || loading}
              loading={loading}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
