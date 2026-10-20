import React, { useRef, useState } from 'react';
import { Text } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePortalOfficeMessages } from '@/hooks/useportalofficemessages';
import { useClientSignatureAttention } from './ClientSignatureAttentionProvider';
import { ClientSignatureRequiredDialog } from './ClientSignatureRequiredDialog.web';
import { useAppStartIntroReady } from '@/components/brand/appStartIntroSession';

const acknowledgedMessages = new Map<string, Set<string>>();
export function ClientPortalAttentionPrompt() {
  const startupReady = useAppStartIntroReady();
  const router = useRouter();
  const pathname = usePathname().replace(/\/+$/, '');
  const { tenantId, clientId, actorId, isLinkedReady } = usePortalActor();
  const messages = usePortalOfficeMessages('open');
  const signatures = useClientSignatureAttention();
  const [, rerender] = useState(0);
  const account = JSON.stringify([tenantId, clientId, actorId]);
  const activeProof = useRef({ account: '', path: '' });
  if (activeProof.current.account !== account || activeProof.current.path !== pathname) {
    activeProof.current = { account, path: '' };
  }
  if (signatures.items.some((item) => item.route === pathname)) {
    activeProof.current = { account, path: pathname };
  }
  // Keep the current signing detail usable when its signature disappears from the inbox.
  const atSignatures = pathname === '/portal/client/documents/signatures'
    || pathname.startsWith('/portal/client/documents/signatures/')
    || activeProof.current.path === pathname;
  const ready = startupReady && isLinkedReady;
  const count = signatures.items.length;
  const unread = messages.threads.filter((thread) => thread.unreadCount > 0);
  const keys = unread.map((thread) => `${thread.id}:${thread.unreadCount}`);
  const unseenMessages = keys.some((key) => !acknowledgedMessages.get(account)?.has(key));
  const dismissMessages = () => {
    acknowledgedMessages.set(account, new Set(keys));
    if (acknowledgedMessages.size > 20) acknowledgedMessages.delete(acknowledgedMessages.keys().next().value!);
    rerender((version) => version + 1);
  };
  if (ready && count > 0 && !atSignatures) {
    return <ClientSignatureRequiredDialog count={count} onOpen={() => router.push('/portal/client/documents/signatures' as never)} />;
  }
  return <PortalGlassModal
    visible={ready && count === 0 && !atSignatures && !pathname.startsWith('/portal/client/messages') && unseenMessages}
    title="Neue Nachrichten für Sie"
    onClose={dismissMessages}
    primaryLabel="Nachrichten öffnen"
    onPrimary={() => {
      dismissMessages();
      router.push((unread.length === 1 ? `/portal/client/messages/${unread[0].id}` : '/portal/client/messages') as never);
    }}
  ><Text>Neue Nachrichten warten auf Sie.</Text></PortalGlassModal>;
}
