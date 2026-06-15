import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { QmDocumentCard, QmDocumentsListHero } from '@/components/qm';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useQmDocuments } from '@/hooks/qm';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing } from '@/theme';

export function QmDocumentsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { data, loading, error, refresh } = useQmDocuments();

  if (!can('qm.view')) {
    return (
      <CareLightPageShell title="QM-Dokumente" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (loading && !data) {
    return (
      <CareLightPageShell title="QM-Dokumente" showBack>
        <LoadingState message="Dokumente werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (error && !data) {
    return (
      <CareLightPageShell title="QM-Dokumente" showBack>
        <ErrorState title="Dokumente" message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  const items = data ?? [];

  return (
    <CareLightPageShell title="QM-Dokumente" subtitle={`${items.length} Dokumente`} showBack>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        <QmDocumentsListHero documents={items} roleKey={roleKey} />
        {items.length === 0 ? (
          <EmptyState title="Keine Dokumente" message="Noch keine QM-Dokumente vorhanden." />
        ) : (
          items.map((doc) => (
            <QmDocumentCard
              key={doc.id}
              document={doc}
              onPress={() => router.push(`/business/office/qm/documents/${doc.id}` as never)}
            />
          ))
        )}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({ scroll: { gap: spacing.md, paddingBottom: spacing.xxl } });
