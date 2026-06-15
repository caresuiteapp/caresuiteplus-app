import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '@/components/ui';
import type { MdAccessLogEntry } from '@/lib/qm';
import { colors, spacing, typography } from '@/theme';

type Props = { logs: MdAccessLogEntry[] };

export function MdAccessLogCard({ logs }: Props) {
  return (
    <PremiumCard accentColor={colors.cyan}>
      <Text style={styles.title}>Zugriffsprotokoll ({logs.length})</Text>
      {logs.length === 0 ? (
        <Text style={styles.empty}>Keine Zugriffe protokolliert.</Text>
      ) : (
        logs.map((log) => (
          <View key={log.id} style={styles.row}>
            <Text style={log.success ? styles.ok : styles.fail}>
              {log.success ? '✓' : '✗'} {new Date(log.accessedAt).toLocaleString('de-DE')}
            </Text>
            <Text style={styles.reason}>{log.reason ?? log.userAgent ?? '—'}</Text>
          </View>
        ))
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong, marginBottom: spacing.sm },
  empty: { ...typography.caption, color: colors.textMuted },
  row: { paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  ok: { ...typography.body, color: colors.success },
  fail: { ...typography.body, color: colors.orange },
  reason: { ...typography.caption, color: colors.textMuted },
});
