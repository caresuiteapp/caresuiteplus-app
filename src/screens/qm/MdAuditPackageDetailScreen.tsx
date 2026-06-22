import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { ErrorState, EmptyState, LoadingState } from '@/components/ui';
import { MdAccessLogCard, MdDocumentSelector, MdPackageBuilder, MdQrCodeCard } from '@/components/qm';
import { useMdAuditPackageDetail, useQmDocuments } from '@/hooks/qm';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  approveMdAuditPackage,
  confirmMdPackageDatenschutz,
  fetchMdAuditPackage,
  generateMdShareToken,
  revokeMdShareToken,
  selectMdPackageDocuments,
} from '@/lib/qm';
import { qmDemoRepository } from '@/lib/qm/qmRepository.demo';
import { colors, spacing, typography } from '@/theme';

export function MdAuditPackageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can, check, roleLabel } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { pkg, items, accessLogs, loading, error, refresh } = useMdAuditPackageDetail(id ?? '');
  const { data: documents } = useQmDocuments();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggleDoc = useCallback((docId: string) => {
    setSelectedIds((prev) =>
      prev.includes(docId) ? prev.filter((x) => x !== docId) : [...prev, docId],
    );
  }, []);

  const handleSelectDocs = useCallback(async () => {
    if (!tenantId || !id || selectedIds.length === 0) return;
    setBusy(true);
    await selectMdPackageDocuments(tenantId, id, selectedIds, profile?.roleKey);
    await refresh();
    setBusy(false);
  }, [tenantId, id, selectedIds, profile, refresh]);

  const handleDatenschutz = useCallback(async () => {
    if (!tenantId || !id) return;
    setBusy(true);
    await confirmMdPackageDatenschutz(tenantId, id, profile?.roleKey);
    await refresh();
    setBusy(false);
  }, [tenantId, id, profile, refresh]);

  const handleApprove = useCallback(async () => {
    if (!tenantId || !id) return;
    setBusy(true);
    await approveMdAuditPackage(tenantId, id, profile?.displayName ?? 'PDL', profile?.roleKey);
    await refresh();
    setBusy(false);
  }, [tenantId, id, profile, refresh]);

  const handleShare = useCallback(async () => {
    if (!tenantId || !id) return;
    setBusy(true);
    await generateMdShareToken(tenantId, id, 90, profile?.roleKey);
    await refresh();
    setBusy(false);
  }, [tenantId, id, profile, refresh]);

  const handleRevoke = useCallback(async () => {
    if (!tenantId || !pkg?.shareTokenId) return;
    setBusy(true);
    await revokeMdShareToken(tenantId, pkg.shareTokenId, profile?.roleKey);
    await refresh();
    setBusy(false);
  }, [tenantId, pkg, profile, refresh]);

  if (!can('qm.view')) {
    return (
      <ScreenShell title="MD-Mappe" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  if (loading && !pkg) {
    return (
      <ScreenShell title="MD-Mappe" showBack>
        <LoadingState message="Mappe wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !pkg) {
    return (
      <ScreenShell title="MD-Mappe" showBack>
        <ErrorState title="MD-Mappe" message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  if (!pkg) {
    return (
      <ScreenShell title="MD-Mappe" showBack>
        <EmptyState title="Mappe nicht gefunden" message="Die MD-Prüfungsmappe existiert nicht." />
      </ScreenShell>
    );
  }

  const shareToken = pkg?.shareTokenId
    ? qmDemoRepository.getStore().mdShareTokens.find((t) => t.id === pkg.shareTokenId)
    : null;

  return (
    <ScreenShell title={pkg!.title} subtitle={`Status: ${pkg!.status}`} showBack>
      <ScrollView contentContainerStyle={styles.scroll}>
        <MdPackageBuilder
          pkg={pkg!}
          items={items}
          canApprove={can('qm.approve_md_package')}
          canShare={can('qm.share_md_package')}
          onConfirmDatenschutz={handleDatenschutz}
          onApprove={handleApprove}
          onShare={handleShare}
          loading={busy}
        />

        {pkg!.status === 'draft' && documents && (
          <>
            <Text style={styles.section}>Dokumente auswählen</Text>
            <MdDocumentSelector
              documents={documents}
              selectedIds={selectedIds}
              onToggle={toggleDoc}
            />
            {selectedIds.length > 0 && can('qm.create_md_package') && (
              <Text style={styles.hint} onPress={handleSelectDocs}>
                {busy ? 'Speichern…' : `${selectedIds.length} Dokumente übernehmen`}
              </Text>
            )}
          </>
        )}

        {shareToken && <MdQrCodeCard token={shareToken} />}
        {can('qm.revoke_md_package') && shareToken && !shareToken.revokedAt && (
          <Text style={styles.revoke} onPress={handleRevoke}>
            Freigabe widerrufen
          </Text>
        )}

        {can('qm.view_md_access_logs') ? (
          accessLogs.length > 0 ? (
            <MdAccessLogCard logs={accessLogs} />
          ) : (
            <EmptyState title="Keine Zugriffslogs" message="Noch keine MD-Freigabe protokolliert." />
          )
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  section: { ...typography.bodyStrong },
  hint: { ...typography.body, color: colors.cyan, textAlign: 'center' },
  revoke: { ...typography.body, color: colors.danger, textAlign: 'center' },
});
