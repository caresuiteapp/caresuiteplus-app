import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

type CommunicationConsentWarningProps = { message: string };

export function CommunicationConsentWarning({ message }: CommunicationConsentWarningProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.md,
    backgroundColor: colors.bgPanel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderCyan,
  },
  text: { ...typography.body, color: colors.cyan },
});
