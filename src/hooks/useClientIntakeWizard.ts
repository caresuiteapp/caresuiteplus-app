import { useCallback, useMemo, useRef, useState } from 'react';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import {
  INTAKE_SECTION_LABELS,
  getSupportOnlyHint,
  type IntakeSectionKey,
} from '@/lib/clients/clientIntakeFieldRules';
import {
  createEmptyIntakeForm,
  getIntakeStepsForContexts,
  hasIntakeErrors,
  submitClientIntake,
  validateIntakeStep,
} from '@/lib/clients/clientIntakeService';
import type { ClientIntakeErrors, ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { useServiceTenantId } from '@/hooks/useTenantId';

export function useClientIntakeWizard() {
  const tenantId = useServiceTenantId();
  const [form, setForm] = useState<ClientIntakeFormData>(createEmptyIntakeForm());
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<ClientIntakeErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const submitLock = useRef(false);

  const steps = useMemo(
    () => getIntakeStepsForContexts(form.careContexts),
    [form.careContexts],
  );

  const currentSection = steps[stepIndex] ?? 'leistungsart';
  const contextHint = getSupportOnlyHint(form.careContexts);

  const updateField = useCallback(
    <K extends keyof ClientIntakeFormData>(key: K, value: ClientIntakeFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    },
    [],
  );

  const toggleCareContext = useCallback((ctx: ClientCareContext) => {
    setForm((prev) => {
      const has = prev.careContexts.includes(ctx);
      const careContexts = has
        ? prev.careContexts.filter((c) => c !== ctx)
        : [...prev.careContexts, ctx];
      return { ...prev, careContexts };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.careContexts;
      return next;
    });
  }, []);

  const toggleArrayField = useCallback((key: 'supportWishes' | 'preferredTimes' | 'assignedModules', value: string) => {
    setForm((prev) => {
      const arr = prev[key];
      const has = arr.includes(value);
      return {
        ...prev,
        [key]: has ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }, []);

  const nextStep = useCallback(() => {
    const stepErrors = validateIntakeStep(currentSection, form);
    if (hasIntakeErrors(stepErrors)) {
      setErrors(stepErrors);
      return false;
    }
    setErrors({});
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    return true;
  }, [currentSection, form, steps.length]);

  const prevStep = useCallback(() => {
    setErrors({});
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const submit = useCallback(async () => {
    if (submitLock.current || submitting || !tenantId) return null;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);

    for (const section of steps) {
      const stepErrors = validateIntakeStep(section, form);
      if (hasIntakeErrors(stepErrors)) {
        setErrors(stepErrors);
        setStepIndex(steps.indexOf(section));
        setSubmitting(false);
        submitLock.current = false;
        return null;
      }
    }

    const result = await submitClientIntake(tenantId, form);
    setSubmitting(false);
    submitLock.current = false;

    if (result.ok) {
      setCreatedId(result.data.id);
      return result.data.id;
    }
    setSubmitError(result.error);
    return null;
  }, [form, steps, submitting, tenantId]);

  return {
    form,
    errors,
    steps,
    stepLabels: steps.map((s) => INTAKE_SECTION_LABELS[s]),
    stepIndex,
    currentSection,
    contextHint,
    submitting,
    submitError,
    createdId,
    updateField,
    toggleCareContext,
    toggleArrayField,
    nextStep,
    prevStep,
    submit,
    isFirstStep: stepIndex === 0,
    isLastStep: stepIndex === steps.length - 1,
    isSuccess: createdId !== null,
  };
}
