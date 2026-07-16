import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  onCancel,
  onConfirm,
}: PlatformConfirmModalProps) {
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');

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
          maxWidth: 520,
          backgroundColor: PLATFORM_COLORS.panel,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: danger ? PLATFORM_COLORS.danger : PLATFORM_COLORS.border,
          padding: spacing.lg,
          gap: spacing.md,
        },
        title: { color: PLATFORM_COLORS.text, fontSize: 18, fontWeight: '700' },
        desc: { color: PLATFORM_COLORS.muted, fontSize: 14, lineHeight: 20 },
        label: { color: PLATFORM_COLORS.muted, fontSize: 12, marginBottom: 4 },
        input: {
          borderWidth: 1,
          borderColor: PLATFORM_COLORS.border,
          borderRadius: 8,
          paddingHorizontal: spacing.sm,
          paddingVertical: 10,
          color: PLATFORM_COLORS.text,
          backgroundColor: PLATFORM_COLORS.bg,
        },
        actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
      }),
    [danger],
  );

  function handleConfirm() {
    if (!canConfirm || loading) return;
    onConfirm(reason.trim());
    setReason('');
    setTyped('');
  }

  function handleCancel() {
    setReason('');
    setTyped('');
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.desc}>{description}</Text>
          {requireReason ? (
            <View>
              <Text style={styles.label}>Grund (Pflicht)</Text>
              <TextInput
                style={styles.input}
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
                value={typed}
                onChangeText={setTyped}
                placeholder={requireTypedConfirmation}
                placeholderTextColor={PLATFORM_COLORS.muted}
                autoCapitalize="characters"
              />
            </View>
          ) : null}
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
