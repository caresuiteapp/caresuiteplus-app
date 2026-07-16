import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PlatformShellLayout, PlatformTenantPicker, PLATFORM_COLORS } from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import { listPlatformAuditLog } from '@/lib/platformConsole';
import type { PlatformAuditEntry } from '@/types/platformConsole';
import { spacing } from '@/theme';

export function PlatformAuditScreen() {
  const params = useLocalSearchParams<{ tenantId?: string; action?: string }>();
  const [items, setItems] = useState<PlatformAuditEntry[]>([]);
  const [tenantFilter, setTenantFilter] = useState(params.tenantId ?? '');
  const [actionFilter, setActionFilter] = useState(params.action ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listPlatformAuditLog({
      limit: 100,
      tenantId: tenantFilter.trim() || undefined,
      action: actionFilter.trim() || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setItems(result.data.items);
    setLoading(false);
  }, [actionFilter, tenantFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PlatformShellLayout title="Audit Log" subtitle="Unveränderliche Protokollierung aller Plattformaktionen">
      <View style={styles.filters}>
        <View style={styles.tenantFilter}>
          <PlatformTenantPicker value={tenantFilter} onChange={setTenantFilter} label="Mandant filtern" allowAll />
        </View>
        <TextInput
          style={styles.input}
          value={actionFilter}
          onChangeText={setActionFilter}
          placeholder="Action Filter"
          placeholderTextColor={PLATFORM_COLORS.muted}
          onSubmitEditing={() => void load()}
        />
      </View>
      {loading ? (
        <LoadingState message="Audit wird geladen…" />
      ) : error ? (
        <ErrorState title="Audit nicht verfügbar" message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((entry) => (
            <View key={entry.id} style={styles.row}>
              <Text style={styles.action}>{entry.action}</Text>
              <Text style={styles.meta}>
                {new Date(entry.created_at).toLocaleString('de-DE')} · {entry.actor_role ?? '—'}
                {entry.tenant_id ? ` · ${entry.tenant_id.slice(0, 8)}…` : ''}
              </Text>
              {entry.reason ? <Text style={styles.reason}>Grund: {entry.reason}</Text> : null}
            </View>
          ))}
          <Text style={styles.immutable}>Audit-Einträge sind read-only und nicht editierbar.</Text>
        </ScrollView>
      )}
    </PlatformShellLayout>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tenantFilter: { flex: 1 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    color: PLATFORM_COLORS.text,
    backgroundColor: PLATFORM_COLORS.panel,
  },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: {
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    padding: spacing.md,
    gap: 4,
  },
  action: { color: PLATFORM_COLORS.text, fontWeight: '600' },
  meta: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  reason: { color: PLATFORM_COLORS.muted, fontSize: 12, fontStyle: 'italic' },
  immutable: { color: PLATFORM_COLORS.muted, fontSize: 11, marginTop: spacing.md, fontStyle: 'italic' },
});
