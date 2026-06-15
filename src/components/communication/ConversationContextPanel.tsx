import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import type { CommunicationThread } from '@/features/communication/communication.types';

type ConversationContextPanelProps = { thread: CommunicationThread };

export function ConversationContextPanel({ thread }: ConversationContextPanelProps) {
  const rows = [
    thread.clientId ? `Klient:in: ${thread.clientId}` : null,
    thread.employeeId ? `Mitarbeiter:in: ${thread.employeeId}` : null,
    thread.assignmentId ? `Einsatz: ${thread.assignmentId}` : null,
    thread.documentId ? `Dokument: ${thread.documentId}` : null,
    thread.invoiceId ? `Rechnung: ${thread.invoiceId}` : null,
    thread.moduleKey ? `Modul: ${thread.moduleKey}` : null,
  ].filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Kontext</Text>
      {rows.map((row) => (
        <Text key={row} style={styles.row}>
          {row}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.bgPanel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderCyan,
  },
  title: { ...typography.caption, color: colors.cyan, fontWeight: '600' },
  row: { ...typography.caption, color: colors.textSecondary },
});
