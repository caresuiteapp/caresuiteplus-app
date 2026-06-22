import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useMemo, useState } from 'react';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumCard, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchQmAudits } from '@/lib/qm/qmAuditService';
import { colors, spacing, typography } from '@/theme';

export function QmAuditsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const [search, setSearch] = useState('');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmAudits(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = query.data ?? [];
    if (!q) return rows;
    return rows.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.auditType.toLowerCase().includes(q) ||
        a.auditorName.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  if (!can('qm.view')) {
    return (
      <ScreenShell title="Audits" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Audits" showBack>
        <LoadingState message="Audits werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Audits" showBack>
        <ErrorState title="Audits" message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Audits" subtitle={`${items.length} Audits`} showBack>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={query.loading} onRefresh={query.refresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.scroll}
      >
        <PremiumInput label="Audit suchen" value={search} onChangeText={setSearch} placeholder="Titel, Typ, Prüfer…" />
        {items.length === 0 ? (
          <EmptyState title="Keine Audits" message={search ? 'Kein Treffer.' : 'Derzeit keine geplanten Audits.'} />
        ) : (
          items.map((a) => (
            <PremiumCard key={a.id} accentColor={colors.cyan}>
              <Text style={styles.title}>{a.title}</Text>
              <Text style={styles.meta}>{a.auditType} · {a.status}</Text>
              <Text style={styles.date}>
                {new Date(a.scheduledAt).toLocaleDateString('de-DE')} · {a.auditorName}
              </Text>
              {a.findingsCount > 0 ? (
                <Text style={styles.findings}>{a.findingsCount} Feststellungen</Text>
              ) : null}
            </PremiumCard>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted },
  date: { ...typography.caption, color: colors.textMuted },
  findings: { ...typography.caption, color: colors.orange, marginTop: spacing.xs },
});
