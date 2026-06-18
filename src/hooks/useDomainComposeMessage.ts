import { useCallback, useState } from 'react';
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { sendDomainMessage } from '@/lib/communication/domainMessageService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

type UseDomainComposeMessageOptions = {
  wpNumber: number;
  domain: string;
  permission: PermissionKey;
  audienceScope: 'office' | 'portal';
  title?: string;
};

export function useDomainComposeMessage(options: UseDomainComposeMessageOptions) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const send = useCallback(async () => {
    if (!tenantId) {
      setError('Kein Mandant.');
      return;
    }
    setError(null);
    setIsSending(true);
    try {
      const result = await sendDomainMessage({
        wpNumber: options.wpNumber,
        domain: options.domain,
        tenantId: tenantId,
        actorRoleKey: profile?.roleKey as RoleKey | null | undefined,
        permission: options.permission,
        audienceScope: options.audienceScope,
        subject,
        body,
        senderName: profile?.displayName ?? undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    } finally {
      setIsSending(false);
    }
  }, [body, options, tenantId, profile?.displayName, profile?.roleKey, subject]);

  return {
    wpNumber: options.wpNumber,
    domain: options.domain,
    title: options.title ?? 'Nachricht',
    subject,
    setSubject,
    body,
    setBody,
    sent,
    error,
    isSending,
    send,
  };
}
