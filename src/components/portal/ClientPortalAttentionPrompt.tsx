import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { PremiumButton } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePortalOfficeMessages } from '@/hooks/useportalofficemessages';
import { fetchPortalCsDocumentRequests } from '@/lib/documents/csTemplates';

const DISMISSED_KEY = 'caresuite.clientPortal.attention.dismissed';
const SIGNATURE_REFRESH_MS = 60_000;

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
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const { tenantId, clientId, roleKey, isLinkedReady } = usePortalActor();
  const messages = usePortalOfficeMessages('open');
  const [dismissedFingerprint, setDismissedFingerprint] = useState<string | null>(() =>
    readDismissedFingerprint(),
  );

  const {
    data: signatureData,
    loading: signaturesLoading,
    silentRefresh: refreshSignatures,
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
    { enabled: isLinkedReady && !!tenantId && !!clientId && !!roleKey },
  );

  useEffect(() => {
    if (!isLinkedReady) return;
    const timer = setInterval(() => {
      void refreshSignatures();
    }, SIGNATURE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isLinkedReady, refreshSignatures]);

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
        {unreadCount > 0 ? (
          <View style={styles.notice}>
            <Text style={[type.bodyStrong, { color: text.primary }]}>
              {unreadCount === 1
                ? 'Sie haben eine neue Nachricht.'
                : `Sie haben ${unreadCount} neue Nachrichten.`}
            </Text>
            <Text style={[type.body, { color: text.secondary }]}>
              Öffnen Sie den Chat, um die Nachricht zu lesen und direkt zu antworten.
            </Text>
          </View>
        ) : null}

        {signatureCount > 0 ? (
          <View style={styles.notice}>
            <Text style={[type.bodyStrong, { color: text.primary }]}>
              {signatureCount === 1
                ? 'Ein Dokument wartet auf Ihre Unterschrift.'
                : `${signatureCount} Dokumente warten auf Ihre Unterschrift.`}
            </Text>
            <Text style={[type.body, { color: text.secondary }]}>
              Sie können die Dokumente zuerst lesen und anschließend sicher unterschreiben.
            </Text>
            {unreadCount > 0 ? (
              <PremiumButton
                title="Offene Unterschriften öffnen"
                variant="secondary"
                onPress={navigateToSignatures}
                fullWidth
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </PortalGlassModal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: careSpacing.md,
  },
  notice: {
    gap: careSpacing.xs,
  },
});
