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
} from '@/lib/clients/clientIntakeDraftStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { upsertClientIntakeDraft, confirmClientIntakeDraft } from '@/lib/clients/repositories/careClientIntakeDraftRepository.supabase.web';
import { ClientIntakeWorkflow, withIntakeBrowserLock, type IntakeWorkflowProgress } from '@/lib/clients/clientIntakeWorkflow.web';
import { ClientIntakeIdentitySession } from '@/lib/clients/clientIntakeIdentitySession.web';
import { completeWebClientIntake } from '@/lib/clients/clientIntakeCompletion.web';
import { confirmClientIntakeCompletion } from '@/lib/clients/repositories/clientIntakeCompletionRepository.supabase.web';
import { carePermissionOwner, sameCarePermissionOwner, carePermissionOwnerIsCurrent } from '@/lib/permissions/carePermissionOwner.web';
import { useCareRuntimePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { isDemoMode } from '@/lib/supabase/config';
import { confirmWebClientIntakeDocuments as confirmClientIntakeDocuments, persistWebClientIntakeDocuments as persistClientIntakeDocuments } from '@/features/intakeDocuments/intakeDocumentTransaction.web';
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

  const auth = useAuth();
  const { user, profile } = auth;
  const tenantId = useServiceTenantId();
  const userId = user?.id ?? profile?.id ?? null;
  const live = getServiceMode() === 'supabase';
  const owner = carePermissionOwner(auth, tenantId, isDemoMode());
  const scopeKey = `${mode}:${editClientId ?? ''}`;
  const scopeRef = useRef<{ owner: typeof owner; key: string; alive: boolean } | null>(null);
  if (!scopeRef.current || scopeRef.current.key !== scopeKey || !sameCarePermissionOwner(scopeRef.current.owner, owner)) {
    scopeRef.current = { owner, key: scopeKey, alive: false };
  }
  const scope = scopeRef.current;
  const ownScope = useCallback(() => scopeRef.current === scope && scope.alive && carePermissionOwnerIsCurrent(scope.owner), [scope]);
  useEffect(() => {
    scope.alive = true;
    return () => { scope.alive = false; };
  }, [scope]);
  const permissions = useCareRuntimePermissions();
  const permissionRef = useRef(permissions.can);
  permissionRef.current = permissions.can;
  const canCreate = useCallback(() => ownScope() && permissionRef.current('office.clients.create'), [ownScope]);
  const canReviewIdentity = useCallback(() => canCreate() && permissionRef.current('office.clients.view') && permissionRef.current('office.clients.view_sensitive'), [canCreate]);
  const canComplete = useCallback(() => canReviewIdentity() && permissionRef.current('office.clients.edit') && permissionRef.current('office.clients.status_change'), [canReviewIdentity]);
  const captureCompletionCurrent = useCallback(() => {
    const generation = permissionRef.current;
    return () => permissionRef.current === generation && canComplete();
  }, [canComplete]);
  const canEditForm = useCallback(() => ownScope() && permissionRef.current(isEditMode ? 'office.clients.edit' : 'office.clients.create'), [ownScope, isEditMode]);
  const [loadedScope, setLoadedScope] = useState<object | null>(null);

  const [form, setForm] = useState<ClientIntakeFormData>(createEmptyIntakeForm);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<ClientIntakeErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftClientId, setDraftClientId] = useState<string | null>(null);
  const [draftSaveFeedback, setDraftSaveFeedback] = useState<{
    message: string;
    variant: 'success' | 'warning';
  } | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<'loading' | 'pending' | 'saving' | 'local' | 'saved' | 'blocked'>('loading');
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [workflowProgress, setWorkflowProgress] = useState<IntakeWorkflowProgress>({ stage: 'ready', documentsConfirmed: false, documentsRequestId: null, completionRequestId: null });
  const [, setIdentityRevision] = useState(0);
  const submitLock = useRef(false);
  const skipNextSave = useRef(false);
  const needsRemoteSyncOnLoad = useRef(false);
  const latestInput = useRef({ form, stepIndex });
  latestInput.current = { form, stepIndex };
  const workflowRef = useRef<ClientIntakeWorkflow | null>(null);
  const identityRef = useRef<ClientIntakeIdentitySession | null>(null);
  if (loadedScope === scope) identityRef.current?.syncInput(form);
  const workflow = useMemo(() => {
    if (isEditMode || !scope.owner) return null;
    const { tenantId: ownTenant, profileId: actorId } = scope.owner;
    return () => {
      const identity = new ClientIntakeIdentitySession({ owner: scope.owner!, isCurrent: ownScope, canRead: canReviewIdentity,
        captureRead: () => {
          const can = permissionRef.current;
          return () => ownScope() && can('office.clients.create') && can('office.clients.view') && can('office.clients.view_sensitive');
        },
      });
      const intakeWorkflow = new ClientIntakeWorkflow({
      tenantId: ownTenant, actorId, live, storage: AsyncStorage, isCurrent: ownScope, canWrite: canCreate,
      onProgress: progress => { if (ownScope()) setWorkflowProgress(progress); },
      ...(live ? { identity } : {}),
      allocateId: () => {
        if (!globalThis.crypto?.randomUUID) throw Error('Die Aufnahme konnte keine sichere Aktenkennung vorbereiten.');
        return globalThis.crypto.randomUUID();
      },
      exclusive: live ? withIntakeBrowserLock : async (_key, operation) => operation(),
      loadLegacy: () => loadClientIntakeDraft(actorId, ownTenant),
      clearLegacy: () => clearClientIntakeDraft(actorId, ownTenant),
      saveRemote: (snapshot, request) => canCreate()
        ? upsertClientIntakeDraft(ownTenant, snapshot, {
            ...request, actorProfileId: actorId,
            beforeWrite: async () => canCreate() && await request.beforeWrite() && canCreate(),
          })
        : Promise.resolve({ ok: false, error: 'Die aktuelle Aufnahmeberechtigung ist nicht bestätigt.' }),
      confirmRemote: (id, snapshot, context) => canCreate()
        ? confirmClientIntakeDraft(ownTenant, id, snapshot, actorId, {
            identityReviewId: context?.identityReviewId ?? null,
            requireDecisionReceipt: context?.allocation === 'new',
          })
        : Promise.resolve({ ok: false, error: 'Die aktuelle Aufnahmeberechtigung ist nicht bestätigt.' }),
      saveDocuments: (id, snapshot, context) => {
        const current = captureCompletionCurrent();
        return current() ? persistClientIntakeDocuments(ownTenant, id, snapshot, actorId, { ...context, isCurrent: () => context.isCurrent() && current() })
          : Promise.resolve({ ok: false as const, error: 'Die aktuelle Aufnahmeberechtigung ist nicht bestätigt.', documentWriteRejected: true as const });
      },
      confirmDocuments: (id, snapshot, context) => {
        const current = captureCompletionCurrent();
        return current() ? confirmClientIntakeDocuments(ownTenant, id, snapshot, actorId, { ...context, isCurrent: () => context.isCurrent() && current() })
          : Promise.resolve({ ok: false as const, error: 'Die aktuelle Aufnahmeberechtigung ist nicht bestätigt.' });
      },
      complete: (id, snapshot, guard, context) => {
        const current = captureCompletionCurrent();
        return live
        ? current()
          ? completeWebClientIntake(ownTenant, id!, snapshot, actorId, context.requestId, context.identityReviewId!, context.documentsRequestId!, () => guard() && current())
          : Promise.resolve({ ok: false, error: 'Die aktuelle Berechtigung zum Aufnahmeabschluss ist nicht bestätigt.' })
        : submitClientIntake(ownTenant, snapshot, { actorProfileId: actorId, actorRoleKey: scope.owner!.roleKey });
      },
      confirmCompletion: async (id, requestId) => {
        const current = captureCompletionCurrent();
        if (!current()) return { ok: false, error: 'Die aktuelle Aufnahmeberechtigung ist nicht bestätigt.' };
        const result = await confirmClientIntakeCompletion(ownTenant, id, actorId, requestId);
        return current() ? result : { ok: false, error: 'Die aktuelle Aufnahmeberechtigung ist nicht bestätigt.' };
      },
      });
      return { workflow: intakeWorkflow, identity };
    };
  }, [isEditMode, scope, live, ownScope, canCreate, canReviewIdentity, canComplete, captureCompletionCurrent]);

  const [dbSectionsLoaded, setDbSectionsLoaded] = useState(false);
  const [dbSectionKeys, setDbSectionKeys] = useState<
    { sectionKey: string; isRequired: boolean; sortOrder: number }[]
  >([]);

  useEffect(() => {
    if (!canEditForm() || loadedScope !== scope) {
      setDbSectionKeys([]);
      setDbSectionsLoaded(false);
      return;
    }
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
  }, [tenantId, form.careContexts, canEditForm, loadedScope, scope, permissions.loading]);

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
    let cancelled = false;
    const instance = workflow?.() ?? null;
    const intakeWorkflow = instance?.workflow ?? null;
    workflowRef.current = intakeWorkflow;
    identityRef.current = instance?.identity ?? null;
    setLoadedScope(null);
    setDraftLoaded(false);
    setCreatedId(null);
    setSubmitting(false);
    setForm(createEmptyIntakeForm());
    setStepIndex(0);
    setErrors({});
    setSubmitError(null);
    setDraftSaveFeedback(null);
    setDraftSaveState('loading');
    setDraftRestored(false);
    setDraftClientId(null);
    setSelectedExistingId(null);
    needsRemoteSyncOnLoad.current = false;
    submitLock.current = false;
    if (isEditMode) return;
    if (!intakeWorkflow) {
      setLoadError('Die eigene Aufnahmeberechtigung konnte noch nicht bestätigt werden.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    void intakeWorkflow.load().then((draft) => {
      if (cancelled || !ownScope()) return;
      if (draft) {
        skipNextSave.current = true;
        setForm(draft.form);
        setStepIndex(clampStepIndex(draft.stepIndex, draft.form.careContexts));
        setDraftClientId(draft.clientId);
        setSelectedExistingId(draft.selectedExistingId ?? null);
        setDraftRestored(true);
        if (draft.completed) setCreatedId(draft.clientId);
        if (draft.blocked) setDraftSaveFeedback({
          message: 'Ein früherer Speichervorgang ist noch nicht bestätigt. Mit „Entwurf speichern“ können Sie die bestehende Akte erneut prüfen. Ein unklarer Abschluss muss in der Akte geklärt werden.',
          variant: 'warning',
        });
        setDraftSaveState(draft.blocked ? 'blocked' : 'local');
        needsRemoteSyncOnLoad.current = live && !draft.clientId;
      } else setDraftSaveState('pending');
      setDraftLoaded(true);
      setLoadedScope(scope);
      setLoading(false);
    }).catch(() => {
      if (cancelled || !ownScope()) return;
      setLoadError('Der gespeicherte Aufnahmeentwurf konnte nicht sicher geladen werden. Bitte prüfen Sie die bestehende Akte.');
      setDraftSaveState('blocked');
      setLoading(false);
    });
    return () => {
      cancelled = true; intakeWorkflow.dispose();
      instance?.identity.dispose();
      if (workflowRef.current === intakeWorkflow) workflowRef.current = null;
      if (identityRef.current === instance?.identity) identityRef.current = null;
    };
  }, [workflow, ownScope, scope, isEditMode, live]);

  useEffect(() => {
    if (!isEditMode || !editClientId || !tenantId) {
      if (isEditMode && !editClientId) {
        setNotFound(true);
        setLoading(false);
      }
      return;
    }
    if (permissions.loading) { setLoading(true); return; }
    if (!canEditForm()) {
      setLoading(false);
      setLoadError('Die eigene Berechtigung zur Aktenbearbeitung ist nicht bestätigt.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setNotFound(false);

    void fetchClientIntakeEditData(editClientId, tenantId, profile?.roleKey, {
      includeIntakeDocuments,
    }).then((result) => {
      if (cancelled || !ownScope()) return;
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
      setLoadedScope(scope);
      setDraftLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isEditMode, editClientId, includeIntakeDocuments, tenantId, profile?.roleKey, ownScope, scope, canEditForm, permissions.loading]);

  const persistDraft = useCallback(
    async (options?: { showFeedback?: boolean }) => {
      const intakeWorkflow = workflowRef.current;
      if (!intakeWorkflow || !ownScope() || loadedScope !== scope || submitLock.current) return false;
      if (!hasIntakeDraftContent({ form, stepIndex })) return false;
      const snapshot = { form, stepIndex };
      setDraftSaveState('saving');
      let result = await intakeWorkflow.save(snapshot);
      if (!ownScope()) return false;
      if (!result.ok && options?.showFeedback) {
        const recovery = await intakeWorkflow.recover();
        if (!ownScope()) return false;
        if (recovery.ok && intakeWorkflow.binding().stage === 'complete') {
          setCreatedId(recovery.data.id); setDraftSaveState('saved');
          return true;
        }
        if (recovery.ok) result = await intakeWorkflow.save(snapshot);
      }
      if (!ownScope()) return false;
      if (latestInput.current.form !== snapshot.form || latestInput.current.stepIndex !== snapshot.stepIndex) {
        if (options?.showFeedback) setDraftSaveFeedback({ message: 'Die Angaben wurden während des Speicherns geändert. Bitte warten Sie auf die Sicherung des aktuellen Stands.', variant: 'warning' });
        return options?.showFeedback ? false : result.ok;
      }
      if (!result.ok) {
        setDraftSaveState('blocked');
        setDraftSaveFeedback({ message: result.error, variant: 'warning' });
        return false;
      }
      setDraftClientId(result.data.id || null);
      setDraftSaveState(result.data.remote === false && live ? 'local' : 'saved');
      setDraftSaveFeedback(options?.showFeedback ? {
        message: result.data.remote === false && live ? 'Entwurf auf diesem Gerät gesichert. Bitte prüfen Sie vorhandene Personen vor der Anlage.' : 'Entwurf gespeichert.',
        variant: 'success',
      } : null);
      return true;
    },
    [workflow, ownScope, loadedScope, scope, form, stepIndex, live],
  );

  useEffect(() => {
    if (isEditMode || !draftLoaded || loadedScope !== scope || !canCreate() || !userId || !tenantId || createdId || selectedExistingId || submitting) return;

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    if (!hasIntakeDraftContent({ form, stepIndex })) return;
    setDraftSaveState('pending');
    const timer = setTimeout(() => {
      void persistDraft();
    }, DRAFT_SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [form, stepIndex, draftLoaded, userId, tenantId, createdId, selectedExistingId, persistDraft, isEditMode, loadedScope, scope, canCreate, submitting, permissions.loading]);

  useEffect(() => {
    if (!draftLoaded || !needsRemoteSyncOnLoad.current || !canCreate()) return;
    needsRemoteSyncOnLoad.current = false;
    void persistDraft();
  }, [draftLoaded, persistDraft, canCreate, permissions.loading]);

  useEffect(() => {
    if (stepIndex <= steps.length - 1) return;
    setStepIndex(Math.max(0, steps.length - 1));
  }, [stepIndex, steps.length]);

  useEffect(() => {
    if (isEditMode || createdId || selectedExistingId || !hasIntakeDraftContent({ form, stepIndex }) || ['saved', 'local'].includes(draftSaveState)) return;
    if (typeof window === 'undefined') return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isEditMode, createdId, selectedExistingId, form, stepIndex, draftSaveState]);

  const updateField = useCallback(
    <K extends keyof ClientIntakeFormData>(key: K, value: ClientIntakeFormData[K]) => {
      if (!canEditForm() || loadedScope !== scope) return;
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    },
    [canEditForm, loadedScope, scope],
  );

  const replaceForm = useCallback((nextForm: ClientIntakeFormData) => {
      if (!canEditForm() || loadedScope !== scope) return;
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
  }, [canEditForm, loadedScope, scope]);

  const updateBillingTypes = useCallback((nextTypes: string[]) => {
      if (!canEditForm() || loadedScope !== scope) return;
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
  }, [canEditForm, loadedScope, scope]);

  const updateFundingSources = useCallback((fundingSources: ClientFundingSourceKey[]) => {
      if (!canEditForm() || loadedScope !== scope) return;
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
  }, [canEditForm, loadedScope, scope]);

  const updateCostBearerTypes = useCallback((nextTypes: string[]) => {
      if (!canEditForm() || loadedScope !== scope) return;
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
  }, [canEditForm, loadedScope, scope]);

  const commitCostBearer = useCallback(() => {
      if (!canEditForm() || loadedScope !== scope) return;
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
  }, [canEditForm, loadedScope, scope]);

  const removeCostBearer = useCallback((type: CostBearerTypeKey) => {
      if (!canEditForm() || loadedScope !== scope) return;
    setForm((prev) => clearCostBearerTypeFields(prev, type));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[COST_BEARER_FIELD_ERRORS[type]];
      delete next.costBearerTypes;
      return next;
    });
  }, [canEditForm, loadedScope, scope]);

  const toggleCareContext = useCallback((ctx: ClientCareContext) => {
      if (!canEditForm() || loadedScope !== scope) return;
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
  }, [canEditForm, loadedScope, scope]);

  const toggleArrayField = useCallback((key: 'supportWishes' | 'preferredTimes' | 'assignedModules', value: string) => {
      if (!canEditForm() || loadedScope !== scope) return;
    setForm((prev) => {
      const arr = prev[key];
      const has = arr.includes(value);
      return {
        ...prev,
        [key]: has ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }, [canEditForm, loadedScope, scope]);

  const discardDraft = useCallback(async () => {
    const intakeWorkflow = workflowRef.current;
    if (!intakeWorkflow || !ownScope() || loadedScope !== scope || submitLock.current) return;
    const result = await intakeWorkflow.discard();
    if (!ownScope()) return;
    if (!result.ok) {
      setDraftSaveState('blocked');
      setDraftSaveFeedback({ message: result.error, variant: 'warning' });
      return;
    }
    skipNextSave.current = true;
    setForm(createEmptyIntakeForm());
    setStepIndex(0);
    setErrors({});
    setSubmitError(null);
    setCreatedId(null);
    setDraftRestored(false);
    setDraftClientId(null);
    setSelectedExistingId(null);
    identityRef.current?.syncInput(createEmptyIntakeForm());
    setDraftSaveFeedback(null);
    setDraftSaveState('pending');
  }, [workflow, ownScope, loadedScope, scope]);
  const resetWizard = discardDraft;

  const saveDraft = useCallback(async () => {
    return persistDraft({ showFeedback: true });
  }, [persistDraft]);

  const reviewIdentity = useCallback(async () => {
    const identity = identityRef.current, intakeWorkflow = workflowRef.current;
    if (!identity || !intakeWorkflow || !canReviewIdentity() || loadedScope !== scope || submitLock.current) return false;
    const pending = identity.review(form, intakeWorkflow.binding());
    setIdentityRevision(value => value + 1);
    const result = await pending;
    if (ownScope() && identityRef.current === identity) setIdentityRevision(value => value + 1);
    return result;
  }, [canReviewIdentity, form, loadedScope, ownScope, scope]);

  const confirmNewPerson = useCallback(async (reason: string) => {
    const identity = identityRef.current;
    if (!identity || !canReviewIdentity() || loadedScope !== scope || submitLock.current) return false;
    identity.syncInput(form);
    const approved = identity.approveNew(reason);
    setIdentityRevision(value => value + 1);
    if (!approved) return false;
    const saved = await persistDraft({ showFeedback: true });
    if (ownScope()) setIdentityRevision(value => value + 1);
    return saved;
  }, [canReviewIdentity, form, loadedScope, ownScope, persistDraft, scope]);

  const openExistingPerson = useCallback(async (id: string) => {
    const intakeWorkflow = workflowRef.current;
    if (!intakeWorkflow || !canReviewIdentity() || loadedScope !== scope || submitLock.current) return null;
    submitLock.current = true;
    const result = await intakeWorkflow.openExisting(id, { form, stepIndex });
    if (ownScope()) submitLock.current = false;
    if (!canReviewIdentity()) return null;
    if (!result.ok) {
      setDraftSaveFeedback({ message: result.error, variant: 'warning' });
      setIdentityRevision(value => value + 1);
      return null;
    }
    setSelectedExistingId(result.data.id);
    setDraftSaveState('local');
    return result.data.id;
  }, [canReviewIdentity, form, loadedScope, ownScope, scope, stepIndex]);

  const nextStep = useCallback(() => {
      if (!canEditForm() || loadedScope !== scope) return false;
    const stepErrors = validateIntakeStep(currentSection, form);
    if (hasIntakeErrors(stepErrors)) {
      setErrors(stepErrors);
      return false;
    }
    setErrors({});
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    return true;
  }, [currentSection, form, steps.length, canEditForm, loadedScope, scope]);

  const prevStep = useCallback(() => {
      if (!canEditForm() || loadedScope !== scope) return;
    setErrors({});
    setStepIndex((i) => Math.max(i - 1, 0));
  }, [canEditForm, loadedScope, scope]);

  const goToStep = useCallback((index: number) => {
      if (!canEditForm() || loadedScope !== scope) return;
    if (index < 0 || index >= steps.length) return;
    setStepIndex(index);
    setErrors({});
  }, [steps.length, canEditForm, loadedScope, scope]);

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
    if (submitLock.current || submitting || !tenantId || !ownScope() || loadedScope !== scope) return null;
    if (!permissionRef.current(isEditMode ? 'office.clients.edit' : 'office.clients.create')) {
      setSubmitError('Die aktuelle Berechtigung zum Speichern ist nicht bestätigt.');
      return null;
    }
    if (isEditMode && !editClientId) return null;
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
          setStepIndex(steps.indexOf(section));
          setSubmitting(false);
          submitLock.current = false;
          return null;
        }
      }
    }

    try {
      const result = isEditMode
        ? await submitClientIntakeUpdate(tenantId, editClientId!, form, {
            actorProfileId: profile?.id ?? user?.id ?? null,
            actorRoleKey: profile?.roleKey ?? user?.roleKey ?? null,
            sections: submittedSections,
          })
        : workflowRef.current
          ? await workflowRef.current.finish({ form, stepIndex })
          : { ok: false as const, error: 'Die Aufnahme ist noch nicht bereit.' };

      if (!ownScope()) return null;

      if (result.ok) {
        skipNextSave.current = true;
        setCreatedId(result.data.id);
        return result.data.id;
      }
      setSubmitError(result.error);
      return null;
    } catch (error) {
      if (!ownScope()) return null;
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Änderungen konnten nicht gespeichert werden.',
      );
      return null;
    } finally {
      if (ownScope()) {
        setSubmitting(false);
        submitLock.current = false;
      }
    }
  }, [
    workflow, ownScope, loadedScope, scope, stepIndex,
    draftClientId,
    editClientId,
    editSections,
    form,
    isEditMode,
    profile?.id,
    profile?.roleKey,
    steps,
    submitting,
    tenantId,
    user?.id,
    user?.roleKey,
    userId,
    validateOnSubmit,
  ]);

  const recoverPendingWrite = useCallback(async (): Promise<string | null> => {
    const intakeWorkflow = workflowRef.current;
    if (!intakeWorkflow || !ownScope() || loadedScope !== scope || submitLock.current || !canComplete()) return null;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const result = await intakeWorkflow.recover();
      if (!ownScope()) return null;
      if (!result.ok) {
        setDraftSaveState('blocked');
        setDraftSaveFeedback({ message: result.error, variant: 'warning' });
        return null;
      }
      setDraftClientId(result.data.id);
      setDraftSaveState('saved');
      const completed = intakeWorkflow.binding().stage === 'complete';
      if (completed) setCreatedId(result.data.id);
      setDraftSaveFeedback({ message: completed ? 'Der bereits erfolgte Aufnahmeabschluss wurde bestätigt.'
        : 'Der gespeicherte Vorgang ist geklärt. Bitte prüfen Sie die Angaben vor dem nächsten Schritt.', variant: 'success' });
      return completed ? result.data.id : null;
    } finally {
      submitLock.current = false;
      if (ownScope()) setSubmitting(false);
    }
  }, [ownScope, loadedScope, scope, canComplete]);

  const visible = loadedScope === scope && canEditForm();
  return {
    form: visible ? form : createEmptyIntakeForm(),
    errors: visible ? errors : {},
    steps,
    stepLabels: steps.map((s) => INTAKE_SECTION_LABELS[s]),
    stepIndex,
    currentSection,
    contextHint,
    tenantId,
    submitting,
    submitError: visible ? submitError : null,
    createdId: visible ? createdId : null,
    loading: loading || permissions.loading || loadedScope !== scope && !loadError,
    loadError: loadError ?? (!permissions.loading && !canEditForm() ? 'Die aktuelle Berechtigung zur Aufnahme ist nicht bestätigt.' : null),
    notFound,
    isEditMode,
    draftLoaded,
    draftRestored: visible && draftRestored,
    draftSaveFeedback: visible ? draftSaveFeedback : null,
    draftSaveState: visible ? draftSaveState : 'loading' as const,
    workflowProgress: visible && !isEditMode ? { ...workflowProgress,
      documentsConfirmed: workflowProgress.documentsConfirmed && workflowRef.current?.documentsMatch(form) === true } : null,
    recoverPendingWrite,
    selectedExistingId: visible ? selectedExistingId : null,
    identityReview: visible && canReviewIdentity() ? identityRef.current?.view() ?? null : null,
    identityBound: visible && workflowRef.current?.binding().allocation === 'existing',
    identityCheckRequired: visible && live && !isEditMode,
    canReviewIdentity: visible && canReviewIdentity(),
    reviewIdentity,
    confirmNewPerson,
    openExistingPerson,
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
    isSuccess: visible && createdId !== null,
  };
}
