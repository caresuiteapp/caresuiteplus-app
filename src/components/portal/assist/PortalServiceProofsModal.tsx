import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { PortalEmptyState } from '@/components/portal/assist/PortalEmptyState';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { createPortalRequest } from '@/lib/portal/assist/portalRequestService';
import {
  listPortalServiceProofs,
  resolvePortalServiceProofDownloadUrl,
  resolvePortalServiceProofStatusLabel,
} from '@/lib/portal/assist/portalServiceProofService';
import { subscribePortalProofCache } from '@/lib/portal/portalProofCacheSignal';
import type { PortalServiceProof } from '@/types/portal/serviceProofs';
import { LoadingState, PremiumButton } from '@/components/ui';

type PortalServiceProofsModalProps = {
  visible: boolean;
  tenantId: string;
  clientId: string;
  portalUserId?: string | null;
  onClose: () => void;
};

const STATUS_COLORS: Record<string, string> = {
  offen: '#FF9500',
  unterschrieben: '#34C759',
  abgerechnet: '#62F3FF',
};

/** Glass modal listing released Leistungsnachweise — no generic request form. */
export function PortalServiceProofsModal({
  visible,
  tenantId,
  clientId,
  portalUserId,
  onClose,
}: PortalServiceProofsModalProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const router = useRouter();

  const [proofs, setProofs] = useState<PortalServiceProof[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionProofId, setActionProofId] = useState<string | null>(null);

  const loadProofs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listPortalServiceProofs(tenantId, clientId);
    if (result.ok) {
      setProofs(result.data);
    } else {
      setError(result.error);
      setProofs([]);
    }
    setLoading(false);
  }, [tenantId, clientId]);

  useEffect(() => {
    if (visible) void loadProofs();
  }, [visible, loadProofs]);

  useEffect(() => {
    return subscribePortalProofCache(() => {
      if (visible) void loadProofs();
    });
  }, [visible, loadProofs]);

  const handleClose = () => {
    setActionProofId(null);
    onClose();
  };

  const handleViewPdf = async (proof: PortalServiceProof) => {
    setActionProofId(proof.id);
    const result = await resolvePortalServiceProofDownloadUrl(proof);
    setActionProofId(null);

    if (result.ok) {
      await Linking.openURL(result.data);
      return;
    }

    router.push(`/portal/client/documents/${proof.id}` as never);
  };

  const handleSign = (proof: PortalServiceProof) => {
    router.push(`/portal/client/documents/${proof.id}` as never);
    handleClose();
  };

  const handleInquiry = async () => {
    setActionProofId('inquiry');
    const result = await createPortalRequest({
      tenantId,
      clientId,
      portalUserId,
      moduleKey: 'assist',
      requestType: 'nachweise',
      title: 'Rückfrage zu Nachweisen',
      description: 'Bitte um Rückmeldung zu meinen Leistungsnachweisen.',
    });
    setActionProofId(null);
    if (!result.ok) {
      setError(result.error);
    }
  };

  return (
    <PortalGlassModal visible={visible} title="Nachweise" onClose={handleClose}>
      {loading ? <LoadingState message="Nachweise werden geladen…" /> : null}
      {error ? (
        <Text style={[type.caption, styles.error, { color: text.secondary }]}>{error}</Text>
      ) : null}

      {!loading && proofs.length === 0 ? (
        <PortalEmptyState message="Sobald ein Einsatz abgeschlossen wurde, erscheinen hier die freigegebenen Leistungsnachweise." />
      ) : null}

      {!loading && proofs.length > 0 ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {proofs.map((proof) => (
            <GlassCard key={proof.id} style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={[type.body, { color: text.primary, fontWeight: '600' }]} {...noBreakTextProps}>
                  {proof.title}
                </Text>
                <Text
                  style={[
                    type.caption,
                    styles.badge,
                    { color: STATUS_COLORS[proof.status] ?? text.muted },
                  ]}
                >
                  {resolvePortalServiceProofStatusLabel(proof.status)}
                </Text>
              </View>
              <Text style={[type.caption, { color: text.muted }]}>{proof.periodLabel}</Text>
              <View style={styles.itemActions}>
                <PremiumButton
                  title="PDF anzeigen"
                  size="sm"
                  variant="secondary"
                  loading={actionProofId === proof.id}
                  onPress={() => void handleViewPdf(proof)}
                />
                {proof.status === 'offen' && proof.signatureRequired ? (
                  <PremiumButton
                    title="Unterschreiben"
                    size="sm"
                    onPress={() => handleSign(proof)}
                  />
                ) : null}
              </View>
            </GlassCard>
          ))}
        </ScrollView>
      ) : null}

      <Pressable onPress={() => void handleInquiry()} style={styles.inquiryLink}>
        <Text style={[type.caption, { color: '#FF9500', fontWeight: '600' }]}>
          {actionProofId === 'inquiry' ? 'Wird gesendet…' : 'Rückfrage senden'}
        </Text>
      </Pressable>
    </PortalGlassModal>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 360,
  },
  listContent: {
    gap: careSpacing.sm,
  },
  item: {
    gap: careSpacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
  },
  badge: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  itemActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    marginTop: careSpacing.xs,
  },
  inquiryLink: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: careSpacing.xs,
  },
  error: {
    color: '#c0392b',
  },
});
