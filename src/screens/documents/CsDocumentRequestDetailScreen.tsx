import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import { SignatureDisplay } from '@/components/signatures/SignatureDisplay';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
  InfoBanner,
  SuccessState,
} from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { PORTAL_LIGHT_LINK_ORANGE } from '@/design/tokens/auroraGlass';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchCsDocumentRequestDetail,
  fetchPortalCsDocumentRequestDetail,
  markCsDocumentRequestOpened,
  signCsDocumentRequest,
} from '@/lib/documents/csTemplates';
import { resolveCsDocumentRequestStatusLabel } from '@/types/documents/csTemplateDatabase';
import type { CsSignerRole } from '@/types/documents/csTemplateDatabase';
import { typography, spacing } from '@/theme';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import { usePortalActor } from '@/hooks/usePortalActor';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';

type PortalMode = 'office' | 'employee' | 'client';

type Props = {
  mode: PortalMode;
  signerRole: CsSignerRole;
  signerNameDefault?: string;
};

function RequestDetailShell({
  mode,
  title,
  subtitle,
  accent,
  canSign,
  onSign,
  children,
}: {
  mode: PortalMode;
  title: string;
  subtitle?: string;
  accent: string;
  canSign?: boolean;
  onSign?: () => void;
  children: ReactNode;
}) {
  if (mode === 'office') {
    return (
      <C14vSubpageShell
        title={title}
        subtitle={subtitle}
        showBack
        accentColor={accent}
        actions={canSign && onSign ? [{ key: 'sign', label: 'Unterschreiben', onPress: onSign, variant: 'primary' as const }] : []}
      >
        {children}
      </C14vSubpageShell>
    );
  }

  return (
    <PortalTabScreen
      title={title}
      subtitle={subtitle}
      actionsSlot={canSign && onSign ? <PremiumButton title="Jetzt unterschreiben" onPress={onSign} /> : undefined}
    >
      {children}
    </PortalTabScreen>
  );
}

