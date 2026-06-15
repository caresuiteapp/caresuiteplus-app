import { useCallback, useRef, useState } from 'react';
import type { ClientFormData, ClientFormErrors } from '@/types/forms/clientForm';
import type { TaskCategory } from '@/types/modules/client';
import { EMPTY_CLIENT_FORM } from '@/types/forms/clientForm';
import { createClient, hasErrors, validateClientFormStep } from '@/lib/office';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';

const STEPS = [
  'Stammdaten',
  'Adresse & Kontakt',
  'Pflegegrad & Abrechnung',
  'Notfall & Aufgaben',
  'Einwilligungen',
];

export function useClientWizard() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ClientFormData>(EMPTY_CLIENT_FORM);
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const submitLock = useRef(false);

  const updateField = useCallback(<K extends keyof ClientFormData>(key: K, value: ClientFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const toggleTaskCategory = useCallback((category: TaskCategory) => {
    setForm((prev) => {
      const has = prev.taskCategories.includes(category);
      return {
        ...prev,
        taskCategories: has
          ? prev.taskCategories.filter((c) => c !== category)
          : [...prev.taskCategories, category],
      };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.taskCategories;
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

  const cancel = useCallback(() => {
    setForm(EMPTY_CLIENT_FORM);
    setStep(0);
    setErrors({});
    setSubmitError(null);
    setCreatedId(null);
  }, []);

  const submit = useCallback(async () => {
    if (submitLock.current || submitting) return null;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);

    for (let s = 0; s < STEPS.length - 1; s++) {
      const stepErrors = validateClientFormStep(s, form);
      if (hasErrors(stepErrors)) {
        setErrors(stepErrors);
        setStep(s);
        setSubmitting(false);
        submitLock.current = false;
        return null;
      }
    }

    if (!tenantId) {
      setSubmitError('Kein Mandant.');
      setSubmitting(false);
      submitLock.current = false;
      return null;
    }

    const result = await createClient(tenantId, form, profile?.roleKey);
    setSubmitting(false);
    submitLock.current = false;

    if (result.ok) {
      setCreatedId(result.data.id);
      return result.data.id;
    }
    setSubmitError(result.error);
    return null;
  }, [form, submitting, profile?.roleKey, tenantId]);

  return {
    steps: STEPS,
    step,
    form,
    errors,
    submitting,
    submitError,
    createdId,
    updateField,
    toggleTaskCategory,
    nextStep,
    prevStep,
    cancel,
    submit,
    isFirstStep: step === 0,
    isLastStep: step === STEPS.length - 1,
    isSuccess: createdId !== null,
  };
}
