import { useCallback, useEffect, useState } from 'react';
import { updateEmployee, type EmployeeEditInput } from '@/lib/office/employeeFormService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useEmployeeDetail } from './useEmployeeDetail';
import { useMutation } from './core';

export function useEmployeeEdit(employeeId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;
  const detail = useEmployeeDetail(employeeId);

  const [form, setForm] = useState<EmployeeEditInput>({
    jobTitle: '',
    phone: '',
    department: '',
    notes: '',
  });

  useEffect(() => {
    if (detail.data) {
      setForm({
        jobTitle: detail.data.jobTitle ?? '',
        phone: detail.data.phone ?? '',
        department: detail.data.department ?? '',
        notes: detail.data.notes ?? '',
      });
    }
  }, [detail.data]);

  const saveMutation = useMutation(
    (input: EmployeeEditInput) => {
      if (!tenantId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      }
      return updateEmployee(employeeId ?? '', tenantId, input, roleKey);
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
    loading: detail.loading,
    error: detail.error,
    save,
    saveLoading: saveMutation.loading,
    saveError: saveMutation.error,
    successMessage: saveMutation.successMessage,
    notFound: detail.notFound,
  };
}
