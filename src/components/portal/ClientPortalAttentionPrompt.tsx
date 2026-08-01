import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { PremiumButton } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePortalOfficeMessages } from '@/hooks/useportalofficemessages';
import { fetchPortalCsDocumentRequests } from '@/lib/documents/csTemplates';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import { subscribeToClientPortalDocumentRequestChanges, type RealtimeHandler } from '@/lib/realtime';

const DISMISSED_KEY = 'caresuite.clientPortal.attention.dismissed';

function readDismissedFingerprint(): string | null {
  if (typeof globalThis.sessionStorage === 'undefined') return null;
  try {
    return globalThis.sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function saveDismissedFingerprint(fingerprint: string): void {
  if (typeof globalThis.sessionStorage === 'undefined') return;
  try {
    globalThis.sessionStorage.setItem(DISMISSED_KEY, fingerprint);
  } catch {
    // Session storage is optional; local component state still prevents a loop.
  }
}

export function ClientPortalAttentionPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const { tenantId, clientId, roleKey, isLinkedReady } = usePortalActor();
  const messages = usePortalOfficeMessages('open');
  const [dismissedFingerprint, setDismissedFingerprint] = useState<string | null>(() =>
    readDismissedFingerprint(),
  );
  const subscribe = useCallback(
    (currentTenantId: string, handler: RealtimeHandler) => {
      if (!clientId) return () => undefined;
      return subscribeToClientPortalDocumentRequestChanges(currentTenantId, clientId, handler);
    },
    [clientId],
  );

  const {
    data: signatureData,
    loading: signaturesLoading,
  } = useAsyncQuery(
    () => {
      if (!tenantId || !clientId || !roleKey) {
        return Promise.resolve({ ok: true as const, data: [] });
      }
      return fetchPortalCsDocumentRequests({
        tenantId,
        clientId,
        roleKey,
        includeCompleted: false,
      });
    },
    [tenantId, clientId, roleKey],
    {
      enabled: isLinkedReady && !!tenantId && !!clientId && !!roleKey,
      live: { tenantId, subscribe, pollMs: 30_000, refreshOnFocus: true },
    },
  );

  const unreadThreads = useMemo(
    () => messages.threads.filter((thread) => thread.unreadCount > 0),
    [messages.threads],
  );
  const unreadCount = unreadThreads.reduce((sum, thread) => sum + thread.unreadCount, 0);
  const pendingSignatureItems = useMemo(() => signatureData ?? [], [signatureData]);
  const signatureCount = pendingSignatureItems.length;

  const fingerprint = useMemo(() => {
    if (unreadCount === 0 && signatureCount === 0) return null;
    const messagePart = unreadThreads
      .map((thread) => `${thread.id}:${thread.unreadCount}`)
      .sort()
      .join(',');
    const signaturePart = pendingSignatureItems
      .map((document) => document.id)
      .sort()
      .join(',');
    return `m=${messagePart}|s=${signaturePart}`;
  }, [pendingSignatureItems, signatureCount, unreadCount, unreadThreads]);

  const alreadyAtDestination =
    pathname?.startsWith('/portal/client/messages') ||
    pathname?.startsWith('/portal/client/documents/signatures');
  const ready = !messages.loading && !signaturesLoading;
  const visible = Boolean(
    ready &&
      fingerprint &&
      fingerprint !== dismissedFingerprint &&
      !alreadyAtDestination,
  );

  const dismiss = () => {
    if (fingerprint) {
      setDismissedFingerprint(fingerprint);
      saveDismissedFingerprint(fingerprint);
    }
  };

  const openMessages = () => {
    dismiss();
    router.push('/portal/client/messages' as never);
  };

  const navigateToSignatures = () => {
    dismiss();
    router.push('/portal/client/documents/signatures' as never);
  };

  const title =
    unreadCount > 0 && signatureCount > 0
      ? 'Es gibt Neues für Sie'
      : unreadCount > 0
        ? 'Neue Nachricht'
        : 'Unterschrift benötigt';

  return (
    <PortalGlassModal
      visible={visible}
      title={title}
      onClose={dismiss}
      primaryLabel={unreadCount > 0 ? 'Nachrichten öffnen' : 'Dokumente öffnen'}
      onPrimary={unreadCount > 0 ? openMessages : navigateToSignatures}
    >
      <View style={styles.content}>
        <ClientPortalGuide
          compact
          title={title}
          message={[
            unreadCount > 0 ? `${unreadCount === 1 ? 'Eine neue Nachricht wartet' : `${unreadCount} neue Nachrichten warten`} auf Sie.` : null,
            signatureCount > 0 ? `${signatureCount === 1 ? 'Ein Dokument braucht' : `${signatureCount} Dokumente brauchen`} noch Ihre Unterschrift.` : null,
          ].filter(Boolean).join(' ')}
        />
        {unreadCount > 0 && signatureCount > 0 ? (
          <PremiumButton title="Offene Unterschriften öffnen" variant="secondary" onPress={navigateToSignatures} fullWidth />
        ) : null}
      </View>
    </PortalGlassModal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: careSpacing.md,
  },
});
