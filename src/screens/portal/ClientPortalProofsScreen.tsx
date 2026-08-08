import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import { GlassCard } from '@/design/components/GlassCard';
import { PORTAL_LIGHT_LINK_ORANGE, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalActor } from '@/hooks/usePortalActor';
import { createPortalRequest } from '@/lib/portal/assist/portalRequestService';
import {
  listPortalServiceProofs,
  resolvePortalServiceProofDownloadUrl,
  resolvePortalServiceProofStatusLabel,
} from '@/lib/portal/assist/portalServiceProofService';
import { subscribePortalProofCache } from '@/lib/portal/portalProofCacheSignal';
import type { PortalServiceProof } from '@/types/portal/serviceProofs';
import { ErrorState, LoadingState, CareLightButton } from '@/components/ui';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';

const STATUS_COLORS: Record<string, string> = {
  offen: PORTAL_LIGHT_LINK_ORANGE,
  unterschrieben: '#34C759',
  abgerechnet: '#62F3FF',
};

/** Full-screen Leistungsnachweise — PDF, Status, Historie (K.1.2). */
export function ClientPortalProofsScreen() {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const {
    tenantId,
    clientId,
    actorId,
    isLinkedReady,
    isResolvingClientLink,
  } = usePortalActor();

  const [proofs, setProofs] = useState<PortalServiceProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionProofId, setActionProofId] = useState<string | null>(null);

  const loadProofs = useCallback(async () => {
    if (isResolvingClientLink) return;
    if (!tenantId || !clientId || !isLinkedReady) {
      setProofs([]);
      setError(
        'Ihr Klient:innenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.',
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await listPortalServiceProofs(tenantId, clientId);
    if (result.ok) {
      setProofs(result.data);
    } else {
      setError(
        toPortalUserFacingError(
          result.error,
          'Ihre Nachweise konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
        ),
      );
      setProofs([]);
    }
    setLoading(false);
  }, [tenantId, clientId, isLinkedReady, isResolvingClientLink]);

  useEffect(() => {
    void loadProofs();
  }, [loadProofs]);

  useEffect(() => subscribePortalProofCache(() => void loadProofs()), [loadProofs]);

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
  };

  const handleInquiry = async () => {
    if (!tenantId || !clientId) return;
    setActionProofId('inquiry');
    const result = await createPortalRequest({
      tenantId,
      clientId,
      portalUserId: actorId,
      moduleKey: 'assist',
      requestType: 'nachweise',
      title: 'Rückfrage zu Nachweisen',
      description: 'Bitte um Rückmeldung zu meinen Leistungsnachweisen.',
    });
    setActionProofId(null);
    if (!result.ok) {
      setError(
        toPortalUserFacingError(
          result.error,
          'Ihre Rückfrage konnte gerade nicht gesendet werden. Bitte versuchen Sie es erneut.',
        ),
      );
    }
  };

  return (
    <PortalTabScreen title="Nachweise" hideHeaderOnPhone scroll={false}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <PortalGlassHero
          title="Leistungsnachweise"
          subtitle="Freigegebene Nachweise mit PDF, Status und Historie"
          showStatusDot
        />

        {loading || isResolvingClientLink ? <LoadingState message="Nachweise werden geladen…" /> : null}
        {error ? <ErrorState title="Nachweise" message={error} onRetry={loadProofs} /> : null}

        {!loading && !isResolvingClientLink && !error && proofs.length === 0 ? (
          <ClientPortalGuide
            compact
            title="Noch keine Leistungsnachweise"
            message="Sobald ein Einsatz abgeschlossen und für Sie bereitgestellt wurde, erscheint der Nachweis automatisch hier."
          />
        ) : null}

        {!loading && !isResolvingClientLink && proofs.length > 0 ? (
          <View style={styles.list}>
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
                  <CareLightButton
                    title="PDF anzeigen"
                    variant="secondary"
                    loading={actionProofId === proof.id}
                    onPress={() => void handleViewPdf(proof)}
                  />
                  {proof.status === 'offen' && proof.signatureRequired ? (
                    <CareLightButton title="Unterschreiben" onPress={() => handleSign(proof)} />
                  ) : null}
                </View>
              </GlassCard>
            ))}
          </View>
        ) : null}

        <Pressable onPress={() => void handleInquiry()} style={styles.inquiryLink}>
          <Text style={[type.caption, { color: PORTAL_LIGHT_LINK_ORANGE, fontWeight: '600' }]}>
            {actionProofId === 'inquiry' ? 'Wird gesendet…' : 'Rückfrage senden'}
          </Text>
        </Pressable>
      </ScrollView>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.md,
    paddingBottom: careSpacing.xxl,
  },
  list: {
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
});
