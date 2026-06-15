import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  compact?: boolean;
};

export function TISecurityNotice({ compact = false }: Props) {
  return (
    <View style={[styles.notice, compact && styles.compact]} accessibilityRole="text">
      <Text style={styles.title}>🔒 TI-Sicherheitshinweis</Text>
      {!compact ? (
        <>
          <Text style={styles.line}>• Keine Secrets im Frontend — nur vault:-Referenzen</Text>
          <Text style={styles.line}>• Provider-Aufrufe ausschließlich serverseitig (Edge Functions)</Text>
          <Text style={styles.line}>• OCR/KI-Vorschläge erfordern manuelle Bestätigung</Text>
          <Text style={styles.line}>• Alle sicherheitsrelevanten Aktionen werden protokolliert</Text>
        </>
      ) : (
        <Text style={styles.line}>Provider-Secrets nur als vault:-Referenz. Manuelle Bestätigung bei Import.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: 'rgba(98, 243, 255, 0.08)',
    borderColor: colors.cyan,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  compact: { padding: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.cyan },
  line: { ...typography.caption, color: colors.textSecondary },
});
