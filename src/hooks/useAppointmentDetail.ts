import { useAsyncQuery } from './core';
import { fetchAppointmentDetail } from '@/lib/office/appointmentDetailService';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';

export function useAppointmentDetail(appointmentId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!appointmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Termin-ID angegeben.' });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchAppointmentDetail(appointmentId, tenantId, profile?.roleKey);
    },
    [appointmentId, tenantId, profile?.roleKey],
    { enabled: Boolean(appointmentId) && !!tenantId },
  );

  const notFound =
    !query.loading && !query.error && query.data === null && Boolean(appointmentId);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    notFound,
  };
}
