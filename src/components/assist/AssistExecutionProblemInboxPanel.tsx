import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { SectionPanel } from '@/components/ui/SectionPanel';
import {
  fetchAssistExecutionProblems,
  type AssistExecutionProblemItem,
} from '@/lib/assist/assistExecutionProblemInboxService';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { colors, spacing, typography } from '@/theme';

export function AssistExecutionProblemInboxPanel() {
  const tenantId = useServiceTenantId();
  const [items, setItems] = useState<AssistExecutionProblemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    const result = await fetchAssistExecutionProblems(tenantId, 20);
    if (!result.ok) {
      setError(result.error ?? 'Blocker konnten nicht geladen werden.');
      setItems([]);
    } else {
      setItems(result.data);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <SectionPanel title="Problem-Inbox" subtitle="Einsatz-Blocker">
        <Text style={styles.body}>Lade…</Text>
      </SectionPanel>
    );
  }

  if (error) {
    return (
      <SectionPanel title="Problem-Inbox" subtitle="Einsatz-Blocker">
        <Text style={styles.error}>{error}</Text>
      </SectionPanel>
    );
  }

  if (items.length === 0) {
    return (
      <SectionPanel title="Problem-Inbox" subtitle="Keine offenen Einsatz-Blocker">
        <Text style={styles.muted}>
          Keine offenen Einsatz-Blocker in Doku, Signatur, Nachweis, Budget oder Zeitkonto.
        </Text>
      </SectionPanel>
    );
  }

  return (
    <SectionPanel title="Problem-Inbox" subtitle={`${items.length} Einsatz-Blocker`}>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={`${item.code}-${item.assignmentId}`} style={styles.row}>
            <Text style={styles.label}>{item.title}</Text>
            <Text style={styles.error}>{item.message}</Text>
          </View>
        ))}
      </View>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { gap: 4 },
  body: { ...typography.body, color: colors.textPrimary },
  label: { ...typography.bodyStrong, color: colors.textPrimary },
  error: { ...typography.caption, color: colors.amber },
  muted: { ...typography.caption, color: colors.textMuted },
});
