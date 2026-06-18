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
};

export function MessageComposeScreenShell({
  wpNumber,
  domain,
  permission,
  audienceScope,
}: MessageComposeScreenShellProps) {
  const router = useRouter();
  const { sent, subject, setSubject, body, setBody, error, isSending, send } = useDomainComposeMessage({
    wpNumber,
    domain,
    permission,
    audienceScope,
  });

  if (sent) {
    return (
      <CareLightPageShell title="Nachricht" subtitle={`WP ${wpNumber}`}>
        <SuccessState message="Nachricht wurde gespeichert." />
        <PremiumButton title="Zurück" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title="Nachricht" subtitle={`${domain} · Kommunikation`}>
      <ComposeMessageForm
        wpNumber={wpNumber}
        subject={subject}
        setSubject={setSubject}
        body={body}
        setBody={setBody}
        error={error}
        isSending={isSending}
        send={send}
      />
    </CareLightPageShell>
  );
}
