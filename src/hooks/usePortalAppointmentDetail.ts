import { useCallback } from 'react';
import { fetchPortalAppointmentDetail } from '@/lib/portal';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from './core';

export function usePortalAppointmentDetail(appointmentId: string | undefined) {
  const { profile } = useAuth();
  const profileId = profile?.id ?? '';
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => fetchPortalAppointmentDetail(appointmentId ?? '', profileId, roleKey),
    [appointmentId, profileId, roleKey],
    { enabled: !!appointmentId && !!profileId && !!roleKey },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    notFound: !query.loading && !query.error && !query.data && !!appointmentId,
  };
}
