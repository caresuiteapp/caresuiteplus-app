import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  SectionPanel,
  InfoBanner,
} from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchCsDocumentRequestDetail,
  markCsDocumentRequestOpened,
  signCsDocumentRequest,
} from '@/lib/documents/csTemplates';
import { CS_DOCUMENT_REQUEST_STATUS_LABELS } from '@/types/documents/csTemplateDatabase';
import type { CsSignerRole } from '@/types/documents/csTemplateDatabase';
import { typography } from '@/theme';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing } from '@/theme';

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
  const [signModal, setSignModal] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        meta: { ...typography.caption, color: text.muted, marginBottom: spacing.sm },
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
    await query.refresh();
    if (mode !== 'office') {
      router.back();
    }
  };

  if (query.loading && !item) {
    return (
      <C14vSubpageShell title="Dokument" showBack accentColor={moduleColor('office')}>
        <LoadingState message="Dokument wird geladen…" />
      </C14vSubpageShell>
    );
  }

  if (query.error || !item) {
    return (
      <C14vSubpageShell title="Dokument" showBack accentColor={moduleColor('office')}>
        <ErrorState message={query.error ?? 'Dokument nicht gefunden.'} onRetry={query.refresh} />
      </C14vSubpageShell>
    );
  }

  return (
    <>
      <C14vSubpageShell
        title={item.title}
        subtitle={CS_DOCUMENT_REQUEST_STATUS_LABELS[item.status]}
        showBack
        accentColor={mode === 'office' ? moduleColor('office') : moduleColor('assist')}
        actions={
          canSign
            ? [{ key: 'sign', label: 'Unterschreiben', onPress: () => setSignModal(true), variant: 'primary' as const }]
            : []
        }
      >
        <Text style={styles.meta}>
          Fällig {item.dueDate ? new Date(item.dueDate).toLocaleDateString('de-DE') : '—'}
          {item.requiredBeforeService ? ' · Pflicht vor Einsatz' : ''}
        </Text>
        {item.pendingSignatureRoles.length > 0 ? (
          <PremiumBadge label={`Offene Signatur: ${item.pendingSignatureRoles.join(', ')}`} variant="orange" />
        ) : null}
        {actionError ? <InfoBanner variant="danger" message={actionError} /> : null}
        {item.status === 'sent' && mode !== 'office' ? (
          <PremiumButton title="Als geöffnet markieren" variant="ghost" onPress={() => void handleOpen()} />
        ) : null}
        <SectionPanel title="Vorschau" subtitle="Gerendertes Dokument">
          {item.renderedHtml ? (
            <DocumentHtmlPreview title={item.title} previewHtml={item.renderedHtml} />
          ) : (
            <EmptyState title="Keine Vorschau" message="Für dieses Dokument liegt noch keine gerenderte Ansicht vor." />
          )}
        </SectionPanel>
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
