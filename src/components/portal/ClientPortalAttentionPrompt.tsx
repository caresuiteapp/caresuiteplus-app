import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { PremiumButton } from '@/components/ui';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePortalOfficeMessages } from '@/hooks/useportalofficemessages';
import { useClientSignatureAttention } from './ClientSignatureAttentionProvider';
import { signatureAttentionKey } from '@/lib/portal/clientSignatureAttention';
import { portalPremium } from '@/design/tokens/portalPremium';

// Native-safe, account-scoped dismissal for this app run. Never hides an open task.
const acknowledged = new Map<string, Set<string>>();
export function ClientPortalAttentionPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const { tenantId, actorId, isLinkedReady } = usePortalActor();
  const messages = usePortalOfficeMessages('open');
  const signatures = useClientSignatureAttention();
  const [dismissalVersion, setDismissalVersion] = useState(0);
  const accountKey = JSON.stringify([tenantId, actorId]);
  const unread = messages.threads.filter((thread) => thread.unreadCount > 0);
  const unreadCount = unread.reduce((sum, thread) => sum + thread.unreadCount, 0);
  const keys = useMemo(() => [...signatures.items.map(signatureAttentionKey), ...unread.map((thread) => `message:${thread.id}:${thread.unreadCount}`)], [signatures.items, unread]);
  const seen = acknowledged.get(accountKey);
  const atDestination = pathname.startsWith('/portal/client/documents') || pathname.startsWith('/portal/client/messages');
  const visible = isLinkedReady && !atDestination && keys.some((key) => !seen?.has(key));
  const dismiss = () => {
    const next = new Set(acknowledged.get(accountKey));
    keys.forEach((key) => next.add(key));
    acknowledged.set(accountKey, next);
    if (acknowledged.size > 20) acknowledged.delete(acknowledged.keys().next().value!);
    setDismissalVersion(dismissalVersion + 1);
  };
  const openSignatures = () => {
    dismiss();
    router.push((signatures.items.length === 1 ? signatures.items[0].route : '/portal/client/documents/signatures') as never);
  };
  const openMessages = () => {
    dismiss();
    router.push((unread.length === 1 ? `/portal/client/messages/${unread[0].id}` : '/portal/client/messages') as never);
  };
  const count = signatures.items.length;
  return <PortalGlassModal visible={visible} title={count ? 'Ihre Unterschrift wird benötigt' : 'Neue Nachrichten für Sie'} onClose={dismiss}
    primaryLabel={count ? 'Jetzt prüfen und unterschreiben' : 'Nachrichten öffnen'} onPrimary={count ? openSignatures : openMessages}>
    <View style={{ gap: 12 }}>
      {count ? <Text style={{ fontSize: 18, lineHeight: 27, color: portalPremium.text.primary }}>
        {count === 1 ? 'Ein Dokument wartet' : `${count} Dokumente warten`} auf Ihre Unterschrift. Bitte prüfen Sie die Angaben und unterschreiben Sie anschließend. Die Aufgabe bleibt unter „Unterschriften“ sichtbar, bis Ihre Unterschrift gespeichert ist.
      </Text> : null}
      {unreadCount ? <Text style={{ fontSize: 17, lineHeight: 25, color: portalPremium.text.secondary }}>{unreadCount === 1 ? 'Eine neue Nachricht wartet' : `${unreadCount} neue Nachrichten warten`} auf Sie.</Text> : null}
      {count && unreadCount ? <PremiumButton title="Nachrichten öffnen" variant="secondary" onPress={openMessages} /> : null}
    </View>
  </PortalGlassModal>;
}
