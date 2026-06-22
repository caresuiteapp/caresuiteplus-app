import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, SuccessState } from '@/components/ui';
import { confirmAction } from '@/lib/platform/confirmAction';
import type { ServiceResult } from '@/types';
import { colors, spacing, typography } from '@/theme';

type OfficeRecordDeleteButtonProps = {
  recordLabel: string;
  displayName: string;
  onDelete: () => Promise<ServiceResult<void>>;
  onDeleted?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  confirmTitle?: string;
  buttonTitle?: string;
};

export function OfficeRecordDeleteButton({
  recordLabel,
  displayName,
  onDelete,
  onDeleted,
  disabled = false,
  fullWidth = true,
  confirmTitle = 'Wirklich löschen?',
  buttonTitle = 'Löschen',
}: OfficeRecordDeleteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handlePress() {
    setError(null);
    const confirmed = await confirmAction({
      title: confirmTitle,
      message: `${displayName}\n\nDiese Aktion kann nicht rückgängig gemacht werden.`,
      confirmLabel: 'Löschen',
      cancelLabel: 'Abbrechen',
    });
    if (!confirmed) return;

    setLoading(true);
    const result = await onDelete();
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccessMessage(`${recordLabel} wurde gelöscht.`);
    onDeleted?.();
    setTimeout(() => setSuccessMessage(null), 2500);
  }

  return (
    <View style={styles.wrap}>
      {successMessage ? <SuccessState message={successMessage} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PremiumButton
        title={buttonTitle}
        variant="secondary"
        fullWidth={fullWidth}
        loading={loading}
        disabled={disabled || loading}
        onPress={handlePress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
