import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchOfficeAuditLog } from '@/lib/officeCore/auditLogService';
import { colors, spacing, typography } from '@/theme';

export function OfficeAuditLogScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchOfficeAuditLog(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const entries = query.data ?? [];

  if (query.loading && entries.length === 0) {
    return (
      <ScreenShell title="Audit-Log" subtitle="Office">
        <LoadingState message="Protokoll wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && entries.length === 0) {
    return (
      <ScreenShell title="Audit-Log" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Audit-Log" subtitle={`Office · ${roleLabel ?? 'Demo'}`} scroll={false}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <PremiumButton title="← Office-Übersicht" variant="ghost" onPress={() => router.push('/office' as never)} />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.icon}>{item.icon}</Text>
            <View style={styles.main}>
              <Text style={styles.title}>{item.action}</Text>
              <Text style={styles.sub}>{item.detail}</Text>
              <Text style={styles.time}>
                {new Date(item.timestamp).toLocaleString('de-DE')} · {item.actor}
              </Text>
            </View>
            <PremiumBadge label={item.category} variant="muted" />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState title="Keine Einträge" message="Das Audit-Log ist leer." />
        }
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  icon: { fontSize: 20, width: 28 },
  main: { flex: 1 },
  title: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  time: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
});
