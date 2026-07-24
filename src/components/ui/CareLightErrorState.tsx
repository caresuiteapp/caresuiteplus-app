import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';
import { colors } from '@/theme';
import { PremiumButton } from './PremiumButton';

type CareLightErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export function CareLightErrorState({ message, onRetry }: CareLightErrorStateProps) {
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
          color: colors.danger,
        },
        message: {
          ...careTypography.body,
          color: systemLiquidGlass.text.secondary,
          textAlign: 'center',
        },
      }),
    [],
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
