import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { OfficeRecipientOption, OfficeRecipientType } from '@/types/office/officeCompose';
import { OFFICE_INTERNAL_RECIPIENT_ID } from '@/types/office/officeCompose';
import { sendDomainMessage } from '@/lib/communication/domainMessageService';
import { fetchOfficeComposeRecipients } from '@/lib/office/officeComposeRecipientService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

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
  const [recipientType, setRecipientType] = useState<OfficeRecipientType | null>(null);
  const [recipientId, setRecipientId] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientOptions, setRecipientOptions] = useState<OfficeRecipientOption[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientLoadError, setRecipientLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!options.enableRecipientSelection || !tenantId || !recipientType) {
      setRecipientOptions([]);
      setRecipientLoadError(null);
      setRecipientId('');
      return;
    }

    let cancelled = false;
    setLoadingRecipients(true);
    setRecipientLoadError(null);

    void fetchOfficeComposeRecipients(tenantId, recipientType, profile?.roleKey).then((result) => {
      if (cancelled) return;
      setLoadingRecipients(false);
      if (!result.ok) {
        setRecipientOptions([]);
        setRecipientLoadError(result.error);
        setRecipientId('');
        return;
      }
      setRecipientOptions(result.data);
      if (recipientType === 'internal') {
        setRecipientId(OFFICE_INTERNAL_RECIPIENT_ID);
        return;
      }
      if (result.data.length === 1) {
        setRecipientId(result.data[0].id);
        return;
      }
      if (recipientType === 'team') {
        const defaultTeam = result.data.find((option) => option.id === 'team:allgemein');
        if (defaultTeam) {
          setRecipientId(defaultTeam.id);
          return;
        }
      }
      setRecipientId((current) =>
        result.data.some((option) => option.id === current) ? current : '',
      );
    });

    return () => {
      cancelled = true;
    };
  }, [options.enableRecipientSelection, profile?.roleKey, recipientType, tenantId]);

  const filteredRecipientOptions = useMemo(() => {
    const query = recipientSearch.trim().toLowerCase();
    if (!query) return recipientOptions;
    return recipientOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [recipientOptions, recipientSearch]);

  const recipientLabel = useMemo(
    () => recipientOptions.find((option) => option.id === recipientId)?.label ?? null,
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
        tenantId,
        actorRoleKey: profile?.roleKey as RoleKey | null | undefined,
        permission: options.permission,
        audienceScope: options.audienceScope,
        subject,
        body,
        senderName: profile?.displayName ?? undefined,
        profileId: profile?.id,
        requireRecipient: options.enableRecipientSelection ?? false,
        recipientType: options.enableRecipientSelection ? recipientType : undefined,
        recipientId: options.enableRecipientSelection ? recipientId : undefined,
        recipientLabel: options.enableRecipientSelection ? recipientLabel ?? undefined : undefined,
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
    profile?.id,
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
    recipientSearch,
    setRecipientSearch,
    filteredRecipientOptions,
    loadingRecipients,
    recipientLoadError,
  };
}
