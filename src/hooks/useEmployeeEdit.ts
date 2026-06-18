import { useCallback, useEffect, useState } from 'react';
import type { EmployeeEditFormData } from '@/types/forms/employeeEditForm';
import { EMPTY_EMPLOYEE_EDIT_FORM } from '@/types/forms/employeeEditForm';
import { saveEmployeeEdit } from '@/lib/office/employeeEditService';
import { mapEmployeeDetailToEditForm } from '@/lib/office/employeeEditFormMappers';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useEmployeeDetail } from './useEmployeeDetail';
import { useMutation } from './core';

export function useEmployeeEdit(employeeId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;
  const detail = useEmployeeDetail(employeeId);

  const [form, setForm] = useState<EmployeeEditFormData>(EMPTY_EMPLOYEE_EDIT_FORM);

  useEffect(() => {
    if (detail.data) {
      setForm(mapEmployeeDetailToEditForm(detail.data));
    }
  }, [detail.data]);

  const saveMutation = useMutation(
    (input: EmployeeEditFormData) => {
      if (!tenantId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return saveEmployeeEdit(
        employeeId ?? '',
        tenantId,
        input,
        roleKey,
        detail.data?.avatarUrl ?? null,
      );
    },
    { successMessage: 'Mitarbeitende:r gespeichert.' },
  );

  const save = useCallback(async () => {
    const result = await saveMutation.mutate(form);
    if (result) await detail.refresh();
    return result;
  }, [saveMutation, form, detail]);

  return {
    employee: detail.data,
    form,
    setForm,
    save,
    saving: saveMutation.loading,
    saveError: saveMutation.error,
    loading: detail.loading,
    error: detail.error,
    refresh: detail.refresh,
  };
}
