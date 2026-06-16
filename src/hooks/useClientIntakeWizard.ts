import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClientCareContext } from '@/lib/clients/clientIntakeFieldRules';
import {
  INTAKE_SECTION_LABELS,
  getSupportOnlyHint,
  type IntakeSectionKey,
} from '@/lib/clients/clientIntakeFieldRules';
import {
  clearClientIntakeDraft,
  hasIntakeDraftContent,
  loadClientIntakeDraft,
  saveClientIntakeDraft,
} from '@/lib/clients/clientIntakeDraftStorage';
import {
  clearCostBearerTypeFields,
  COST_BEARER_FIELD_ERRORS,
  getCostBearerFieldValues,
  isCostBearerTypeKey,
  type CostBearerTypeKey,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import { validateCostBearerEntry } from '@/features/costCarriers/costCarrierService';
import {
  createEmptyIntakeForm,
  getIntakeStepsForContexts,
  hasIntakeErrors,
  submitClientIntake,
  validateIntakeStep,
} from '@/lib/clients/clientIntakeService';
import type { ClientIntakeErrors, ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';

const DRAFT_SAVE_DEBOUNCE_MS = 400;

function clampStepIndex(stepIndex: number, contexts: ClientCareContext[]): number {
  const steps = getIntakeStepsForContexts(contexts);
  const maxIndex = Math.max(0, steps.length - 1);
  return Math.min(Math.max(0, stepIndex), maxIndex);
}

export function useClientIntakeWizard() {
  const { user, profile } = useAuth();
  const tenantId = useServiceTenantId();
  const userId = user?.id ?? profile?.id ?? null;

  const [form, setForm] = useState<ClientIntakeFormData>(createEmptyIntakeForm());
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<ClientIntakeErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSaveFeedback, setDraftSaveFeedback] = useState<{
    message: string;
    variant: 'success' | 'warning';
  } | null>(null);
  const submitLock = useRef(false);
  const skipNextSave = useRef(false);
  const draftFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = useMemo(
    () => getIntakeStepsForContexts(form.careContexts),
    [form.careContexts],
  );

  const currentSection = steps[stepIndex] ?? 'leistungsart';
  const contextHint = getSupportOnlyHint(form.careContexts);

  useEffect(() => {
    if (!userId || !tenantId) {
      setDraftLoaded(true);
      return;
    }

    let cancelled = false;

    void loadClientIntakeDraft(userId, tenantId).then((draft) => {
      if (cancelled) return;

      if (draft) {
        skipNextSave.current = true;
        setForm(draft.form);
        setStepIndex(clampStepIndex(draft.stepIndex, draft.form.careContexts));
        setDraftRestored(true);
      }

      setDraftLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, tenantId]);

  useEffect(() => {
    if (!draftLoaded || !userId || !tenantId || createdId) return;

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const timer = setTimeout(() => {
      void saveClientIntakeDraft(userId, tenantId, { form, stepIndex });
    }, DRAFT_SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [form, stepIndex, draftLoaded, userId, tenantId, createdId]);

  useEffect(() => {
    if (stepIndex <= steps.length - 1) return;
    setStepIndex(Math.max(0, steps.length - 1));
  }, [stepIndex, steps.length]);

  useEffect(() => {
    return () => {
      if (draftFeedbackTimerRef.current) {
        clearTimeout(draftFeedbackTimerRef.current);
      }
    };
  }, []);

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

  const replaceForm = useCallback((nextForm: ClientIntakeFormData) => {
    setForm(nextForm);
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(nextForm)) {
        delete next[key];
      }
      return next;
    });
  }, []);

  const updateCostBearerTypes = useCallback((nextTypes: string[]) => {
    setForm((prev) => ({ ...prev, costBearerTypes: nextTypes }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.costBearerTypes;
      return next;
    });
  }, []);

  const commitCostBearer = useCallback(() => {
    setForm((prev) => {
      if (!isCostBearerTypeKey(prev.activeCostBearerType)) return prev;
      const type = prev.activeCostBearerType;
      const validationError = validateCostBearerEntry(type, getCostBearerFieldValues(prev, type));
      if (validationError) {
        setErrors((current) => ({ ...current, costBearerDraft: validationError }));
        return prev;
      }

      setErrors((current) => {
        const next = { ...current };
        delete next.costBearerDraft;
        delete next.costBearerTypes;
        delete next[COST_BEARER_FIELD_ERRORS[type]];
        return next;
      });

      if (prev.costBearerTypes.includes(type)) {
        return prev;
      }

      return {
        ...prev,
        costBearerTypes: [...prev.costBearerTypes, type],
      };
    });
  }, []);

  const removeCostBearer = useCallback((type: CostBearerTypeKey) => {
    setForm((prev) => clearCostBearerTypeFields(prev, type));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[COST_BEARER_FIELD_ERRORS[type]];
      delete next.costBearerTypes;
      return next;
    });
  }, []);

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

  const resetWizard = useCallback(() => {
    setForm(createEmptyIntakeForm());
    setStepIndex(0);
    setErrors({});
    setSubmitError(null);
    setDraftRestored(false);
  }, []);

  const discardDraft = useCallback(async () => {
    if (userId && tenantId) {
      await clearClientIntakeDraft(userId, tenantId);
    }
    skipNextSave.current = true;
    resetWizard();
  }, [resetWizard, tenantId, userId]);

  const saveDraft = useCallback(async () => {
    if (!userId || !tenantId) {
      setDraftSaveFeedback({
        message: 'Entwurf konnte nicht gespeichert werden.',
        variant: 'warning',
      });
      return;
    }

    await saveClientIntakeDraft(userId, tenantId, { form, stepIndex });

    const hasContent = hasIntakeDraftContent({ form, stepIndex });
    setDraftSaveFeedback({
      message: hasContent ? 'Entwurf gespeichert.' : 'Kein Entwurf zum Speichern.',
      variant: hasContent ? 'success' : 'warning',
    });

    if (draftFeedbackTimerRef.current) {
      clearTimeout(draftFeedbackTimerRef.current);
    }
    draftFeedbackTimerRef.current = setTimeout(() => setDraftSaveFeedback(null), 2500);
  }, [form, stepIndex, tenantId, userId]);

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

    const result = await submitClientIntake(tenantId, form, { actorProfileId: profile?.id ?? user?.id ?? null });
    setSubmitting(false);
    submitLock.current = false;

    if (result.ok) {
      if (userId) {
        await clearClientIntakeDraft(userId, tenantId);
      }
      skipNextSave.current = true;
      setCreatedId(result.data.id);
      return result.data.id;
    }
    setSubmitError(result.error);
    return null;
  }, [form, profile?.id, steps, submitting, tenantId, user?.id]);

  return {
    form,
    errors,
    steps,
    stepLabels: steps.map((s) => INTAKE_SECTION_LABELS[s]),
    stepIndex,
    currentSection,
    contextHint,
    tenantId,
    submitting,
    submitError,
    createdId,
    draftLoaded,
    draftRestored,
    draftSaveFeedback,
    hasPersistedDraft: draftRestored || hasIntakeDraftContent({ form, stepIndex }),
    updateField,
    updateCostBearerTypes,
    commitCostBearer,
    removeCostBearer,
    replaceForm,
    toggleCareContext,
    toggleArrayField,
    nextStep,
    prevStep,
    submit,
    discardDraft,
    saveDraft,
    resetWizard,
    isFirstStep: stepIndex === 0,
    isLastStep: stepIndex === steps.length - 1,
    isSuccess: createdId !== null,
  };
}
