import { useCallback, useRef, useState } from 'react';
import type { EmployeeFormData, EmployeeFormErrors } from '@/types/forms/employeeForm';
import { EMPTY_EMPLOYEE_FORM } from '@/types/forms/employeeForm';
import { createEmployee, hasEmployeeErrors, validateEmployeeForm } from '@/lib/office';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

export function useEmployeeWizard() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [form, setForm] = useState<EmployeeFormData>(EMPTY_EMPLOYEE_FORM);
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const submitLock = useRef(false);

  const updateField = useCallback(<K extends keyof EmployeeFormData>(key: K, value: EmployeeFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const submit = useCallback(async () => {
    if (submitLock.current || submitting) return null;
    const stepErrors = validateEmployeeForm(form);
    if (hasEmployeeErrors(stepErrors)) {
      setErrors(stepErrors);
      return null;
    }
    if (!tenantId) {
      setSubmitError('Kein Mandant.');
      return null;
    }
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    const result = await createEmployee(tenantId, form, profile?.roleKey);
    setSubmitting(false);
    submitLock.current = false;
    if (result.ok) {
      setCreatedId(result.data.id);
      return result.data.id;
    }
    setSubmitError(result.error);
    return null;
  }, [form, submitting, tenantId, profile?.roleKey]);

  const cancel = useCallback(() => {
    setForm(EMPTY_EMPLOYEE_FORM);
    setErrors({});
    setSubmitError(null);
    setCreatedId(null);
  }, []);

  return {
    form,
    errors,
    submitting,
    submitError,
    createdId,
    updateField,
    submit,
    cancel,
    isSuccess: createdId != null,
  };
}
