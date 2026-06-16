import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  buildReplacementSuggestions,
  detectRoutePlanningConflicts,
  listOpenAssignmentsForPlanning,
} from '@/lib/assist/routePlanningService';
import type { OpenAssignmentSummary, ReplacementSuggestion } from '@/types/modules/routePlanning';
import { colors, spacing, typography } from '@/theme';

export function ToursReplacementScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? 'dispatch';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openAssignments, setOpenAssignments] = useState<OpenAssignmentSummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ReplacementSuggestion[]>([]);
  const [conflictCount, setConflictCount] = useState(0);

  const load = useCallback(async () => {
    if (!tenantId) {
      setError('Kein Mandant.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const open = listOpenAssignmentsForPlanning(tenantId, roleKey);
    if (!open.ok) {
      setError(open.error);
      setLoading(false);
      return;
    }
    setOpenAssignments(open.data);
    setLoading(false);
  }, [tenantId, roleKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExpand = async (assignmentId: string) => {
    if (!tenantId) return;
    if (expandedId === assignmentId) {
      setExpandedId(null);
      setSuggestions([]);
      return;
    }
    setExpandedId(assignmentId);
    const conflictResult = detectRoutePlanningConflicts(tenantId, assignmentId, roleKey);
    if (conflictResult.ok) {
      setConflictCount(conflictResult.data.length);
    }
    const suggestionResult = buildReplacementSuggestions(tenantId, assignmentId, roleKey);
    if (suggestionResult.ok) {
      setSuggestions(suggestionResult.data);
    } else {
      setSuggestions([]);
    }
  };

  if (loading) {
    return (
      <ScreenShell title="Touren & Vertretung" subtitle="Dienstplan">
        <LoadingState message="Planungsdaten werden geladen…" />
      </ScreenShell>
    );
  }

  if (error) {
    return (
      <ScreenShell title="Touren & Vertretung" subtitle="Dienstplan">
        <ErrorState title="Planung" message={error} onRetry={load} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Touren & Vertretung" subtitle="Dienstplan · Offene Einsätze & Vertretung" scroll={false}>
      <FlatList
        data={openAssignments}
        keyExtractor={(item) => item.assignmentId}
        ListEmptyComponent={
          <EmptyState
            title="Keine offenen Einsätze"
            message="Alle Einsätze sind zugewiesen oder es liegen keine Planungsdaten vor."
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.hint}>
              Fahrzeiten sind Plausibilitätswerte. Änderungen erfordern Bestätigung.
            </Text>
            <Pressable onPress={() => router.push('/assist/calendar' as never)}>
              <Text style={styles.link}>Zum Kalender / Dienstplan</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => void handleExpand(item.assignmentId)}>
            <PremiumCard style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>{item.locationAddress || '— Adresse fehlt —'}</Text>
              <Text style={styles.meta}>
                {new Date(item.plannedStartAt).toLocaleString('de-DE')} · {item.serviceType}
              </Text>
              <View style={styles.badges}>
                {item.conflictCount > 0 ? (
                  <PremiumBadge label={`${item.conflictCount} Konflikt(e)`} variant="orange" />
                ) : (
                  <PremiumBadge label="Offen" variant="cyan" />
                )}
              </View>
              {expandedId === item.assignmentId && (
                <View style={styles.expanded}>
                  <Text style={styles.sectionTitle}>
                    Vertretungsvorschläge ({suggestions.length})
                  </Text>
                  {conflictCount > 0 && (
                    <Text style={styles.warn}>{conflictCount} Konflikt(e) erkannt</Text>
                  )}
                  {suggestions.length === 0 ? (
                    <Text style={styles.meta}>Keine qualifizierten Vertretungen verfügbar.</Text>
                  ) : (
                    suggestions.slice(0, 3).map((s) => (
                      <Text key={s.id} style={styles.suggestion}>
                        {s.suggestedEmployeeId} · Score {s.score} · {s.travelTimeMinutes ?? '—'} Min.
                      </Text>
                    ))
                  )}
                </View>
              )}
            </PremiumCard>
          </Pressable>
        )}
        contentContainerStyle={styles.list}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md, gap: spacing.xs },
  hint: { ...typography.caption, color: colors.textSecondary },
  link: { ...typography.caption, color: colors.primary },
  list: { paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  badges: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  expanded: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.sm },
  sectionTitle: { ...typography.caption, fontWeight: '600', marginBottom: spacing.xs },
  warn: { ...typography.caption, color: colors.warning, marginBottom: spacing.xs },
  suggestion: { ...typography.caption, marginBottom: spacing.xs },
});
