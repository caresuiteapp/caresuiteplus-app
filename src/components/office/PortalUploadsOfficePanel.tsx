import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useAuth } from '@/lib/auth/context';
import {
  approvePortalUpload,
  listPendingPortalUploads,
  rejectPortalUpload,
} from '@/lib/portal/assist/portalDocumentUploadService';
import { PORTAL_UPLOAD_STATUS_LABELS, type PortalUpload } from '@/types/portal/uploads';
import { ErrorState, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';

type PortalUploadsOfficePanelProps = {
  tenantId: string;
  clientId?: string;
};

/** Office: review pending portal document uploads — approve into Akte or reject. */
export function PortalUploadsOfficePanel({ tenantId, clientId }: PortalUploadsOfficePanelProps) {
  const { profile } = useAuth();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  const [uploads, setUploads] = useState<PortalUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listPendingPortalUploads(tenantId, { clientId, limit: 10 });
    setLoading(false);
    if (result.ok) {
      setUploads(result.data);
    } else {
      setError(result.error);
      setUploads([]);
    }
  }, [tenantId, clientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleApprove(upload: PortalUpload) {
    setWorkingId(upload.id);
    setError(null);
    const result = await approvePortalUpload({
      tenantId,
      uploadId: upload.id,
      reviewedBy: profile?.id ?? null,
      title: upload.fileName.replace(/\.[^.]+$/, ''),
      category: upload.category ?? 'sonstige',
      portalVisible: true,
    });
    setWorkingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refresh();
  }

  async function handleReject(upload: PortalUpload) {
    setWorkingId(upload.id);
    setError(null);
    const result = await rejectPortalUpload({
      tenantId,
      uploadId: upload.id,
      reviewedBy: profile?.id ?? null,
      reviewNote: rejectNote[upload.id] ?? null,
    });
    setWorkingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refresh();
  }

  if (loading && uploads.length === 0) {
    return <LoadingState message="Portal-Uploads werden geladen…" />;
  }

  return (
    <View style={styles.container}>
      {error ? <ErrorState title="Portal-Uploads" message={error} onRetry={() => void refresh()} /> : null}
      {uploads.length === 0 ? (
        <GlassCard>
          <Text style={[type.body, { color: text.secondary }]}>Keine ausstehenden Portal-Uploads.</Text>
        </GlassCard>
      ) : (
        uploads.map((upload) => (
          <GlassCard key={upload.id}>
            <Text style={[type.body, { color: text.primary, fontWeight: '600' }]} {...noBreakTextProps}>
              {upload.fileName}
            </Text>
            <Text style={[type.caption, { color: text.muted }]}>
              {PORTAL_UPLOAD_STATUS_LABELS[upload.status]}
              {upload.uploadContext === 'mitarbeiter'
                ? ` · Mitarbeitendenakte${upload.employeeName ? ` · ${upload.employeeName}` : ''}`
                : ' · Klient:innenakte'}
              {upload.category ? ` · ${upload.category}` : ''}
            </Text>
            {upload.message ? (
              <Text style={[type.caption, { color: text.secondary }]}>{upload.message}</Text>
            ) : null}
            <View style={styles.actions}>
              <PremiumButton
                title={workingId === upload.id ? 'Speichern…' : 'Prüfen und in Akte übernehmen'}
                onPress={() => void handleApprove(upload)}
                disabled={workingId !== null}
              />
              <PremiumInput
                label="Ablehnungsgrund (optional)"
                value={rejectNote[upload.id] ?? ''}
                onChangeText={(value) =>
                  setRejectNote((prev) => ({ ...prev, [upload.id]: value }))
                }
              />
              <PremiumButton
                title="Ablehnen"
                variant="secondary"
                onPress={() => void handleReject(upload)}
                disabled={workingId !== null}
              />
            </View>
          </GlassCard>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.sm,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  actions: {
    gap: careSpacing.sm,
    marginTop: careSpacing.sm,
  },
});
