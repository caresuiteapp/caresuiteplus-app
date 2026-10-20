import { useCallback, useRef, useState } from 'react';
import type { ClientFormData, ClientFormErrors } from '@/types/forms/clientForm';
import type { TaskCategory } from '@/types/modules/client';
import { EMPTY_CLIENT_FORM } from '@/types/forms/clientForm';
import { createClient, hasErrors, validateClientFormStep } from '@/lib/office';
import {
  hasProductionErrors,
  validateClientProductionStep,
} from '@/lib/services/clients/clientProductionValidation';
import { getServiceMode } from '@/lib/services/mode';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';

const DEMO_STEPS = [
  'Stammdaten',
  'Adresse & Kontakt',
  'Pflegegrad & Abrechnung',
  'Notfall & Aufgaben',
  'Einwilligungen',
];

const PRODUCTION_STEPS = ['Stammdaten', 'Adresse & Kontakt'];

function createInitialForm(): ClientFormData {
  return {
    ...EMPTY_CLIENT_FORM,
    status: getServiceMode() === 'supabase' ? 'aktiv' : EMPTY_CLIENT_FORM.status,
  };
}

export function useClientWizard() {
  const isProduction = getServiceMode() === 'supabase';
  const steps = isProduction ? PRODUCTION_STEPS : DEMO_STEPS;
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ClientFormData>(createInitialForm);
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const submitLock = useRef(false);

  const validateStep = useCallback(
    (stepIndex: number, data: ClientFormData) =>
      isProduction ? validateClientProductionStep(stepIndex, data) : validateClientFormStep(stepIndex, data),
    [isProduction],
  );

  const stepHasErrors = useCallback(
    (stepErrors: ClientFormErrors) =>
      isProduction ? hasProductionErrors(stepErrors) : hasErrors(stepErrors),
    [isProduction],
  );

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
    const stepErrors = validateStep(step, form);
    if (stepHasErrors(stepErrors)) {
      setErrors(stepErrors);
      return false;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, steps.length - 1));
    return true;
  }, [step, form, steps.length, stepHasErrors, validateStep]);

  const prevStep = useCallback(() => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const cancel = useCallback(() => {
    setForm(createInitialForm());
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

    for (let s = 0; s < steps.length - 1; s++) {
      const stepErrors = validateStep(s, form);
      if (stepHasErrors(stepErrors)) {
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

    const result = await createClient(tenantId, form, profile?.roleKey, {
      actorProfileId: profile?.id,
      actorDisplayName: profile?.displayName,
    });
    setSubmitting(false);
    submitLock.current = false;

    if (result.ok) {
      setCreatedId(result.data.id);
      return result.data.id;
    }
    setSubmitError(result.error);
    return null;
  }, [form, submitting, profile?.roleKey, profile?.id, profile?.displayName, tenantId, steps.length, stepHasErrors, validateStep]);

  return {
    steps,
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
    isLastStep: step === steps.length - 1,
    isSuccess: createdId !== null,
    isProduction,
  };
}
