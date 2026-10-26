import { ClientCareProofPanel } from '@/components/pflege/PortalCarePanels';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import { GlassCard } from '@/design/components/GlassCard';
import { PORTAL_LIGHT_LINK_ORANGE, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalActor, type PortalActor } from '@/hooks/usePortalActor';
import { familyPortalAllows } from '@/lib/portal/familyPortalAccessScope';
import { isUnreleasedModuleKey } from '@/lib/modules/constants';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { createPortalRequest } from '@/lib/portal/assist/portalRequestService';
import {
  listPortalServiceProofs,
  resolvePortalServiceProofDownloadUrl,
  resolvePortalServiceProofStatusLabel,
} from '@/lib/portal/assist/portalServiceProofService';
import { subscribePortalProofCache } from '@/lib/portal/portalProofCacheSignal';
import type { PortalServiceProof } from '@/types/portal/serviceProofs';
import { ErrorState, LoadingState, SuccessState, CareLightButton } from '@/components/ui';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';

const STATUS_COLORS: Record<string, string> = {
  offen: PORTAL_LIGHT_LINK_ORANGE,
  unterschrieben: '#167248',
  abgerechnet: '#245A96',
};

/** Full-screen Leistungsnachweise — PDF, Status, Historie (K.1.2). */
export function ClientPortalProofsScreen() {
  const actor = usePortalActor();
  const scope = JSON.stringify([actor.tenantId, actor.actorId, actor.roleKey, actor.clientId, actor.familyAccess?.permissions]);
  return <ClientPortalProofsContent key={scope} actor={actor} />;
}

