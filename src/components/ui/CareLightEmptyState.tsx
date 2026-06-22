import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { PremiumButton } from './PremiumButton';

type CareLightEmptyStateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  accentColor?: string;
};

export function CareLightEmptyState({
  title,
  message,
  actionLabel,
  onAction,
  accentColor,
}: CareLightEmptyStateProps) {
  const { c } = useCareLightPalette();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          alignItems: 'center',
          gap: careSpacing.sm,
          paddingVertical: careSpacing.lg,
        },
        emoji: {
          fontSize: 36,
        },
        title: {
          ...careTypography.bodyStrong,
          color: c.text,
          textAlign: 'center',
        },
        message: {
          ...careTypography.body,
          color: c.muted,
          textAlign: 'center',
        },
      }),
    [c.muted, c.text],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.emoji}>📭</Text>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <PremiumButton title={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}
