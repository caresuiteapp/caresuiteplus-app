import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { PremiumButton, SuccessState } from '@/components/ui';
import { ComposeMessageForm } from '@/screens/shared/ComposeMessageForm';
import { useDomainComposeMessage } from '@/hooks/useDomainComposeMessage';
import type { PermissionKey } from '@/types/permissions';

type MessageComposeScreenShellProps = {
  wpNumber: number;
  domain: string;
  permission: PermissionKey;
  audienceScope: 'office' | 'portal';
  enableRecipientSelection?: boolean;
  title?: string;
};

export function MessageComposeScreenShell({
  wpNumber,
  domain,
  permission,
  audienceScope,
  enableRecipientSelection = false,
  title = 'Nachricht',
}: MessageComposeScreenShellProps) {
  const router = useRouter();
  const {
    sent,
    subject,
    setSubject,
    body,
    setBody,
    error,
    isSending,
    send,
    recipientType,
    setRecipientType,
    recipientId,
    setRecipientId,
    recipientOptions,
    recipientsLoading,
  } = useDomainComposeMessage({
    wpNumber,
    domain,
    permission,
    audienceScope,
    enableRecipientSelection,
  });

  if (sent) {
    return (
      <ScreenShell title={title} subtitle={`WP ${wpNumber}`}>
        <SuccessState message="Nachricht wurde gespeichert." />
        <PremiumButton title="Zurück" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={title} subtitle={`${domain} · Kommunikation`}>
      <ComposeMessageForm
        wpNumber={wpNumber}
        subject={subject}
        setSubject={setSubject}
        body={body}
        setBody={setBody}
        error={error}
        isSending={isSending}
        send={send}
        enableRecipientSelection={enableRecipientSelection}
        recipientType={recipientType}
        setRecipientType={setRecipientType}
        recipientId={recipientId}
        setRecipientId={setRecipientId}
        recipientOptions={recipientOptions}
        recipientsLoading={recipientsLoading}
      />
    </ScreenShell>
  );
}
