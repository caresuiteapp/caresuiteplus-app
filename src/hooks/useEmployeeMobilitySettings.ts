import { useCallback, useMemo, useRef, useState } from 'react';
import type { EmployeeMobilitySettings } from '@/types/modules/employeeMobility';
import {
  fetchEmployeeMobilitySettings,
  loadEmployeeAddressContext,
  saveEmployeeMobilitySettings,
} from '@/lib/office/employeeMobilityService';
import { useAsyncQuery } from './core';

export function useEmployeeMobilitySettings(tenantId: string | null, employeeId: string | null) {
  const enabled = !!tenantId?.trim() && !!employeeId?.trim();

  const settingsQuery = useAsyncQuery(
    () => fetchEmployeeMobilitySettings(tenantId!, employeeId!),
    [tenantId, employeeId],
    { enabled, queryKey: `mobility:${tenantId}:${employeeId}` },
  );

  const addressQuery = useAsyncQuery(
    () => loadEmployeeAddressContext(tenantId!, employeeId!),
    [tenantId, employeeId],
    { enabled, queryKey: `mobility-address:${tenantId}:${employeeId}` },
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveLock = useRef(false);

  const save = useCallback(
    async (next: EmployeeMobilitySettings) => {
      if (!enabled || next.tenantId !== tenantId || next.employeeId !== employeeId) return { ok: false as const, error: 'Das Mitarbeitendenkonto hat sich geändert. Bitte die Einstellungen erneut laden.' };
      if (saveLock.current) return { ok: false as const, error: 'Die Einstellungen werden bereits gespeichert.' };
      saveLock.current = true;
      setSaving(true);
      setSaveError(null);
      try {
        const result = await saveEmployeeMobilitySettings(next);
        if (!result.ok) { setSaveError(result.error); return result; }
        const refreshed = await settingsQuery.refreshWithResult();
        if (refreshed === false) setSaveError('Einstellungen wurden gespeichert. Die aktuelle Ansicht konnte noch nicht geladen werden.');
        return result;
      } catch (cause) {
        const error = cause instanceof Error ? cause.message : 'Einstellungen konnten nicht gespeichert werden. Bitte erneut versuchen.';
        setSaveError(error); return { ok: false as const, error };
      } finally { saveLock.current = false; setSaving(false); }
    },
    [settingsQuery, enabled, tenantId, employeeId],
  );

  const refresh = useCallback(async () => {
    await Promise.all([settingsQuery.refresh(), addressQuery.refresh()]);
  }, [settingsQuery, addressQuery]);

  return useMemo(
    () => ({
      settings: settingsQuery.data,
      addressContext: addressQuery.data,
      loading: settingsQuery.loading || addressQuery.loading,
      error: settingsQuery.error ?? settingsQuery.refreshError ?? addressQuery.error ?? addressQuery.refreshError,
      saving,
      saveError,
      save,
      refresh,
    }),
    [
      settingsQuery.data,
      settingsQuery.loading,
      settingsQuery.error,
      settingsQuery.refreshError,
      addressQuery.data,
      addressQuery.loading,
      addressQuery.error,
      addressQuery.refreshError,
      saving,
      saveError,
      save,
      refresh,
    ],
  );
}
