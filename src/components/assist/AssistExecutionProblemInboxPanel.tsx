import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import {
  fetchAssistExecutionProblems,
  type AssistExecutionProblemItem,
} from '@/lib/assist/assistExecutionProblemInboxService';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { spacing, typography } from '@/theme';

function ProblemInboxShell({
  count,
  state = 'neutral',
  children,
}: {
  count: number | string;
  state?: 'neutral' | 'healthy' | 'warning';
  children: ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>QUALITÄT & BLOCKER</Text>
          <Text style={styles.heading}>Problem-Inbox</Text>
          <Text style={styles.subtitle}>Offene Punkte aus Dokumentation, Nachweisen und Zeitkonto</Text>
        </View>
        <View style={[styles.countBadge, state === 'healthy' && styles.countHealthy, state === 'warning' && styles.countWarning]}>
          <Text style={[styles.countText, state === 'healthy' && styles.countTextHealthy, state === 'warning' && styles.countTextWarning]}>{count}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

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
      <ProblemInboxShell count="…">
        <View style={styles.stateBox}>
          <View style={styles.loadingPulse} />
          <View style={styles.stateCopy}>
            <Text style={styles.stateTitle}>Problem-Inbox wird geprüft</Text>
            <Text style={styles.muted}>Offene Einsatz-Blocker werden geladen.</Text>
          </View>
        </View>
      </ProblemInboxShell>
    );
  }

  if (error) {
    return (
      <ProblemInboxShell count="!" state="warning">
        <View style={[styles.stateBox, styles.stateBoxWarning]}>
          <View style={styles.warningIcon}><Text style={styles.warningIconText}>!</Text></View>
          <View style={styles.stateCopy}>
            <Text style={styles.stateTitle}>Prüfung derzeit nicht vollständig</Text>
            <Text style={styles.error}>{error}</Text>
          </View>
        </View>
      </ProblemInboxShell>
    );
  }

  if (items.length === 0) {
    return (
      <ProblemInboxShell count="0 offen" state="healthy">
        <View style={[styles.stateBox, styles.stateBoxHealthy]}>
          <View style={styles.healthyIcon}><Text style={styles.healthyIconText}>✓</Text></View>
          <View style={styles.stateCopy}>
            <Text style={styles.stateTitle}>Alle Prüfbereiche sind unauffällig</Text>
            <Text style={styles.muted}>Keine offenen Blocker in Dokumentation, Signatur, Nachweis, Budget oder Zeitkonto.</Text>
          </View>
        </View>
      </ProblemInboxShell>
    );
  }

  return (
    <ProblemInboxShell count={`${items.length} offen`} state="warning">
      <View style={styles.list}>
        {items.map((item, index) => (
          <View key={`${item.code}-${item.assignmentId}`} style={styles.row}>
            <View style={styles.rowIndex}><Text style={styles.rowIndexText}>{String(index + 1).padStart(2, '0')}</Text></View>
            <View style={styles.rowCopy}>
              <Text style={styles.label}>{item.title}</Text>
              <Text style={styles.error}>{item.message}</Text>
            </View>
            <View style={styles.priorityBadge}><Text style={styles.priorityText}>PRÜFEN</Text></View>
          </View>
        ))}
      </View>
    </ProblemInboxShell>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(121,213,255,0.34)', backgroundColor: 'rgba(5,28,55,0.94)', padding: 16, gap: 14, overflow: 'hidden' },
  header: { minHeight: 57, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#6DDFFF', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.5 },
  heading: { color: '#FFFFFF', fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#91ADC5', fontSize: 10, lineHeight: 14, marginTop: 2 },
  countBadge: { minHeight: 32, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(102,220,255,0.34)', backgroundColor: 'rgba(44,164,224,0.18)', alignItems: 'center', justifyContent: 'center' },
  countHealthy: { borderColor: 'rgba(72,225,177,0.36)', backgroundColor: 'rgba(7,104,79,0.34)' },
  countWarning: { borderColor: 'rgba(255,185,77,0.4)', backgroundColor: 'rgba(108,64,7,0.4)' },
  countText: { color: '#7DE6FF', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  countTextHealthy: { color: '#78EBC5' },
  countTextWarning: { color: '#FFC466' },
  stateBox: { minHeight: 92, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(111,204,245,0.18)', backgroundColor: 'rgba(2,17,36,0.62)', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  stateBoxHealthy: { borderColor: 'rgba(72,225,177,0.24)', backgroundColor: 'rgba(4,66,55,0.28)' },
  stateBoxWarning: { borderColor: 'rgba(255,185,77,0.28)', backgroundColor: 'rgba(85,50,4,0.28)' },
  stateCopy: { flex: 1, minWidth: 0 },
  stateTitle: { color: '#FFFFFF', fontSize: 14, lineHeight: 19, fontWeight: '900' },
  muted: { ...typography.caption, color: '#A8BFD2', lineHeight: 18, marginTop: 3 },
  error: { ...typography.caption, color: '#FFC574', lineHeight: 18, marginTop: 3 },
  loadingPulse: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#176F9E', borderWidth: 5, borderColor: 'rgba(102,222,255,0.3)' },
  warningIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(255,183,70,0.18)', alignItems: 'center', justifyContent: 'center' },
  warningIconText: { color: '#FFC466', fontSize: 18, fontWeight: '900' },
  healthyIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(66,222,174,0.16)', borderWidth: 1, borderColor: 'rgba(75,228,181,0.34)', alignItems: 'center', justifyContent: 'center' },
  healthyIconText: { color: '#6DE7BE', fontSize: 18, fontWeight: '900' },
  list: { gap: spacing.sm },
  row: { minHeight: 78, borderRadius: 17, borderWidth: 1, borderColor: '#D4E5F3', backgroundColor: '#F7FBFF', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIndex: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E5F5FF', borderWidth: 1, borderColor: '#B9DFF5', alignItems: 'center', justifyContent: 'center' },
  rowIndexText: { color: '#087FC3', fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  rowCopy: { flex: 1, minWidth: 0 },
  label: { ...typography.bodyStrong, color: '#0B233D', fontSize: 13, lineHeight: 18 },
  priorityBadge: { minHeight: 27, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1, borderColor: '#EFB24E', backgroundColor: '#FFF4D9', alignItems: 'center', justifyContent: 'center' },
  priorityText: { color: '#9D5D00', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
});
