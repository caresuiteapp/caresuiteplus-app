import { StyleSheet, Text, View } from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { CareLightButton } from './CareLightButton';

type CareLightErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export function CareLightErrorState({ message, onRetry }: CareLightErrorStateProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={styles.title}>Fehler</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <CareLightButton title="Erneut versuchen" onPress={onRetry} accentColor={careLightColors.danger} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: careLightColors.danger,
  },
  message: {
    ...careTypography.body,
    color: careLightColors.muted,
    textAlign: 'center',
  },
});
