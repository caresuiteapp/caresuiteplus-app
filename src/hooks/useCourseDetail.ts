import { useCallback } from 'react';
import { fetchCourseDetail } from '@/lib/akademie';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useCourseDetail(courseId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!courseId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Kurs-ID angegeben.' });
      }
      return fetchCourseDetail(courseId, tenantId, roleKey);
    },
    [tenantId, courseId, roleKey],
    { enabled: Boolean(courseId) && !!tenantId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    notFound: !query.loading && !query.error && !query.data,
  };
}
