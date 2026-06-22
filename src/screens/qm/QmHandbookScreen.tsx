import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumInput } from '@/components/ui';
import { QmChapterTree, QmHandbookHero } from '@/components/qm';
import { buildQmHandbookKpis } from '@/data/demo/qmHandbookStats';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchQmChapters, fetchQmHandbook } from '@/lib/qm/qmHandbookService';
import { colors, spacing } from '@/theme';

export function QmHandbookScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, isReadOnly, roleLabel } = usePermissions();
  const [search, setSearch] = useState('');
  const roleKey = profile?.roleKey ?? 'business_admin';

  const handbookQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmHandbook(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const chaptersQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmChapters(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const chapters = chaptersQuery.data ?? [];
  const filteredChapters = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter((ch) => ch.title.toLowerCase().includes(q));
  }, [chapters, search]);
  const kpis = useMemo(
    () => buildQmHandbookKpis(chapters, handbookQuery.data ?? null),
    [chapters, handbookQuery.data],
  );
  const loading = handbookQuery.loading || chaptersQuery.loading;
  const error = handbookQuery.error ?? chaptersQuery.error;

  const refresh = async () => {
    await Promise.all([handbookQuery.refresh(), chaptersQuery.refresh()]);
  };

  if (!can('qm.view')) {
    return (
      <ScreenShell title="QM-Handbuch" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && chapters.length === 0) {
    return (
      <ScreenShell title="QM-Handbuch" showBack>
        <LoadingState message="Handbuch wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && chapters.length === 0) {
    return (
      <ScreenShell title="QM-Handbuch" showBack>
        <ErrorState title="Handbuch" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="QM-Handbuch"
      subtitle={`${isReadOnly ? 'Lesemodus · ' : ''}${roleLabel ?? 'QM'}`}
      showBack
      scroll={false}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.hero}>
          <QmHandbookHero
            kpis={kpis}
            roleKey={roleKey}
            handbookTitle={handbookQuery.data?.title}
            handbookVersion={handbookQuery.data?.version}
            chapterCount={chapters.length}
            isReadOnly={isReadOnly}
          />
        </View>
        <PremiumInput label="Kapitel suchen" value={search} onChangeText={setSearch} placeholder="Titel…" />
        {filteredChapters.length === 0 ? (
          <EmptyState title="Keine Kapitel" message={search ? 'Kein Treffer — Suche anpassen.' : 'Handbuch ist leer.'} />
        ) : (
          <QmChapterTree
            chapters={filteredChapters}
            onSelect={(ch) => router.push(`/business/office/qm/handbook/${ch.id}` as never)}
          />
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { marginBottom: spacing.sm },
});
