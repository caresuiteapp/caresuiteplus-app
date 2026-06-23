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
import { upsertClientIntakeDraft } from '@/lib/clients/repositories/clientIntakeDraftRepository.supabase';
import { getServiceMode } from '@/lib/services/mode';
import {
  clearCostBearerTypeFields,
  clearDeselectedCostBearerTypes,
  COST_BEARER_FIELD_ERRORS,
  getCostBearerFieldValues,
  isCostBearerTypeKey,
  type CostBearerTypeKey,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import { validateCostBearerEntry } from '@/features/costCarriers/costCarrierService';
import {
  createEmptyIntakeForm,
  getIntakeStepsForContexts,
  getIntakeStepsForServiceTypeKeys,
  hasIntakeErrors,
  submitClientIntake,
  submitClientIntakeUpdate,
  validateIntakeStep,
} from '@/lib/clients/clientIntakeService';
import { getServiceIntakeSections, careContextsToServiceTypeKeys } from '@/lib/client/clientServiceTypeService';
import { fetchClientIntakeEditData } from '@/lib/clients/clientIntakeEditService';
import type { ClientIntakeErrors, ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';

const DRAFT_SAVE_DEBOUNCE_MS = 400;

function clampStepIndex(stepIndex: number, contexts: ClientCareContext[]): number {
  const steps = getIntakeStepsForContexts(contexts);
  const maxIndex = Math.max(0, steps.length - 1);
  return Math.min(Math.max(0, stepIndex), maxIndex);
}

export type ClientIntakeWizardMode = 'create' | 'edit';

export type UseClientIntakeWizardOptions = {
  mode?: ClientIntakeWizardMode;
  clientId?: string;
};

export function useClientIntakeWizard(options?: UseClientIntakeWizardOptions) {
  const mode = options?.mode ?? 'create';
  const editClientId = options?.clientId;
  const isEditMode = mode === 'edit' && !!editClientId;

  const { user, profile } = useAuth();
  const tenantId = useServiceTenantId();
  const userId = user?.id ?? profile?.id ?? null;

  const [form, setForm] = useState<ClientIntakeFormData>(createEmptyIntakeForm());
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<ClientIntakeErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(!isEditMode);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftClientId, setDraftClientId] = useState<string | null>(null);
  const [draftSaveFeedback, setDraftSaveFeedback] = useState<{
    message: string;
    variant: 'success' | 'warning';
  } | null>(null);
  const submitLock = useRef(false);
  const skipNextSave = useRef(false);
  const needsRemoteSyncOnLoad = useRef(false);
  const draftFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dbSectionsLoaded, setDbSectionsLoaded] = useState(false);
  const [dbSectionKeys, setDbSectionKeys] = useState<
    { sectionKey: string; isRequired: boolean; sortOrder: number }[]
  >([]);

  useEffect(() => {
    if (!tenantId || form.careContexts.length === 0) {
      setDbSectionKeys([]);
      setDbSectionsLoaded(true);
      return;
    }
    let cancelled = false;
    const keys = careContextsToServiceTypeKeys(form.careContexts);
    void getServiceIntakeSections(tenantId, keys).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setDbSectionKeys(result.data);
      }
      setDbSectionsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, form.careContexts]);

  const steps = useMemo(() => {
    if (!dbSectionsLoaded || form.careContexts.length === 0) {
      return getIntakeStepsForContexts(form.careContexts);
    }
    const keys = careContextsToServiceTypeKeys(form.careContexts);
    return getIntakeStepsForServiceTypeKeys(keys, form.careContexts, dbSectionKeys);
  }, [dbSectionsLoaded, dbSectionKeys, form.careContexts]);

  const currentSection = steps[stepIndex] ?? 'leistungsart';
  const contextHint = getSupportOnlyHint(form.careContexts);

  useEffect(() => {
    if (isEditMode) return;

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
        setDraftClientId(draft.clientId ?? null);
        setDraftRestored(true);

        if (
          getServiceMode() === 'supabase'
          && !draft.clientId
          && hasIntakeDraftContent(draft)
        ) {
          needsRemoteSyncOnLoad.current = true;
        }
      }

      setDraftLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, tenantId, isEditMode]);

  useEffect(() => {
    if (!isEditMode || !editClientId || !tenantId) {
      if (isEditMode && !editClientId) {
        setNotFound(true);
        setLoading(false);
      }
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setNotFound(false);

    void fetchClientIntakeEditData(editClientId, tenantId, profile?.roleKey).then((result) => {
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
      skipNextSave.current = true;
      setForm(result.data);
      setStepIndex(0);
    });

    return () => {
      cancelled = true;
    };
  }, [isEditMode, editClientId, tenantId, profile?.roleKey]);

  const persistDraft = useCallback(
    async (options?: { showFeedback?: boolean }) => {
      if (!userId || !tenantId) {
        if (options?.showFeedback) {
          setDraftSaveFeedback({
            message: 'Entwurf konnte nicht gespeichert werden.',
            variant: 'warning',
          });
        }
        return false;
      }

      const hasContent = hasIntakeDraftContent({ form, stepIndex });
      if (!hasContent) {
        if (options?.showFeedback) {
          setDraftSaveFeedback({
            message: 'Kein Entwurf zum Speichern.',
            variant: 'warning',
          });
        }
        return false;
      }

      let nextClientId = draftClientId;

      if (getServiceMode() === 'supabase') {
        const remoteResult = await upsertClientIntakeDraft(tenantId, form, {
          clientId: draftClientId,
          actorProfileId: profile?.id ?? user?.id ?? null,
        });

        if (!remoteResult.ok) {
          if (options?.showFeedback) {
            setDraftSaveFeedback({
              message: remoteResult.error ?? 'Entwurf konnte nicht gespeichert werden.',
              variant: 'warning',
            });
          }
          return false;
        }

        nextClientId = remoteResult.data.id;
        if (nextClientId !== draftClientId) {
          setDraftClientId(nextClientId);
        }
      }

      await saveClientIntakeDraft(userId, tenantId, {
        form,
        stepIndex,
        clientId: nextClientId,
      });

      if (options?.showFeedback) {
        setDraftSaveFeedback({
          message: 'Entwurf gespeichert.',
          variant: 'success',
        });

        if (draftFeedbackTimerRef.current) {
          clearTimeout(draftFeedbackTimerRef.current);
        }
        draftFeedbackTimerRef.current = setTimeout(() => setDraftSaveFeedback(null), 2500);
      }

      return true;
    },
    [draftClientId, form, profile?.id, stepIndex, tenantId, user?.id, userId],
  );

  useEffect(() => {
    if (isEditMode || !draftLoaded || !userId || !tenantId || createdId) return;

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const timer = setTimeout(() => {
      void persistDraft();
    }, DRAFT_SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [form, stepIndex, draftLoaded, userId, tenantId, createdId, persistDraft, isEditMode]);

  useEffect(() => {
    if (!draftLoaded || !needsRemoteSyncOnLoad.current) return;
    needsRemoteSyncOnLoad.current = false;
    void persistDraft();
  }, [draftLoaded, persistDraft]);

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

  const updateBillingTypes = useCallback((nextTypes: string[]) => {
    setForm((prev) => ({
      ...prev,
      billingTypes: nextTypes,
      billingType: nextTypes[0] ?? '',
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.billingTypes;
      delete next.billingType;
      return next;
    });
  }, []);

  const updateCostBearerTypes = useCallback((nextTypes: string[]) => {
    setForm((prev) => ({
      ...clearDeselectedCostBearerTypes(prev, nextTypes),
      costBearerType: nextTypes[0] ?? '',
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.costBearerTypes;
      delete next.costBearerType;
      for (const key of Object.values(COST_BEARER_FIELD_ERRORS)) {
        delete next[key];
      }
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
    setDraftClientId(null);
  }, []);

  const discardDraft = useCallback(async () => {
    if (userId && tenantId) {
      await clearClientIntakeDraft(userId, tenantId);
    }
    skipNextSave.current = true;
    resetWizard();
  }, [resetWizard, tenantId, userId]);

  const saveDraft = useCallback(async () => {
    await persistDraft({ showFeedback: true });
  }, [persistDraft]);

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

  const goToStep = useCallback((index: number) => {
    if (index < 0 || index >= steps.length) return;
    setStepIndex(index);
    setErrors({});
  }, [steps.length]);

  const stepStatuses = useMemo(() => {
    return steps.map((section, index) => {
      if (index === stepIndex) return 'active' as const;
      const stepErrors = validateIntakeStep(section, form);
      if (index < stepIndex) {
        return hasIntakeErrors(stepErrors) ? ('error' as const) : ('completed' as const);
      }
      return 'pending' as const;
    });
  }, [form, stepIndex, steps]);

  const submit = useCallback(async () => {
    if (submitLock.current || submitting || !tenantId) return null;
    if (isEditMode && !editClientId) return null;
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

    const result = isEditMode
      ? await submitClientIntakeUpdate(tenantId, editClientId!, form, {
          actorProfileId: profile?.id ?? user?.id ?? null,
          actorRoleKey: profile?.roleKey ?? user?.roleKey ?? null,
        })
      : await submitClientIntake(tenantId, form, {
          actorProfileId: profile?.id ?? user?.id ?? null,
          draftClientId,
          actorRoleKey: profile?.roleKey ?? user?.roleKey ?? null,
        });
    setSubmitting(false);
    submitLock.current = false;

    if (result.ok) {
      if (!isEditMode && userId) {
        await clearClientIntakeDraft(userId, tenantId);
      }
      skipNextSave.current = true;
      setCreatedId(result.data.id);
      return result.data.id;
    }
    setSubmitError(result.error);
    return null;
  }, [
    draftClientId,
    editClientId,
    form,
    isEditMode,
    profile?.id,
    steps,
    submitting,
    tenantId,
    user?.id,
    userId,
  ]);

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
    loading,
    loadError,
    notFound,
    isEditMode,
    draftLoaded,
    draftRestored,
    draftSaveFeedback,
    hasPersistedDraft: draftRestored || hasIntakeDraftContent({ form, stepIndex }),
    updateField,
    updateBillingTypes,
    updateCostBearerTypes,
    commitCostBearer,
    removeCostBearer,
    replaceForm,
    toggleCareContext,
    toggleArrayField,
    nextStep,
    prevStep,
    goToStep,
    stepStatuses,
    submit,
    discardDraft,
    saveDraft,
    resetWizard,
    isFirstStep: stepIndex === 0,
    isLastStep: stepIndex === steps.length - 1,
    isSuccess: createdId !== null,
  };
}
