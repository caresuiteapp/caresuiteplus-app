import { useCallback, useEffect, useRef, useState } from 'react';
import type { EmployeeEditFormData, EmployeeEditFormErrors } from '@/types/forms/employeeEditForm';
import { EMPTY_EMPLOYEE_EDIT_FORM } from '@/types/forms/employeeEditForm';
import { fetchEmployeeEditData, saveEmployeeEdit } from '@/lib/office/employeeEditService';
import { hasEmployeeEditErrors, validateEmployeeEditStep } from '@/lib/office/employeeEditValidation';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';

const STEPS = ['Stammdaten', 'Anstellung & Adresse', 'Qualifikationen', 'Zusammenfassung'];

export function useEmployeeEditWizard(employeeId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<EmployeeEditFormData>(EMPTY_EMPLOYEE_EDIT_FORM);
  const [errors, setErrors] = useState<EmployeeEditFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const submitLock = useRef(false);

  useEffect(() => {
    if (!employeeId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setNotFound(false);

    if (!tenantId) {
      setLoadError('Kein Mandant.');
      setLoading(false);
      return;
    }

    fetchEmployeeEditData(employeeId, tenantId, profile?.roleKey).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        if (result.error.includes('nicht gefunden') || result.error.includes('existiert nicht')) {
          setNotFound(true);
        } else {
          setLoadError(result.error);
        }
        return;
      }
      setForm(result.data.form);
      setCurrentAvatarUrl(result.data.employee.avatarUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [employeeId, tenantId, profile?.roleKey]);

  const updateField = useCallback(<K extends keyof EmployeeEditFormData>(
    key: K,
    value: EmployeeEditFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const nextStep = useCallback(() => {
    const stepErrors = validateEmployeeEditStep(step, form);
    if (hasEmployeeEditErrors(stepErrors)) {
      setErrors(stepErrors);
      return false;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    return true;
  }, [step, form]);

  const prevStep = useCallback(() => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const submit = useCallback(async () => {
    if (!employeeId || submitLock.current || submitting) return false;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);

    for (let s = 0; s < 3; s++) {
      const stepErrors = validateEmployeeEditStep(s, form);
      if (hasEmployeeEditErrors(stepErrors)) {
        setErrors(stepErrors);
        setStep(s);
        setSubmitting(false);
        submitLock.current = false;
        return false;
      }
    }

    if (!tenantId) {
      setSubmitError('Kein Mandant.');
      setSubmitting(false);
      submitLock.current = false;
      return false;
    }

    const result = await saveEmployeeEdit(
      employeeId,
      tenantId,
      form,
      profile?.roleKey,
      currentAvatarUrl,
    );

    setSubmitting(false);
    submitLock.current = false;

    if (result.ok) {
      setSaved(true);
      setCurrentAvatarUrl(result.data.avatarUrl);
      return true;
    }
    setSubmitError(result.error);
    return false;
  }, [employeeId, form, submitting, profile?.roleKey, tenantId, currentAvatarUrl]);

  return {
    steps: STEPS,
    step,
    form,
    errors,
    loading,
    loadError,
    notFound,
    submitting,
    submitError,
    saved,
    updateField,
    nextStep,
    prevStep,
    submit,
    isFirstStep: step === 0,
    isLastStep: step === STEPS.length - 1,
    isSuccess: saved,
  };
}
