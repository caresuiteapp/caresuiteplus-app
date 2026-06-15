import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { QmStatusBadge } from '@/components/qm';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchQmChapter } from '@/lib/qm/qmHandbookService';
import { colors, spacing, typography } from '@/theme';

export function QmHandbookChapterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!id) return Promise.resolve({ ok: false as const, error: 'Keine Kapitel-ID.' });
      return fetchQmChapter(tenantId, id, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );

  if (!can('qm.view')) {
    return (
      <CareLightPageShell title="Kapitel" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="Kapitel" showBack>
        <LoadingState message="Kapitel wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="Kapitel" showBack>
        <ErrorState title="Kapitel" message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  const chapter = query.data;
  if (!chapter) {
    return (
      <CareLightPageShell title="Kapitel" showBack>
        <EmptyState title="Kapitel nicht gefunden" message="Das Kapitel existiert nicht im Demo-Handbuch." />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title={chapter.title} subtitle={`Version ${chapter.version}`} showBack>
      <ScrollView contentContainerStyle={styles.scroll}>
        <QmStatusBadge kind="document" status={chapter.status} />
        {chapter.content?.trim() ? (
          <Text style={styles.content}>{chapter.content}</Text>
        ) : (
          <EmptyState title="Kein Inhalt" message="Für dieses Kapitel ist noch kein Text hinterlegt." />
        )}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  content: { ...typography.body, color: colors.textSecondary },
});