export function CsDocumentRequestDetailScreen({
  mode,
  signerRole,
  signerNameDefault,
}: Props) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const portalActor = usePortalActor();
  const text = useAuroraAdaptiveText();
  const isPortal = mode !== 'office';
  const [signModal, setSignModal] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signSuccess, setSignSuccess] = useState(false);
  const autoOpenedRequestRef = useRef<string | null>(null);

  const query = useAsyncQuery(
    async () => {
      if (!tenantId || !id) return { ok: false as const, error: 'Dokument nicht gefunden.' };
      if (mode === 'office') {
        return fetchCsDocumentRequestDetail(tenantId, id, profile?.roleKey);
      }
      return fetchPortalCsDocumentRequestDetail({
        tenantId,
        requestId: id,
        roleKey: portalActor.roleKey,
        employeeId: portalActor.employeeId,
        clientId: portalActor.clientId,
      });
    },
    [tenantId, id, profile?.roleKey, mode, portalActor.roleKey, portalActor.employeeId, portalActor.clientId],
    { enabled: !!tenantId && !!id && (!isPortal || portalActor.isLinkedReady) },
  );

  const item = query.data;
  const canSign =
    item
    && item.pendingSignatureRoles.includes(signerRole)
    && ['sent', 'opened', 'partially_signed'].includes(item.status);

  const signedEntries = item?.signatures.filter((sig) => sig.status === 'signed') ?? [];
  const statusLabel = item
    ? resolveCsDocumentRequestStatusLabel(item.status, isPortal)
    : 'Dokument';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        meta: { ...typography.caption, color: text.muted, marginBottom: spacing.sm },
        historyRow: { gap: spacing.sm, marginTop: spacing.sm },
        backLink: { marginTop: spacing.md, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
      }),
    [text],
  );

  const handleOpen = async () => {
    if (!tenantId || !id || item?.status !== 'sent') return;
    await markCsDocumentRequestOpened(tenantId, id);
    await query.refresh();
  };

  useEffect(() => {
    if (!isPortal || item?.status !== 'sent' || !id || autoOpenedRequestRef.current === id) return;
    autoOpenedRequestRef.current = id;
    void handleOpen();
    // The request id/status deliberately owns this one-time portal acknowledgement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isPortal, item?.status]);

  const handleSign = async (dataUrl: string) => {
    if (!tenantId || !id) return;
    setWorking(true);
    setActionError(null);
    const result = await signCsDocumentRequest({
      tenantId,
      requestId: id,
      signerRole,
      signerName: signerNameDefault ?? profile?.displayName ?? 'Unterzeichner:in',
      signatureDataUrl: dataUrl,
      anchorToken: `${signerRole}_signature`,
      portalActor: isPortal && portalActor.roleKey
        ? {
            roleKey: portalActor.roleKey,
            employeeId: portalActor.employeeId,
            clientId: portalActor.clientId,
          }
        : undefined,
    });
    setWorking(false);
    if (!result.ok) {
      setActionError(
        isPortal
          ? toPortalUserFacingError(
              result.error,
              'Ihre Unterschrift konnte gerade nicht gespeichert werden. Bitte versuchen Sie es erneut.',
            )
          : result.error,
      );
      return;
    }
    setSignModal(false);
    setSignSuccess(true);
    await query.refresh();
  };

  const accent = mode === 'office' ? moduleColor('office') : moduleColor('assist');

  if (isPortal && !portalActor.isLinkedReady) {
    const isResolving =
      portalActor.isResolvingClientLink || portalActor.isResolvingEmployeeLink;
    return (
      <RequestDetailShell mode={mode} title="Dokument" accent={accent}>
        {isResolving ? (
          <LoadingState message="Ihr Portalprofil wird sicher verknüpft…" />
        ) : (
          <ErrorState message="Ihr Portalprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an." />
        )}
      </RequestDetailShell>
    );
  }

  if (query.loading && !item) {
    return (
      <RequestDetailShell mode={mode} title="Dokument" accent={accent}>
        <LoadingState message="Dokument wird geladen…" />
      </RequestDetailShell>
    );
  }

  if (query.error || !item) {
    return (
      <RequestDetailShell mode={mode} title="Dokument" accent={accent}>
        <ErrorState
          message={
            isPortal
              ? toPortalUserFacingError(
                  query.error,
                  'Dieses Dokument kann gerade nicht angezeigt werden. Bitte versuchen Sie es erneut.',
                )
              : query.error ?? 'Dieses Dokument kann gerade nicht angezeigt werden.'
          }
          onRetry={query.refresh}
        />
      </RequestDetailShell>
    );
  }

  return (
    <>
      <RequestDetailShell
        mode={mode}
        title={item.title}
        subtitle={statusLabel}
        accent={accent}
        canSign={Boolean(canSign)}
        onSign={() => setSignModal(true)}
      >
        {isPortal && canSign ? (
          <ClientPortalGuide
            compact
            title="Bitte prüfen und unterschreiben"
            message="Lesen Sie das Dokument vollständig. Danach können Sie oben auf „Jetzt unterschreiben“ tippen und direkt mit Finger, Stift oder Maus unterschreiben."
          />
        ) : null}
        <Text style={styles.meta}>
          Fällig {item.dueDate ? new Date(item.dueDate).toLocaleDateString('de-DE') : '—'}
          {item.requiredBeforeService ? ' · Pflicht vor Einsatz' : ''}
        </Text>
        {item.pendingSignatureRoles.length > 0 ? (
          <PremiumBadge
            label={isPortal ? 'Ihre Unterschrift fehlt noch' : `Offene Signatur: ${item.pendingSignatureRoles.join(', ')}`}
            variant="orange"
          />
        ) : null}
        {signSuccess ? (
          <SuccessState
            message={
              item.status === 'completed' || item.status === 'archived'
                ? 'Unterschrift gespeichert. Das Dokument ist vollständig unterschrieben.'
                : 'Unterschrift gespeichert. Weitere Unterschriften können noch ausstehen.'
            }
          />
        ) : null}
        {actionError ? <InfoBanner variant="danger" message={actionError} /> : null}
        <SectionPanel title="Dokument prüfen" subtitle="Bitte lesen Sie den Inhalt vollständig, bevor Sie unterschreiben.">
          {item.renderedHtml ? (
            <DocumentHtmlPreview title={item.title} previewHtml={item.renderedHtml} />
          ) : (
            <EmptyState title="Keine Vorschau" message="Für dieses Dokument liegt noch keine gerenderte Ansicht vor." />
          )}
        </SectionPanel>

        {signedEntries.length > 0 ? (
          <SectionPanel title="Historie" subtitle="Gespeicherte Unterschriften">
            <View style={styles.historyRow}>
              {signedEntries.map((sig) => (
                <SignatureDisplay
                  key={sig.id}
                  label={isPortal ? 'Gespeicherte Unterschrift' : `Unterschrift (${sig.signerRole})`}
                  signerName={sig.signerName}
                  signedAt={sig.signedAt}
                  compact
                />
              ))}
            </View>
          </SectionPanel>
        ) : null}

        {isPortal && (signSuccess || item.status === 'completed' || item.status === 'archived') ? (
          <Pressable onPress={() => router.back()} style={styles.backLink} accessibilityRole="button">
            <Text style={{ color: PORTAL_LIGHT_LINK_ORANGE, fontWeight: '700' }}>Zurück zur Liste</Text>
          </Pressable>
        ) : null}
      </RequestDetailShell>

      <CareSignatureModal
        visible={signModal}
        label="Unterschrift bestätigen"
        onConfirm={(dataUrl) => void handleSign(dataUrl)}
        onClose={() => setSignModal(false)}
        disabled={working}
      />
    </>
  );
}
