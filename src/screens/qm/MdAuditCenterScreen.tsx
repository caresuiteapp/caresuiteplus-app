import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { MdAuditCenterHero } from '@/components/qm';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumCard, PremiumInput } from '@/components/ui';
import { QmStatusBadge } from '@/components/qm';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createMdAuditPackage, fetchMdAuditPackages } from '@/lib/qm/mdAuditPackageService';
import { colors, spacing, typography } from '@/theme';

export function MdAuditCenterScreen() {
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchMdAuditPackages(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = query.data ?? [];
    if (!q) return rows;
    return rows.filter((pkg) => pkg.title.toLowerCase().includes(q) || String(pkg.inspectionYear).includes(q));
  }, [query.data, search]);

  const handleCreate = useCallback(async () => {
    if (!tenantId) return;
    setCreating(true);
    const result = await createMdAuditPackage(
      tenantId,
      { title: `MD-Prüfungsmappe ${new Date().getFullYear()}`, inspectionYear: new Date().getFullYear() },
      profile?.roleKey,
    );
    setCreating(false);
    if (result.ok) {
      await query.refresh();
      router.push(`/business/office/qm/md-audit/${result.data.id}` as never);
    }
  }, [tenantId, profile?.roleKey, query, router]);

  if (!can('qm.view')) {
    return (
      <ScreenShell title="MD-Prüfung" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="MD-Prüfung" showBack>
        <LoadingState message="MD-Mappen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="MD-Prüfung" showBack>
        <ErrorState title="MD-Prüfung" message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const openCount = items.filter(
    (pkg) => pkg.status !== 'exported' && pkg.status !== 'shared' && pkg.status !== 'revoked',
  ).length;
  const roleKey = profile?.roleKey ?? 'business_admin';

  return (
    <ScreenShell title="MD-Prüfungszentrum" subtitle={`${items.length} Mappen`} showBack>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={query.loading} onRefresh={query.refresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.scroll}
      >
        <MdAuditCenterHero packageCount={items.length} openCount={openCount} roleKey={roleKey} />
        <PremiumInput label="Mappe suchen" value={search} onChangeText={setSearch} placeholder="Titel oder Prüfjahr…" />
        {can('qm.create_md_package') ? (
          <PremiumButton title="Neue MD-Prüfungsmappe" onPress={handleCreate} loading={creating} fullWidth />
        ) : null}
        {items.length === 0 ? (
          <EmptyState title="Keine MD-Mappen" message={search ? 'Kein Treffer.' : 'Erstellen Sie eine neue Prüfungsmappe.'} />
        ) : (
          items.map((pkg) => (
            <PremiumCard
              key={pkg.id}
              accentColor={colors.violet}
              onPress={() => router.push(`/business/office/qm/md-audit/${pkg.id}` as never)}
            >
              <Text style={styles.title}>{pkg.title}</Text>
              <QmStatusBadge kind="md_package" status={pkg.status} />
              <Text style={styles.year}>Prüfjahr {pkg.inspectionYear}</Text>
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
  year: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
