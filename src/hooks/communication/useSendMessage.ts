import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { sendMessage } from '@/features/communication/communication.service';
import type { SendMessageInput } from '@/features/communication/communication.types';

export function useSendMessage(threadId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (input: Omit<SendMessageInput, 'threadId'>) => {
      if (!tenantId) {
        setError('Kein Mandant.');
        return null;
      }
      if (!threadId) {
        setError('Keine Thread-ID.');
        return null;
      }
      setLoading(true);
      setError(null);
      const result = await sendMessage(
        tenantId,
        { ...input, threadId },
        profile?.roleKey,
        profile?.id,
        profile?.displayName ?? 'Nutzer:in',
      );
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      return result.data;
    },
    [tenantId, threadId, profile?.roleKey, profile?.id, profile?.displayName],
  );

  return { send, loading, error };
}