function ClientPortalProofsContent({ actor }: { actor: PortalActor }) {
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
    roleKey,
    familyAccess,
  } = actor;
  const proofsAllowed = roleKey !== 'family_portal' || familyPortalAllows(familyAccess, 'service_records');
  const downloadAllowed = roleKey !== 'family_portal' || familyPortalAllows(familyAccess, 'download_documents');
  const signAllowed = roleKey !== 'family_portal' || familyPortalAllows(familyAccess, 'sign_records');
  const inquiryAllowed = roleKey !== 'family_portal' || familyPortalAllows(familyAccess, 'send_messages');

  const [actionProofId, setActionProofId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [inquirySent, setInquirySent] = useState(false);
  const actionLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const query = useAsyncQuery(
    () => listPortalServiceProofs(tenantId!, clientId!),
    [tenantId, clientId, actorId, roleKey],
    { enabled: isLinkedReady && !!tenantId && !!clientId && proofsAllowed,
      queryKey: JSON.stringify([tenantId, actorId, roleKey, clientId, proofsAllowed]) },
  );
  const proofs = query.data ?? [];
  const loading = query.loading;
  const queryError = query.error ?? query.refreshError;
  const error = !isResolvingClientLink && !isLinkedReady
    ? 'Ihr Klient:innenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.'
    : queryError ? toPortalUserFacingError(queryError, 'Ihre Nachweise konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.') : null;
  const loadProofs = query.refresh;

  useEffect(() => subscribePortalProofCache(() => void loadProofs()), [loadProofs]);

  const handleViewPdf = async (proof: PortalServiceProof) => {
    if (actionLock.current || !downloadAllowed) return;
    actionLock.current = true;
    setActionProofId(proof.id);
    setActionError(null);
    try {
      const result = await resolvePortalServiceProofDownloadUrl(proof);
      if (!mounted.current) return;
      if (result.ok) {
        await Linking.openURL(result.data);
      } else {
        router.push(`/portal/client/documents/${encodeURIComponent(proof.id)}?source=proof` as never);
      }
    } catch {
      if (mounted.current) setActionError('Das PDF konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.');
    } finally {
      actionLock.current = false;
      if (mounted.current) setActionProofId(null);
    }
  };

  const handleSign = (proof: PortalServiceProof) => {
    router.push(`/portal/client/documents/${encodeURIComponent(proof.id)}?source=proof` as never);
  };

  const handleInquiry = async () => {
    if (!tenantId || !clientId || !isLinkedReady || !inquiryAllowed || actionLock.current || inquirySent) return;
    actionLock.current = true;
    setActionProofId('inquiry');
    setActionError(null);
    try {
      const result = await createPortalRequest({
        tenantId,
        clientId,
        portalUserId: actorId,
        moduleKey: 'assist',
        requestType: 'nachweise',
        title: 'Rückfrage zu Nachweisen',
        description: 'Bitte um Rückmeldung zu meinen Leistungsnachweisen.',
      });
      if (!mounted.current) return;
      if (result.ok) {
        setInquirySent(true);
      } else {
        setActionError(
          toPortalUserFacingError(
            result.error,
            'Ihre Rückfrage konnte gerade nicht gesendet werden. Bitte versuchen Sie es erneut.',
          ),
        );
      }
    } catch {
      if (mounted.current) setActionError('Ihre Rückfrage konnte nicht bestätigt werden. Bitte prüfen Sie die Verbindung und versuchen Sie es erneut.');
    } finally {
      actionLock.current = false;
      if (mounted.current) setActionProofId(null);
    }
  };

  if (!proofsAllowed) {
    return <PortalTabScreen title="Nachweise" hideHeaderOnPhone>
      <ClientPortalGuide compact title="Nachweise nicht freigegeben" message="Leistungsnachweise sind für diesen Angehörigenzugang nicht freigegeben. Bitte wenden Sie sich bei Fragen an Ihr Pflegebüro." />
    </PortalTabScreen>;
  }

  return (
    <PortalTabScreen title="Nachweise" hideHeaderOnPhone scroll={false}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <PortalGlassHero
          title="Leistungsnachweise"
          subtitle="Freigegebene Nachweise mit PDF, Status und Historie"
          showStatusDot
        />

        {!isUnreleasedModuleKey('pflege') ? <ClientCareProofPanel /> : null}

        {loading || isResolvingClientLink ? <LoadingState message="Nachweise werden geladen…" /> : null}
        {error ? <ErrorState title="Nachweise" message={error} onRetry={loadProofs} /> : null}
        {actionError ? <Text accessibilityRole="alert" style={styles.actionError}>{actionError}</Text> : null}
        {inquirySent ? <SuccessState message="Ihre Rückfrage zu den Nachweisen wurde übermittelt." /> : null}

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
                  <Text style={[type.body, styles.itemTitle, { color: text.primary, fontWeight: '600' }]} {...noBreakTextProps}>
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
                  {downloadAllowed ? <CareLightButton
                    title="PDF anzeigen"
                    variant="secondary"
                    loading={actionProofId === proof.id}
                    disabled={actionProofId !== null}
                    onPress={() => void handleViewPdf(proof)}
                  /> : <CareLightButton title="Nachweis öffnen" variant="secondary" onPress={() => handleSign(proof)} />}
                  {proof.status === 'offen' && proof.signatureRequired && signAllowed ? (
                    <CareLightButton title="Unterschreiben" disabled={actionProofId !== null} onPress={() => handleSign(proof)} />
                  ) : null}
                </View>
              </GlassCard>
            ))}
          </View>
        ) : null}

        {inquiryAllowed ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: actionProofId !== null || inquirySent }} disabled={actionProofId !== null || inquirySent || !isLinkedReady} onPress={() => void handleInquiry()} style={styles.inquiryLink}>
          <Text style={[type.caption, { color: PORTAL_LIGHT_LINK_ORANGE, fontWeight: '600' }]}>
            {actionProofId === 'inquiry' ? 'Wird gesendet…' : inquirySent ? 'Rückfrage gesendet' : 'Rückfrage senden'}
          </Text>
        </Pressable> : null}
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
  },
  itemTitle: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  actionError: { color: '#9F263E', lineHeight: 22 },
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
