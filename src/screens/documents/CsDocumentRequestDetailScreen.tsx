import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import { SignatureDisplay } from '@/components/signatures/SignatureDisplay';
import {
  CareLightButton,
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
  markCsDocumentRequestOpened,
  signCsDocumentRequest,
} from '@/lib/documents/csTemplates';
import { resolveCsDocumentRequestStatusLabel } from '@/types/documents/csTemplateDatabase';
import type { CsSignerRole } from '@/types/documents/csTemplateDatabase';
import { typography, spacing } from '@/theme';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';

type PortalMode = 'office' | 'employee' | 'client';

type Props = {
  mode: PortalMode;
  signerRole: CsSignerRole;
  signerNameDefault?: string;
};

export function CsDocumentRequestDetailScreen({
  mode,
  signerRole,
  signerNameDefault,
}: Props) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const text = useAuroraAdaptiveText();
  const isPortal = mode !== 'office';
  const [signModal, setSignModal] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signSuccess, setSignSuccess] = useState(false);

  const query = useAsyncQuery(
    async () => {
      if (!tenantId || !id) return { ok: false as const, error: 'Dokument nicht gefunden.' };
      if (mode === 'office') {
        return fetchCsDocumentRequestDetail(tenantId, id, profile?.roleKey);
      }
      return fetchCsDocumentRequestDetail(tenantId, id, profile?.roleKey, { portalMode: true });
    },
    [tenantId, id, profile?.roleKey, mode],
    { enabled: !!tenantId && !!id },
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
    });
    setWorking(false);
    setSignModal(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setSignSuccess(true);
    await query.refresh();
  };

  const accent = mode === 'office' ? moduleColor('office') : moduleColor('assist');

  if (query.loading && !item) {
    return (
      <C14vSubpageShell title="Dokument" showBack accentColor={accent}>
        <LoadingState message="Dokument wird geladen…" />
      </C14vSubpageShell>
    );
  }

  if (query.error || !item) {
    return (
      <C14vSubpageShell title="Dokument" showBack accentColor={accent}>
        <ErrorState message={query.error ?? 'Dokument nicht gefunden.'} onRetry={query.refresh} />
      </C14vSubpageShell>
    );
  }

  const signAction = canSign
    ? isPortal
      ? [{ key: 'sign', label: 'Unterschreiben', onPress: () => setSignModal(true), variant: 'primary' as const }]
      : [{ key: 'sign', label: 'Unterschreiben', onPress: () => setSignModal(true), variant: 'primary' as const }]
    : [];

  return (
    <>
      <C14vSubpageShell
        title={item.title}
        subtitle={statusLabel}
        showBack
        accentColor={accent}
        actions={signAction}
      >
        <Text style={styles.meta}>
          Fällig {item.dueDate ? new Date(item.dueDate).toLocaleDateString('de-DE') : '—'}
          {item.requiredBeforeService ? ' · Pflicht vor Einsatz' : ''}
        </Text>
        {item.pendingSignatureRoles.length > 0 ? (
          <PremiumBadge label={`Offene Signatur: ${item.pendingSignatureRoles.join(', ')}`} variant="orange" />
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
        {item.status === 'sent' && mode !== 'office' ? (
          isPortal ? (
            <CareLightButton title="Als geöffnet markieren" variant="secondary" onPress={() => void handleOpen()} />
          ) : (
            <PremiumButton title="Als geöffnet markieren" variant="ghost" onPress={() => void handleOpen()} />
          )
        ) : null}

        <SectionPanel title="Vorschau" subtitle="Gerendertes Dokument">
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
                  label={`Unterschrift (${sig.signerRole})`}
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
      </C14vSubpageShell>

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
