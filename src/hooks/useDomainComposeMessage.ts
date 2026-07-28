import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { sendDomainMessage } from '@/lib/communication/domainMessageService';
import { fetchOfficeComposeRecipients } from '@/lib/office/officeComposeRecipientService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  OFFICE_INTERNAL_RECIPIENT_ID,
  type OfficeRecipientOption,
  type OfficeRecipientType,
} from '@/types/office/officeCompose';

type UseDomainComposeMessageOptions = {
  wpNumber: number;
  domain: string;
  permission: PermissionKey;
  audienceScope: 'office' | 'portal';
  title?: string;
  enableRecipientSelection?: boolean;
};

export function useDomainComposeMessage(options: UseDomainComposeMessageOptions) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [recipientType, setRecipientType] = useState<OfficeRecipientType>('internal');
  const [recipientId, setRecipientId] = useState(OFFICE_INTERNAL_RECIPIENT_ID);
  const [recipientOptions, setRecipientOptions] = useState<OfficeRecipientOption[]>([
    { id: OFFICE_INTERNAL_RECIPIENT_ID, label: 'Büro (alle)' },
  ]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);

  useEffect(() => {
    if (!options.enableRecipientSelection || !tenantId) return;

    let active = true;
    setRecipientsLoading(true);
    void fetchOfficeComposeRecipients(tenantId, recipientType, profile?.roleKey)
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setRecipientOptions([]);
          setRecipientId('');
          setError(result.error);
          return;
        }
        setRecipientOptions(result.data);
        setRecipientId((current) =>
          result.data.some((item) => item.id === current) ? current : (result.data[0]?.id ?? ''),
        );
      })
      .finally(() => {
        if (active) setRecipientsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [options.enableRecipientSelection, profile?.roleKey, recipientType, tenantId]);

  const recipientLabel = useMemo(
    () => recipientOptions.find((item) => item.id === recipientId)?.label,
    [recipientId, recipientOptions],
  );

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
        requireRecipient: options.enableRecipientSelection,
        recipientType: options.enableRecipientSelection ? recipientType : undefined,
        recipientId: options.enableRecipientSelection ? recipientId : undefined,
        recipientLabel: options.enableRecipientSelection ? recipientLabel : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    } finally {
      setIsSending(false);
    }
  }, [
    body,
    options,
    profile?.displayName,
    profile?.roleKey,
    recipientId,
    recipientLabel,
    recipientType,
    subject,
    tenantId,
  ]);

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
    recipientType,
    setRecipientType,
    recipientId,
    setRecipientId,
    recipientOptions,
    recipientsLoading,
  };
}
