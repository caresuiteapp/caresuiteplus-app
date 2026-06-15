import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { TIAuditLogListHero } from '@/components/ti';
import { ErrorState, LoadingState, PremiumButton, PremiumCard, PremiumInput } from '@/components/ui';
import { useTIAuditLog } from '@/hooks/ti';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing, typography } from '@/theme';

function formatGermanDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE');
}

export function TIAuditLogScreen() {
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const {
    items,
    totalCount,
    filteredCount,
    loading,
    error,
    refresh,
    search,
    setSearch,
    exportLog,
    exportResult,
  } = useTIAuditLog();

  if (!can('ti.audit.view')) {
    return (
      <CareLightPageShell title="TI-Audit-Log">
        <LockedActionBanner message={check('ti.audit.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (loading && items.length === 0) {
    return (
      <CareLightPageShell title="TI-Audit-Log">
        <LoadingState message="Audit-Ereignisse werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (error && items.length === 0) {
    return (
      <CareLightPageShell title="TI-Audit-Log">
        <ErrorState message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="TI-Audit-Log"
      subtitle={`${filteredCount} Ereignisse`}
      scroll={false}
      rightSlot={<PremiumButton title="Export" size="sm" variant="ghost" onPress={exportLog} />}
    >
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <TIAuditLogListHero items={items} totalCount={totalCount} roleKey={roleKey} />
            <PremiumInput
              label="Suche"
              placeholder="Aktion, Akteur oder Details…"
              value={search}
              onChangeText={setSearch}
            />
            {exportResult ? <Text style={styles.exportMsg}>{exportResult}</Text> : null}
          </View>
        }
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.cyan} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <PremiumCard accentColor={colors.cyan}>
            <Text style={styles.action}>{item.action}</Text>
            <Text style={styles.meta}>
              {formatGermanDate(item.createdAt)} · {item.actorName}
            </Text>
            {item.details ? <Text style={styles.details}>{item.details}</Text> : null}
          </PremiumCard>
        )}
      />
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md, marginBottom: spacing.sm },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  action: { ...typography.bodyStrong },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  details: { ...typography.body, marginTop: spacing.xs },
  exportMsg: { ...typography.caption, color: colors.success, marginBottom: spacing.sm },
});
