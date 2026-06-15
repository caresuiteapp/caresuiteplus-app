import { StyleSheet, Text, View } from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { CareLightButton } from './CareLightButton';

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
  return (
    <View style={styles.root}>
      <Text style={styles.emoji}>📭</Text>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <CareLightButton title={actionLabel} onPress={onAction} accentColor={accentColor} variant="secondary" />
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
    color: careLightColors.navy,
    textAlign: 'center',
  },
  message: {
    ...careTypography.body,
    color: careLightColors.muted,
    textAlign: 'center',
  },
});
