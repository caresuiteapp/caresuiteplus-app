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
  type ClientIntakeDraft,
} from '@/lib/clients/clientIntakeDraftStorage';
import { deleteClientIntakeDraft, loadServerClientIntakeDraft, reconcileServerClientIntakeDraft, scheduleIntakeFirstAppointment, upsertClientIntakeDraft } from '@/lib/clients/repositories/clientIntakeDraftRepository.supabase';
import { validateFirstContact } from '@/lib/clients/clientIntakePlan';
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
  /** Keep every section validated by intake submission available in the guided flow. */
  completeSectionFlow?: boolean;
};

export function useClientIntakeWizard(options?: UseClientIntakeWizardOptions) {
  const mode = options?.mode ?? 'create';
  const editClientId = options?.clientId;
  const editSections = options?.editSections;
  const validateOnSubmit = options?.validateOnSubmit ?? true;
  const completeSectionFlow = options?.completeSectionFlow ?? false;
  const includeIntakeDocuments = Boolean(
    editSections?.includes('vertraege_einwilligungen'),
  );
  const isEditMode = mode === 'edit';

  const { user, profile } = useAuth();
  const tenantId = useServiceTenantId();
  const userId = user?.id ?? profile?.id ?? null;
  const scopeKey = JSON.stringify([tenantId, userId, profile?.id, profile?.roleKey, mode, editClientId, editSections]);
  const scope = useMemo(() => ({
    key: scopeKey,
    submitLock: { current: false }, skipNextSave: { current: false }, needsRemoteSyncOnLoad: { current: false },
    clientId: null as string | null, epoch: 0, completed: false, discarding: false,
    savedSnapshot: '', serverRevision: 0, observedServerRevision: 0, serverFormSnapshot: '',
    pendingSave: undefined as ClientIntakeDraft['pendingSave'], conflict: false, reconciling: false,
    pendingReconciliation: undefined as ClientIntakeDraft['pendingReconciliation'],
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
  const [draftConflict, setDraftConflict] = useState(false);
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
    setDraftSaveFeedback(null); setDraftSaving(false); setDiscardingDraft(false); setDraftConflict(false);
    setDbSectionsLoaded(false); setDbSectionKeys([]);
  }

  useEffect(() => {
    if (completeSectionFlow || !tenantId || form.careContexts.length === 0) {
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
  }, [completeSectionFlow, tenantId, form.careContexts, current]);

  const steps = useMemo(() => {
    // The guided flow uses the same stable section order as submitClientIntake.
    // Optional DB configuration must not hide fields that submission requires.
    if (completeSectionFlow || !dbSectionsLoaded || form.careContexts.length === 0) {
      return getIntakeStepsForContexts(form.careContexts);
    }
    const keys = careContextsToServiceTypeKeys(form.careContexts);
    return getIntakeStepsForServiceTypeKeys(keys, form.careContexts, dbSectionKeys);
  }, [completeSectionFlow, dbSectionsLoaded, dbSectionKeys, form.careContexts]);

  const currentSection = steps[stepIndex] ?? 'leistungsart';
  const contextHint = getSupportOnlyHint(form.careContexts);

  useEffect(() => {
    if (completeSectionFlow && !isEditMode && draftLoaded && !loadError && !scope.completed && form.intakeWorkflowVersion !== 2) {
      setForm(previous => ({ ...previous, intakeWorkflowVersion: 2 }));
    }
  }, [completeSectionFlow, isEditMode, draftLoaded, loadError, scope, form.intakeWorkflowVersion]);

  useEffect(() => {
    if (isEditMode) return;

    if (!userId || !tenantId) {
      setDraftLoaded(true);
      return;
    }

    let cancelled = false;
    setDraftLoaded(false);

    void (async () => {
      const local = await loadClientIntakeDraft(userId, tenantId, editClientId);
      if (cancelled || !current()) return;
      const candidateId = editClientId ?? local?.clientId;
      const draft = !editClientId || local?.clientId === editClientId ? local : null;
      scope.clientId = candidateId ?? null;
      scope.serverRevision = draft?.serverRevision ?? 0;
      scope.serverFormSnapshot = draft?.serverFormSnapshot ?? '';
      scope.pendingSave = draft?.pendingSave;
      scope.pendingReconciliation = draft?.pendingReconciliation;
      scope.conflict = Boolean(scope.pendingReconciliation);
      setDraftConflict(scope.conflict);
      if (draft) {
        skipNextSave.current = true;
        setForm(draft.form);
        setStepIndex(clampStepIndex(draft.stepIndex, draft.form.careContexts));
        setDraftRestored(true);
      }
      if (getServiceMode() === 'supabase' && candidateId) {
        const remote = await loadServerClientIntakeDraft(tenantId, candidateId);
        if (cancelled || !current()) return;
        if (!remote.ok) {
          if (remote.deleted) {
            scope.completed = true;
            await clearClientIntakeDraft(userId, tenantId, candidateId);
            throw new Error('Dieser Aufnahmeentwurf wurde gelöscht. Bitte eine neue Aufnahme öffnen.');
          }
          if (!draft) throw new Error(remote.error);
          setDraftSaveFeedback({ message: `Entwurf von diesem Gerät geladen. ${remote.error}`, variant: 'warning' });
        } else if (remote.data) {
          const saved = remote.data;
          scope.observedServerRevision = saved.revision;
          if (saved.status === 'completed') {
            // A successful completion may have lost its response. Ask the same
            // idempotent endpoint for its verified receipt before showing success.
            const completed = await submitClientIntake(tenantId, saved.form, {
              draftClientId: candidateId, expectedRevision: saved.revision,
              actorRoleKey: profile?.roleKey ?? user?.roleKey,
            });
            if (cancelled || !current()) return;
            if (!completed.ok) throw new Error(completed.error);
            scope.completed = true; setForm(saved.form); setCreatedId(completed.data.id);
            if (draft?.clientId === candidateId) {
              try { await clearClientIntakeDraft(userId, tenantId, scope.clientId ?? undefined); }
              catch { if (current()) setDraftSaveFeedback({ message: 'Aufnahme bestätigt; der lokale Entwurf konnte nicht entfernt werden.', variant: 'warning' }); }
            }
            if (cancelled || !current()) return;
          } else if (saved.coreChanged || scope.pendingReconciliation) {
            if (!draft) {
              skipNextSave.current = true; setForm(saved.form); setStepIndex(0); setDraftRestored(true);
              scope.serverRevision = saved.revision; scope.serverFormSnapshot = JSON.stringify(saved.form);
            }
            scope.conflict = true; setDraftConflict(true);
            setDraftSaveFeedback({ message: scope.pendingReconciliation
              ? 'Die Übernahme aktueller Aktenangaben wurde noch nicht bestätigt. Bitte denselben Vorgang erneut versuchen.'
              : 'Grunddaten wurden in der Klientenakte geändert. Übernehmen Sie die aktuellen Server- und Aktenangaben ausdrücklich, bevor Sie die Aufnahme fortsetzen.', variant: 'warning' });
          } else if (draft?.pendingSave) {
            // Retry the exact outstanding request; a newer server revision must
            // never silently be adopted as permission to overwrite it.
            needsRemoteSyncOnLoad.current = true;
          } else {
            const localChanged = draft && JSON.stringify(draft.form) !== draft.serverFormSnapshot;
            if (draft && saved.revision !== scope.serverRevision && localChanged) {
              scope.conflict = true; setDraftConflict(true);
              setDraftSaveFeedback({ message: 'Auf dem Server liegt eine neuere Fassung vor. Ihre Änderungen auf diesem Gerät wurden nicht überschrieben.', variant: 'warning' });
            } else if (!draft || !localChanged) {
              skipNextSave.current = true;
              scope.serverRevision = saved.revision;
              scope.serverFormSnapshot = JSON.stringify(saved.form);
              setForm(saved.form); setStepIndex(draft ? clampStepIndex(draft.stepIndex, saved.form.careContexts) : 0);
              setDraftRestored(true);
              scope.savedSnapshot = JSON.stringify([saved.form, draft?.stepIndex ?? 0]);
            }
          }
        } else if (editClientId && !draft) {
          throw new Error('Diese frühere Aufnahme enthält noch keinen vollständigen Serverentwurf. Öffnen Sie die bestehende Klientenakte, um die bereits gespeicherten Angaben und Originalunterlagen einzusehen.');
        } else if (draft) {
          needsRemoteSyncOnLoad.current = true;
        }
      } else if (getServiceMode() === 'supabase' && draft && hasIntakeDraftContent(draft)) {
        needsRemoteSyncOnLoad.current = true;
      }
      setDraftLoaded(true);
    })().catch((error) => {
      if (!cancelled && current()) {
        setLoadError(error instanceof Error && error.message
          ? `Gespeicherter Entwurf konnte nicht geladen werden. Ihre Angaben werden nicht überschrieben. ${error.message}`
          : 'Gespeicherter Entwurf konnte nicht geladen werden. Ihre Angaben werden nicht überschrieben. Bitte erneut versuchen.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId, tenantId, isEditMode, editClientId, scope, current, loadRevision, skipNextSave, needsRemoteSyncOnLoad, profile?.roleKey, user?.roleKey]);

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
  }, [isEditMode, editClientId, includeIntakeDocuments, tenantId, profile?.roleKey, current, loadRevision, skipNextSave]);

  const persistDraft = useCallback(
    async (options?: { showFeedback?: boolean; forSubmit?: boolean; snapshot?: ClientIntakeFormData }) => {
      const formToSave = options?.snapshot ?? form;
      if (isEditMode || !current() || scope.completed || scope.discarding || scope.reconciling || (submitLock.current && !options?.forSubmit)) return false;
      if (!userId || !tenantId || !hasIntakeDraftContent({ form: formToSave, stepIndex })) {
        if (options?.showFeedback) setDraftSaveFeedback({ message: 'Kein Entwurf zum Speichern oder keine aktive Mandantensitzung.', variant: 'warning' });
        return false;
      }
      const epoch = scope.epoch;
      const usable = () => current() && scope.epoch === epoch && !scope.completed && !scope.discarding;
      const write = scope.draftTail.then(async () => {
        if (!usable()) return false;
        setDraftSaving(true);
        let localSaved = false;
        const saveLocal = async () => {
          await saveClientIntakeDraft(userId, tenantId, { form: formToSave, stepIndex, clientId: scope.clientId,
            serverRevision: scope.serverRevision, serverFormSnapshot: scope.serverFormSnapshot, pendingSave: scope.pendingSave, pendingReconciliation: scope.pendingReconciliation });
          localSaved = true;
        };
        try {
          if (getServiceMode() === 'supabase' && !scope.clientId) {
            scope.clientId = (await import('expo-crypto')).randomUUID();
            if (!usable()) return false;
          }
          await saveLocal();
          if (!usable()) return false;
          if (getServiceMode() === 'supabase') {
            if (scope.conflict) throw new Error('Auf dem Server liegt eine andere Fassung vor. Bitte zuerst den Serverstand prüfen.');
            const sendPending = async () => {
              const pending = scope.pendingSave!;
              const result = await upsertClientIntakeDraft(tenantId, pending.form, {
                clientId: scope.clientId!, expectedRevision: pending.expectedRevision, operationId: pending.operationId,
              });
              if (!usable()) return false;
              if (!result.ok) {
                if (result.conflict) { scope.conflict = true; setDraftConflict(true); }
                if (result.rejected) { scope.pendingSave = undefined; await saveLocal(); }
                throw new Error(result.error);
              }
              let completedElsewhere = false;
              if (result.data.replayed) {
                const latest = await loadServerClientIntakeDraft(tenantId, scope.clientId!);
                if (!usable()) return false;
                if (!latest.ok || !latest.data) throw new Error(!latest.ok ? latest.error : 'Der aktuelle Serverstand konnte nicht bestätigt werden. Bitte erneut sichern.');
                scope.observedServerRevision = latest.data.revision;
                completedElsewhere = latest.data.status === 'completed';
                if (latest.data.coreChanged) { scope.conflict = true; setDraftConflict(true); }
              }
              scope.serverRevision = result.data.revision;
              scope.serverFormSnapshot = JSON.stringify(pending.form);
              scope.pendingSave = undefined;
              await saveLocal();
              if (scope.conflict || completedElsewhere || scope.observedServerRevision > scope.serverRevision) {
                scope.conflict = true; setDraftConflict(true);
                throw new Error(completedElsewhere
                  ? 'Diese Aufnahme wurde bereits abgeschlossen. Bitte öffnen Sie die Klientenakte erneut.'
                  : 'Auf dem Server liegt inzwischen eine neuere Fassung vor. Ihre Angaben auf diesem Gerät bleiben erhalten.');
              }
              return usable();
            };
            if (scope.pendingSave && !await sendPending()) return false;
            if (scope.serverFormSnapshot !== JSON.stringify(formToSave)) {
              scope.pendingSave = { operationId: (await import('expo-crypto')).randomUUID(),
                expectedRevision: scope.serverRevision, form: formToSave };
              if (!usable()) return false;
              // Persist retry identity BEFORE sending, including the exact payload.
              await saveLocal();
              if (!usable() || !await sendPending()) return false;
            }
          }
          if (!usable()) return false;
          scope.savedSnapshot = JSON.stringify([formToSave, stepIndex]);
          setDraftSaveFeedback({ message: getServiceMode() === 'supabase'
            ? 'Vollständiger Entwurf im Unternehmen gespeichert. Die Aufnahme ist noch nicht abgeschlossen.'
            : 'Entwurf auf diesem Gerät gespeichert.', variant: 'success' });
          return true;
        } catch (error) {
          if (usable()) setDraftSaveFeedback({ message: `${localSaved ? 'Entwurf auf diesem Gerät erhalten. ' : 'Entwurf konnte nicht auf diesem Gerät gespeichert werden. '}${error instanceof Error ? error.message : 'Bitte erneut speichern.'}`, variant: 'warning' });
          return false;
        } finally { if (current()) setDraftSaving(false); }
      });
      scope.draftTail = write.catch(() => false);
      return write;
    },
    [current, form, isEditMode, scope, stepIndex, submitLock, tenantId, userId],
  );

  const reloadServerDraft = useCallback(async () => {
    if (!current() || !tenantId || !userId || !scope.clientId || submitLock.current || scope.discarding || scope.reconciling) return false;
    scope.reconciling = true;
    setDraftSaving(true);
    const rememberLocal = () => saveClientIntakeDraft(userId, tenantId, { form, stepIndex, clientId: scope.clientId,
      serverRevision: scope.serverRevision, serverFormSnapshot: scope.serverFormSnapshot,
      pendingSave: scope.pendingSave, pendingReconciliation: scope.pendingReconciliation });
    try {
      await scope.draftTail;
      let remote = await loadServerClientIntakeDraft(tenantId, scope.clientId);
      if (!current()) return false;
      if (!remote.ok || !remote.data || remote.data.status !== 'draft') {
        setDraftSaveFeedback({ message: !remote.ok ? remote.error : 'Dieser Entwurf kann nicht mehr bearbeitet werden. Bitte die Klientenakte neu öffnen.', variant: 'warning' });
        return false;
      }
      let reconciled = false;
      if (remote.data.coreChanged || scope.pendingReconciliation) {
        scope.conflict = true; setDraftConflict(true);
        if (!scope.pendingReconciliation) {
          if (!remote.data.currentClientUpdatedAt) throw new Error('Die aktuelle Aktenfassung konnte nicht eindeutig bestimmt werden. Bitte erneut laden.');
          scope.pendingReconciliation = { operationId: (await import('expo-crypto')).randomUUID(),
            expectedRevision: remote.data.revision, expectedClientUpdatedAt: remote.data.currentClientUpdatedAt };
        }
        if (!current()) return false;
        await rememberLocal();
        if (!current()) return false;
        const result = await reconcileServerClientIntakeDraft(tenantId, { clientId: scope.clientId, ...scope.pendingReconciliation });
        if (!current()) return false;
        if (!result.ok) {
          if (result.rejected) { scope.pendingReconciliation = undefined; await rememberLocal(); }
          throw new Error(result.error);
        }
        remote = await loadServerClientIntakeDraft(tenantId, scope.clientId);
        if (!current()) return false;
        if (!remote.ok || !remote.data) throw new Error(!remote.ok ? remote.error : 'Die übernommene Fassung konnte nicht geladen werden. Bitte denselben Vorgang erneut versuchen.');
        if (remote.data.status !== 'draft' || remote.data.coreChanged || remote.data.revision !== result.data.revision) {
          scope.pendingReconciliation = undefined; await rememberLocal();
          throw new Error('Die Akte wurde inzwischen erneut geändert. Ihre lokale Fassung bleibt erhalten. Bitte prüfen Sie den aktuellen Serverstand.');
        }
        reconciled = true;
      }
      const saved = remote.data;
      await saveClientIntakeDraft(userId, tenantId, { clientId: saved.clientId, form: saved.form, stepIndex: 0,
        serverRevision: saved.revision, serverFormSnapshot: JSON.stringify(saved.form) });
      if (!current()) return false;
      scope.serverRevision = saved.revision; scope.observedServerRevision = saved.revision; scope.serverFormSnapshot = JSON.stringify(saved.form);
      scope.pendingSave = undefined; scope.pendingReconciliation = undefined; scope.conflict = false; scope.savedSnapshot = JSON.stringify([saved.form, 0]);
      skipNextSave.current = true; setForm(saved.form); setStepIndex(0); setErrors({}); setDraftConflict(false);
      setDraftSaveFeedback({ message: reconciled
        ? 'Aktuelle Aktenangaben übernommen. Bitte prüfen Sie die Aufnahmeunterlagen erneut. Bereits erfasste Originale und Unterschriften bleiben erhalten.'
        : 'Aktueller Serverstand geladen. Sie können die Aufnahme fortsetzen.', variant: reconciled ? 'warning' : 'success' });
      return true;
    } catch (error) {
      if (current()) setDraftSaveFeedback({ message: error instanceof Error ? error.message : 'Serverstand konnte nicht geladen werden. Ihre Angaben bleiben erhalten.', variant: 'warning' });
      return false;
    } finally { scope.reconciling = false; if (current()) setDraftSaving(false); }
  }, [current, form, stepIndex, scope, skipNextSave, submitLock, tenantId, userId]);

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
  }, [form, stepIndex, draftLoaded, userId, tenantId, createdId, persistDraft, isEditMode, submitting, discardingDraft, skipNextSave]);

  useEffect(() => {
    if (!draftLoaded || !needsRemoteSyncOnLoad.current) return;
    needsRemoteSyncOnLoad.current = false;
    void persistDraft();
  }, [draftLoaded, needsRemoteSyncOnLoad, persistDraft]);

  useEffect(() => {
    if (stepIndex <= steps.length - 1) return;
    setStepIndex(Math.max(0, steps.length - 1));
  }, [stepIndex, steps.length]);

  useEffect(() => { const cleanupDraftFeedbackTimerRef = draftFeedbackTimerRef;
    return () => {
      if (cleanupDraftFeedbackTimerRef.current) {
        clearTimeout(cleanupDraftFeedbackTimerRef.current);
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
    scope.savedSnapshot = ''; scope.serverRevision = 0; scope.observedServerRevision = 0; scope.serverFormSnapshot = ''; scope.pendingSave = undefined; scope.pendingReconciliation = undefined; scope.conflict = false;
    setDraftConflict(false);
    setCreatedId(null);
    setDraftSaveFeedback(null);
  }, [scope]);

  const discardDraft = useCallback(async (deleteOnServer = false): Promise<boolean> => {
    if (!current() || submitLock.current || scope.discarding || scope.reconciling || !userId || !tenantId) return false;
    submitLock.current = true; setDiscardingDraft(true);
    skipNextSave.current = true;
    try {
      await scope.draftTail;
      if (!current()) return false;
      scope.epoch++; scope.discarding = true;
      if (deleteOnServer && getServiceMode() === 'supabase' && scope.clientId) {
        const result = await deleteClientIntakeDraft(tenantId, scope.clientId, scope.serverRevision);
        if (!result.ok) throw new Error(result.error);
        // A failed local cleanup must never restart autosave for a deleted server draft.
        scope.completed = true;
      }
      await clearClientIntakeDraft(userId, tenantId, scope.clientId ?? undefined);
      if (!current()) return false;
      resetWizard();
      return true;
    } catch (error) {
      if (current()) setDraftSaveFeedback({ message: error instanceof Error ? error.message : 'Entwurf konnte nicht entfernt werden. Ihre Angaben bleiben erhalten.', variant: 'warning' });
      return false;
    } finally {
      scope.discarding = false; submitLock.current = false;
      if (current()) setDiscardingDraft(false);
    }
  }, [current, resetWizard, scope, skipNextSave, submitLock, tenantId, userId]);

  const saveDraft = useCallback(async () => {
    return persistDraft({ showFeedback: true });
  }, [persistDraft]);

  const saveFirstContact = useCallback(async () => {
    const validation = validateFirstContact(form);
    if (Object.keys(validation).length) { setErrors(validation); return false; }
    setErrors({});
    if (!await persistDraft({ showFeedback: true })) return false;
    if (!current() || scope.completed || scope.discarding) return false;
    if (form.intakeAppointmentRequested) {
      if (getServiceMode() !== 'supabase' || !scope.clientId || !tenantId) {
        setDraftSaveFeedback({ message: 'Erstkontakt auf diesem Gerät gesichert. Ein Kalendertermin benötigt eine aktive Unternehmensverbindung.', variant: 'warning' });
        return false;
      }
      const appointment = await scheduleIntakeFirstAppointment(tenantId, scope.clientId, scope.serverRevision);
      if (!current()) return false;
      if (!appointment.ok) {
        setDraftSaveFeedback({ message: `Erstkontakt gespeichert; Kalendertermin noch nicht bestätigt. ${appointment.error}`, variant: 'warning' });
        return false;
      }
      if (['archiviert', 'cancelled'].includes(appointment.data.status)) {
        setDraftSaveFeedback({ message: 'Erstkontakt gespeichert. Der frühere Ersttermin wurde im Kalender entfernt und bleibt entfernt.', variant: 'success' });
        return true;
      }
    }
    setDraftSaveFeedback({ message: form.intakeAppointmentRequested ? 'Erstkontakt und erster Termin sind im Unternehmen gespeichert.' : getServiceMode() === 'supabase' ? 'Erstkontakt im Unternehmen gespeichert. Die vollständige Aufnahme kann später ergänzt werden.' : 'Erstkontakt auf diesem Gerät gespeichert.', variant: 'success' });
    return true;
  }, [current, form, persistDraft, scope, tenantId]);

  const saveDocumentPackage = useCallback(async (nextForm: ClientIntakeFormData) => {
    if (!current() || isEditMode || submitLock.current || scope.completed || scope.discarding || scope.reconciling) return false;
    replaceForm(nextForm);
    return persistDraft({ showFeedback: true, snapshot: nextForm });
  }, [current, isEditMode, persistDraft, replaceForm, scope, submitLock]);

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
    if (!current() || submitLock.current || submitting || scope.completed || scope.discarding || scope.reconciling || !draftLoaded && !isEditMode || loading || notFound || loadError) return null;
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
      if (!isEditMode && !await persistDraft({ forSubmit: true })) {
        if (current()) setSubmitError('Die vollständige Aufnahme konnte nicht auf dem Server gesichert werden. Bitte prüfen Sie den Speicherhinweis und versuchen Sie es erneut.');
        return null;
      }
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
            expectedRevision: scope.serverRevision,
            actorRoleKey: profile?.roleKey ?? user?.roleKey ?? null,
          });

      if (!current()) return null;
      if (result.ok) {
        scope.completed = true;
        skipNextSave.current = true;
        setCreatedId(result.data.id);
        if (!isEditMode && userId) {
          try { await clearClientIntakeDraft(userId, tenantId, scope.clientId ?? undefined); }
          catch { if (current()) setDraftSaveFeedback({ message: 'Aufnahme gespeichert; der lokale Entwurf konnte nicht entfernt werden.', variant: 'warning' }); }
        }
        return current() ? result.data.id : null;
      }
      if (result.conflict) { scope.conflict = true; setDraftConflict(true); }
      if (!isEditMode && 'recoverableClientId' in result && typeof result.recoverableClientId === 'string') {
        scope.clientId = result.recoverableClientId;
        if (userId) await saveClientIntakeDraft(userId, tenantId, { form, stepIndex, clientId: scope.clientId, serverRevision: scope.serverRevision, serverFormSnapshot: scope.serverFormSnapshot, pendingSave: scope.pendingSave, pendingReconciliation: scope.pendingReconciliation });
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
  }, [current, submitLock, submitting, scope, draftLoaded, isEditMode, loading, notFound, loadError, tenantId, editClientId, editSections, validateOnSubmit, steps, form, profile?.id, profile?.roleKey, user?.id, user?.roleKey, skipNextSave, userId, stepIndex, persistDraft]);

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
    draftConflict,
    reloadServerDraft,
    draftClientId: scope.clientId,
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
    saveFirstContact,
    saveDocumentPackage,
    resetWizard,
    isFirstStep: stepIndex === 0,
    isLastStep: stepIndex === steps.length - 1,
    isSuccess: createdId !== null,
  };
}
