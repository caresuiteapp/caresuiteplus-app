import { useCallback } from 'react';
import { completeTrip, fetchTripDetail } from '@/lib/assist';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery, useMutation } from './core';

export function useTripDetail(tripId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!tripId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Fahrt-ID angegeben.' });
      }
      return fetchTripDetail(tripId, tenantId, roleKey);
    },
    [tenantId, tripId, roleKey],
    { enabled: Boolean(tripId) && !!tenantId },
  );

  const completeMutation = useMutation(
    (input: { endAddress: string; distanceKm: number }) => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!tripId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Fahrt-ID angegeben.' });
      }
      return completeTrip(tripId, tenantId, input.endAddress, input.distanceKm, roleKey);
    },
    {
      successMessage: 'Fahrt abgeschlossen.',
      onSuccess: (data) => query.setData(data),
    },
  );

  return {
    data: query.data,
    loading: query.loading,
    error: query.error ?? completeMutation.error,
    actionLoading: completeMutation.loading,
    successMessage: completeMutation.successMessage,
    refresh: query.refresh,
    completeTrip: completeMutation.mutate,
    notFound: !query.loading && !query.error && !query.data,
  };
}
