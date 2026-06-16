import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
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
  subtitle?: string;
};

export function MessageComposeScreenShell({
  wpNumber,
  domain,
  permission,
  audienceScope,
  enableRecipientSelection = false,
  title = 'Nachricht',
  subtitle,
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
    recipientSearch,
    setRecipientSearch,
    filteredRecipientOptions,
    loadingRecipients,
    recipientLoadError,
  } = useDomainComposeMessage({
    wpNumber,
    domain,
    permission,
    audienceScope,
    enableRecipientSelection,
  });

  const resolvedSubtitle =
    subtitle ?? (enableRecipientSelection ? 'Empfänger wählen und Nachricht senden' : `${domain} · Kommunikation`);

  if (sent) {
    return (
      <CareLightPageShell title={title} subtitle={resolvedSubtitle}>
        <SuccessState message="Nachricht wurde gespeichert." />
        <PremiumButton title="Zurück" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title={title} subtitle={resolvedSubtitle}>
      <ComposeMessageForm
        wpNumber={wpNumber}
        subject={subject}
        setSubject={setSubject}
        body={body}
        setBody={setBody}
        error={error}
        isSending={isSending}
        send={send}
        recipientSelection={
          enableRecipientSelection
            ? {
                recipientType,
                setRecipientType,
                recipientId,
                setRecipientId,
                recipientSearch,
                setRecipientSearch,
                recipientOptions: filteredRecipientOptions.map((option) => ({
                  key: option.id,
                  label: option.label,
                })),
                loadingRecipients,
                recipientLoadError,
              }
            : undefined
        }
      />
    </CareLightPageShell>
  );
}
