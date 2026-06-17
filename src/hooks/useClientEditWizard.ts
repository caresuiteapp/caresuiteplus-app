import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientEditFormData, ClientEditFormErrors } from '@/types/forms/clientEditForm';
import { EMPTY_CLIENT_EDIT_FORM } from '@/types/forms/clientEditForm';
import { fetchClientEditData, saveClientEdit } from '@/lib/clients/clientEditService';
import { hasClientEditErrors, validateClientEditStep } from '@/lib/clients/clientEditValidation';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';

const STEPS = ['Stammdaten', 'Adresse & Kontakt', 'Pflege & Kontext', 'Zusammenfassung'];

export function useClientEditWizard(clientId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ClientEditFormData>(EMPTY_CLIENT_EDIT_FORM);
  const [errors, setErrors] = useState<ClientEditFormErrors>({});
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

    fetchClientEditData(clientId, tenantId, profile?.roleKey).then((result) => {
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
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, tenantId, profile?.roleKey]);

  const updateField = useCallback(<K extends keyof ClientEditFormData>(key: K, value: ClientEditFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const nextStep = useCallback(() => {
    const stepErrors = validateClientEditStep(step, form);
    if (hasClientEditErrors(stepErrors)) {
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
      const stepErrors = validateClientEditStep(s, form);
      if (hasClientEditErrors(stepErrors)) {
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

    const result = await saveClientEdit(
      clientId,
      tenantId,
      form,
      profile?.roleKey,
      profile?.id,
    );

    setSubmitting(false);
    submitLock.current = false;

    if (result.ok) {
      setSaved(true);
      return true;
    }
    setSubmitError(result.error);
    return false;
  }, [clientId, form, submitting, profile?.roleKey, profile?.id, tenantId]);

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
