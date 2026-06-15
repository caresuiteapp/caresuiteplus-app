import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/ui';
import { QmApprovalPanel, QmDocumentDetailHero, QmReadConfirmationPanel, QmVersionTimeline } from '@/components/qm';
import { useQmDocumentDetail } from '@/hooks/qm';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { approveQmDocument } from '@/lib/qm';
import { colors, spacing, typography } from '@/theme';

export function QmDocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can, check, isReadOnly, roleLabel } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { document, versions, confirmations, loading, error, refresh } = useQmDocumentDetail(id ?? '');
  const [approving, setApproving] = useState(false);

  const handleApprove = useCallback(async () => {
    if (!tenantId || !id) return;
    setApproving(true);
    await approveQmDocument(tenantId, id, profile?.displayName ?? 'QMB', profile?.roleKey);
    await refresh();
    setApproving(false);
  }, [tenantId, id, profile, refresh]);

  if (!can('qm.view')) {
    return (
      <CareLightPageShell title="Dokument" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (loading && !document) {
    return (
      <CareLightPageShell title="Dokument" showBack>
        <LoadingState message="Dokument wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (error && !document) {
    return (
      <CareLightPageShell title="Dokument" showBack>
        <ErrorState title="Dokument" message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  const currentVersion = versions[0];

  return (
    <CareLightPageShell title={document!.title} subtitle={document!.documentNumber} showBack>
      <ScrollView contentContainerStyle={styles.scroll}>
        <QmDocumentDetailHero
          document={document!}
          currentVersion={currentVersion}
          versionCount={versions.length}
          confirmationCount={confirmations.length}
          roleKey={roleKey}
          isReadOnly={isReadOnly}
        />
        {currentVersion && <Text style={styles.content}>{currentVersion.content}</Text>}
        <QmApprovalPanel
          document={document!}
          canApprove={can('qm.approve_document')}
          onApprove={handleApprove}
          loading={approving}
        />
        <QmVersionTimeline versions={versions} />
        <QmReadConfirmationPanel confirmations={confirmations} />
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  content: { ...typography.body, color: colors.textSecondary },
});
