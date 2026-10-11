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
import type { ClientFundingSourceKey } from '@/types/clients/clientFundingSource';
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
  /** Limits validation and persistence when editing one record section. */
  editSections?: IntakeSectionKey[];
  /** Existing records may be incomplete and must remain partially editable. */
  validateOnSubmit?: boolean;
};

export function useClientIntakeWizard(options?: UseClientIntakeWizardOptions) {
  const mode = options?.mode ?? 'create';
  const editClientId = options?.clientId;
  const editSections = options?.editSections;
  const validateOnSubmit = options?.validateOnSubmit ?? true;
  const includeIntakeDocuments = Boolean(
    editSections?.includes('vertraege_einwilligungen'),
  );
  const isEditMode = mode === 'edit';

  const { user, profile } = useAuth();
  const tenantId = useServiceTenantId();
  const userId = user?.id ?? profile?.id ?? null;
  const scopeKey = JSON.stringify([tenantId, userId, profile?.id, profile?.roleKey, mode, editClientId, editSections]);
  const scope = useMemo(() => ({
    submitLock: { current: false }, skipNextSave: { current: false }, needsRemoteSyncOnLoad: { current: false },
    clientId: null as string | null, epoch: 0, completed: false, discarding: false,
    savedSnapshot: '',
    draftTail: Promise.resolve() as Promise<unknown>,
  }), [scopeKey]);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = useCallback(() => mounted.current && activeScope.current === scope, [scope]);

  const [form, setForm] = useState<ClientIntakeFormData>(createEmptyIntakeForm());
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<ClientIntakeErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSaveFeedback, setDraftSaveFeedback] = useState<{
    message: string;
    variant: 'success' | 'warning';
  } | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const submitLock = scope.submitLock;
  const skipNextSave = scope.skipNextSave;
  const needsRemoteSyncOnLoad = scope.needsRemoteSyncOnLoad;
  const draftFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dbSectionsLoaded, setDbSectionsLoaded] = useState(false);
  const [dbSectionKeys, setDbSectionKeys] = useState<
    { sectionKey: string; isRequired: boolean; sortOrder: number }[]
  >([]);
  const previousScope = useRef(scope);
  if (previousScope.current !== scope) {
    previousScope.current = scope;
    if (draftFeedbackTimerRef.current) clearTimeout(draftFeedbackTimerRef.current);
    setForm(createEmptyIntakeForm()); setStepIndex(0); setErrors({});
    setSubmitting(false); setSubmitError(null); setCreatedId(null);
    setLoading(isEditMode); setLoadError(null); setNotFound(false);
    setDraftLoaded(false); setDraftRestored(false);
    setDraftSaveFeedback(null); setDraftSaving(false); setDiscardingDraft(false);
    setDbSectionsLoaded(false); setDbSectionKeys([]);
  }

  useEffect(() => {
    if (!tenantId || form.careContexts.length === 0) {
      setDbSectionKeys([]);
      setDbSectionsLoaded(true);
      return;
    }
    let cancelled = false;
    setDbSectionsLoaded(false);
    setDbSectionKeys([]);
    const keys = careContextsToServiceTypeKeys(form.careContexts);
    void getServiceIntakeSections(tenantId, keys).then((result) => {
      if (cancelled || !current()) return;
      if (result.ok) {
        setDbSectionKeys(result.data);
      }
      setDbSectionsLoaded(true);
    }).catch(() => { if (!cancelled && current()) setDbSectionsLoaded(true); });
    return () => {
      cancelled = true;
    };
  }, [tenantId, form.careContexts, current]);

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
    setDraftLoaded(false);

    void loadClientIntakeDraft(userId, tenantId).then((draft) => {
      if (cancelled || !current()) return;

      if (draft) {
        skipNextSave.current = true;
        setForm(draft.form);
        setStepIndex(clampStepIndex(draft.stepIndex, draft.form.careContexts));
        scope.clientId = draft.clientId ?? null;
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
    }).catch(() => {
      if (!cancelled && current()) {
        setLoadError('Gespeicherter Entwurf konnte nicht geladen werden. Ihre gespeicherten Angaben werden nicht überschrieben. Bitte erneut versuchen.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId, tenantId, isEditMode, scope, current, loadRevision]);

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

    void fetchClientIntakeEditData(editClientId, tenantId, profile?.roleKey, {
      includeIntakeDocuments,
    }).then((result) => {
      if (cancelled || !current()) return;
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
    }).catch(() => {
      if (!cancelled && current()) { setLoading(false); setLoadError('Klient:in konnte nicht geladen werden. Bitte erneut versuchen.'); }
    });

    return () => {
      cancelled = true;
    };
  }, [isEditMode, editClientId, includeIntakeDocuments, tenantId, profile?.roleKey, current, loadRevision]);

  const persistDraft = useCallback(
    async (options?: { showFeedback?: boolean }) => {
      if (isEditMode || !current() || scope.completed || scope.discarding || submitLock.current) return false;
      if (!userId || !tenantId || !hasIntakeDraftContent({ form, stepIndex })) {
        if (options?.showFeedback) setDraftSaveFeedback({ message: 'Kein Entwurf zum Speichern oder keine aktive Mandantensitzung.', variant: 'warning' });
        return false;
      }
      const epoch = scope.epoch;
      const usable = () => current() && scope.epoch === epoch && !scope.completed && !scope.discarding;
      const write = scope.draftTail.then(async () => {
        if (!usable()) return false;
        setDraftSaving(true);
        let localSaved = false;
        try {
          if (getServiceMode() === 'supabase' && !scope.clientId) {
            const draftId = (await import('expo-crypto')).randomUUID();
            if (!usable()) return false;
            scope.clientId = draftId;
          }
          // The full form survives a server/document failure, not just its name.
          await saveClientIntakeDraft(userId, tenantId, { form, stepIndex, clientId: scope.clientId });
          localSaved = true;
          if (!usable()) return false;
          if (getServiceMode() === 'supabase') {
            const containsSignedDocument = form.intakeDocuments.some((document) =>
              document.status === 'signed' || document.status === 'finalized' || Boolean(document.finalizedAt || document.finalizedHtml) ||
              Object.values(document.signatures).some((signature) => Boolean(signature?.dataUrl)));
            if (containsSignedDocument) {
              throw new Error('Die Serversicherung unterschriebener oder finaler Aufnahmeunterlagen ist gesperrt, bis der verifizierte atomare Serverabschluss angebunden ist. Unterschriften und Formular bleiben in diesem lokalen Entwurf erhalten.');
            }
            const remoteResult = await upsertClientIntakeDraft(tenantId, form, {
              clientId: scope.clientId, actorProfileId: profile?.id ?? user?.id ?? null,
            });
            if (!usable()) return false;
            if (!remoteResult.ok) throw new Error(remoteResult.error ?? 'Serversicherung nicht bestätigt.');
            scope.clientId = remoteResult.data.id;
            await saveClientIntakeDraft(userId, tenantId, { form, stepIndex, clientId: scope.clientId });
            if (!usable()) return false;
          }
          if (!usable()) return false;
          scope.savedSnapshot = JSON.stringify([form, stepIndex]);
          setDraftSaveFeedback({ message: 'Entwurf gespeichert.', variant: 'success' });
          return true;
        } catch (error) {
          if (usable()) setDraftSaveFeedback({
            message: `${localSaved ? 'Entwurf lokal erhalten. ' : 'Entwurf konnte nicht lokal gespeichert werden. '}${error instanceof Error ? error.message : 'Bitte erneut speichern.'}`,
            variant: 'warning',
          });
          return false;
        } finally {
          if (current()) setDraftSaving(false);
        }
      });
      scope.draftTail = write.catch(() => false);
      return write;
    },
    [current, form, isEditMode, profile?.id, scope, stepIndex, tenantId, user?.id, userId],
  );

  useEffect(() => {
    if (isEditMode || !draftLoaded || !userId || !tenantId || createdId || submitting || discardingDraft) return;

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const timer = setTimeout(() => {
      void persistDraft();
    }, DRAFT_SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [form, stepIndex, draftLoaded, userId, tenantId, createdId, persistDraft, isEditMode, submitting, discardingDraft]);

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
      // Intake-document errors are derived from the complete document package
      // and do not share a direct form-field key. Clear stale validation after
      // signatures, selections or automatic finalization change the package.
      for (const key of Object.keys(next)) {
        if (key.startsWith('intake')) delete next[key];
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

  const updateFundingSources = useCallback((fundingSources: ClientFundingSourceKey[]) => {
    const selfPay = fundingSources.includes('selbstzahler');
    const hasStatutory = fundingSources.some((source) => source !== 'selbstzahler');
    const billingTypes = selfPay && hasStatutory
      ? ['kombi']
      : selfPay
        ? ['selbstzahler']
        : hasStatutory
          ? ['pflegekasse']
          : [];
    setForm((prev) => ({
      ...prev,
      fundingSources,
      selfPay,
      billingTypes,
      billingType: billingTypes[0] ?? '',
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.fundingSources;
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
    scope.clientId = null;
    scope.completed = false;
    scope.savedSnapshot = '';
    setCreatedId(null);
    setDraftSaveFeedback(null);
  }, [scope]);

  const discardDraft = useCallback(async () => {
    if (!current() || submitLock.current || scope.discarding) return;
    scope.epoch++; scope.discarding = true; setDiscardingDraft(true);
    skipNextSave.current = true;
    try {
      await scope.draftTail;
      if (!current()) return;
      if (userId && tenantId) await clearClientIntakeDraft(userId, tenantId);
      if (!current()) return;
      resetWizard();
    } catch {
      if (current()) setDraftSaveFeedback({ message: 'Entwurf konnte nicht entfernt werden. Ihre Angaben bleiben erhalten.', variant: 'warning' });
    } finally {
      scope.discarding = false;
      if (current()) setDiscardingDraft(false);
    }
  }, [current, resetWizard, scope, tenantId, userId]);

  const saveDraft = useCallback(async () => {
    return persistDraft({ showFeedback: true });
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

  const submit = useCallback(async (sectionsOverride?: IntakeSectionKey[]) => {
    if (!current() || submitLock.current || submitting || scope.completed || scope.discarding || !draftLoaded && !isEditMode || loading || notFound || loadError) return null;
    if (!tenantId || (isEditMode && !editClientId)) {
      setSubmitError('Mandant oder Klienten-ID fehlt. Bitte den Datensatz erneut öffnen.'); return null;
    }
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    const submittedSections = sectionsOverride?.length
      ? sectionsOverride
      : editSections;

    if (validateOnSubmit) {
      const sectionsToValidate =
        isEditMode && submittedSections?.length ? submittedSections : steps;
      for (const section of sectionsToValidate) {
        const stepErrors = validateIntakeStep(section, form);
        if (hasIntakeErrors(stepErrors)) {
          setErrors(stepErrors);
          setStepIndex(Math.max(0, steps.indexOf(section)));
          setSubmitting(false);
          submitLock.current = false;
          return null;
        }
      }
    }

    try {
      await scope.draftTail;
      if (!current()) return null;
      const result = isEditMode
        ? await submitClientIntakeUpdate(tenantId, editClientId!, form, {
            actorProfileId: profile?.id ?? user?.id ?? null,
            actorRoleKey: profile?.roleKey ?? user?.roleKey ?? null,
            sections: submittedSections,
          })
        : await submitClientIntake(tenantId, form, {
            actorProfileId: profile?.id ?? user?.id ?? null,
            draftClientId: scope.clientId,
            actorRoleKey: profile?.roleKey ?? user?.roleKey ?? null,
          });

      if (!current()) return null;
      if (result.ok) {
        scope.completed = true;
        skipNextSave.current = true;
        setCreatedId(result.data.id);
        if (!isEditMode && userId) {
          try { await clearClientIntakeDraft(userId, tenantId); }
          catch { if (current()) setDraftSaveFeedback({ message: 'Aufnahme gespeichert; der lokale Entwurf konnte nicht entfernt werden.', variant: 'warning' }); }
        }
        return current() ? result.data.id : null;
      }
      if (!isEditMode && 'recoverableClientId' in result && typeof result.recoverableClientId === 'string') {
        scope.clientId = result.recoverableClientId;
        if (userId) await saveClientIntakeDraft(userId, tenantId, { form, stepIndex, clientId: scope.clientId });
      }
      if (current()) setSubmitError(result.error);
      return null;
    } catch (error) {
      if (current()) setSubmitError(
        error instanceof Error
          ? error.message
          : 'Änderungen konnten nicht gespeichert werden.',
      );
      return null;
    } finally {
      if (current()) setSubmitting(false);
      submitLock.current = false;
    }
  }, [
    current, scope, draftLoaded, loading, notFound, loadError,
    editClientId,
    editSections,
    form,
    isEditMode,
    profile?.id,
    profile?.roleKey,
    stepIndex,
    steps,
    submitting,
    tenantId,
    user?.id,
    user?.roleKey,
    userId,
    validateOnSubmit,
  ]);

  return {
    identityKey: scopeKey,
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
    loading: loading || (!isEditMode && !draftLoaded && !loadError),
    loadError,
    retryLoad: () => { setLoadError(null); setLoadRevision((value) => value + 1); },
    notFound,
    isEditMode,
    draftLoaded,
    draftRestored,
    draftSaveFeedback,
    draftSaving,
    draftIsSaved: scope.savedSnapshot === JSON.stringify([form, stepIndex]),
    discardingDraft,
    hasPersistedDraft: draftRestored || hasIntakeDraftContent({ form, stepIndex }),
    updateField,
    updateBillingTypes,
    updateFundingSources,
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
