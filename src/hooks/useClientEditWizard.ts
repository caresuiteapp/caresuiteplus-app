import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientFormData, ClientFormErrors } from '@/types/forms/clientForm';
import { EMPTY_CLIENT_FORM } from '@/types/forms/clientForm';
import { fetchClientDetail, hasErrors, updateClient, validateClientFormStep } from '@/lib/office';
import { mapClientDetailToForm } from '@/lib/office/clientFormMappers';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';

const STEPS = ['Stammdaten', 'Adresse', 'Pflege', 'Zusammenfassung'];

export function useClientEditWizard(clientId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ClientFormData>(EMPTY_CLIENT_FORM);
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    if (!clientId) {
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

    fetchClientDetail(clientId, tenantId, profile?.roleKey).then((result) => {
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
      setForm(mapClientDetailToForm(result.data));
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, tenantId, profile?.roleKey]);

  const updateField = useCallback(<K extends keyof ClientFormData>(key: K, value: ClientFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const nextStep = useCallback(() => {
    const stepErrors = validateClientFormStep(step, form);
    if (hasErrors(stepErrors)) {
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
    if (!clientId || submitLock.current || submitting) return false;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);

    for (let s = 0; s < 3; s++) {
      const stepErrors = validateClientFormStep(s, form);
      if (hasErrors(stepErrors)) {
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

    const result = await updateClient(
      clientId,
      tenantId,
      {
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth || null,
        street: form.street,
        zip: form.zip,
        city: form.city,
        phone: form.phone || null,
        email: form.email || null,
        careLevel: form.careLevel,
        notes: form.notes || null,
        primaryContactPhone: form.phone || null,
      },
      profile?.roleKey,
    );

    setSubmitting(false);
    submitLock.current = false;

    if (result.ok) {
      setSaved(true);
      return true;
    }
    setSubmitError(result.error);
    return false;
  }, [clientId, form, submitting, profile?.roleKey]);

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
