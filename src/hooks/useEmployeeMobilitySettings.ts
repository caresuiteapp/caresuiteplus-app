import { useCallback, useMemo, useState } from 'react';
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
    { enabled },
  );

  const addressQuery = useAsyncQuery(
    () => loadEmployeeAddressContext(tenantId!, employeeId!),
    [tenantId, employeeId],
    { enabled },
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = useCallback(
    async (next: EmployeeMobilitySettings) => {
      setSaving(true);
      setSaveError(null);
      const result = await saveEmployeeMobilitySettings(next);
      setSaving(false);
      if (!result.ok) {
        setSaveError(result.error);
        return result;
      }
      await settingsQuery.refresh();
      return result;
    },
    [settingsQuery],
  );

  const refresh = useCallback(async () => {
    await Promise.all([settingsQuery.refresh(), addressQuery.refresh()]);
  }, [settingsQuery, addressQuery]);

  return useMemo(
    () => ({
      settings: settingsQuery.data,
      addressContext: addressQuery.data,
      loading: settingsQuery.loading || addressQuery.loading,
      error: settingsQuery.error ?? addressQuery.error,
      saving,
      saveError,
      save,
      refresh,
    }),
    [
      settingsQuery.data,
      settingsQuery.loading,
      settingsQuery.error,
      addressQuery.data,
      addressQuery.loading,
      addressQuery.error,
      saving,
      saveError,
      save,
      refresh,
    ],
  );
}
