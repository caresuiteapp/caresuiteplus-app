import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { PremiumButton } from './PremiumButton';

type CareLightErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export function CareLightErrorState({ message, onRetry }: CareLightErrorStateProps) {
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
          color: c.danger,
        },
        message: {
          ...careTypography.body,
          color: c.muted,
          textAlign: 'center',
        },
      }),
    [c.danger, c.muted],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={styles.title}>Fehler</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <PremiumButton title="Erneut versuchen" onPress={onRetry} />
      ) : null}
    </View>
  );
}
