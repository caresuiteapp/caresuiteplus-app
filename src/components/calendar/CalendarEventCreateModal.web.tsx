import { notifyCalendarWorkspaceChanged } from '@/lib/calendar/calendarWorkspaceRefresh.web';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import type { CalendarEventTemplate, CalendarModuleKey, CalendarScope } from '@/types/calendar';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import type {
  CalendarEventCreateContext,
  CalendarFormStep,
} from '@/types/calendar/calendarEventForm';
import {
  createDefaultFormState,
} from '@/types/calendar/calendarEventForm';
import { PlatformModal } from '@/components/layout/platform';
import { CalendarDialogContent } from './CalendarDialogContent.web';
import { CALENDAR_FORM_STEP_LABELS } from '@/types/calendar/calendarEventForm';
import { confirmAction } from '@/lib/platform/confirmAction';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchClientList } from '@/lib/office/clientListService';
import { fetchAssignmentEmployeeList } from '@/lib/assist/assignmentEmployeeListService';
import type { CareEntityOption } from '@/components/inputs/CareEntitySelect';
import {
  createCalendarEventFromForm,
  updateCalendarEventFromForm,
  resolveCalendarFormWritePermission,
} from '@/lib/calendar/calendarEventSaveService';
import { CalendarEventForm } from './CalendarEventForm.web';

export type CalendarEventCreateModalProps = {
  visible: boolean;
  sourceContext: CalendarEventCreateContext;
  calendarScope: CalendarScope;
  moduleKey: CalendarModuleKey;
  accentColor?: string;
  preselectedTemplate?: CalendarEventTemplate | null;
  editEvent?: CalendarEvent | null;
  onClose: () => void;
  onCreated?: () => void;
};

function resolveSteps(moduleKey: CalendarModuleKey, isEdit: boolean): CalendarFormStep[] {
  const planningSteps: CalendarFormStep[] = ['template', 'basics', 'datetime', 'visibility', 'preview'];
  if (isEdit) return ['basics', 'datetime', 'visibility', 'preview'];
  return moduleKey === 'assist' ? ['type', ...planningSteps] : planningSteps;
}

function eventToForm(event: CalendarEvent): ReturnType<typeof createDefaultFormState> {
  const record = event.record;
  const base = createDefaultFormState((event.moduleKey ?? 'office') as import('@/types/calendar').CalendarModuleKey);
  return {
    ...base,
    title: event.title,
    description: record?.description ?? '',
    internalNote: record?.internalNote ?? '',
    publicNote: record?.publicNote ?? '',
    startAt: event.start,
    endAt: event.end,
    allDay: event.allDay ?? false,
    locationName: record?.locationName ?? '',
    room: record?.room ?? '',
    address: record?.address ?? '',
    relatedClientId: record?.relatedClientId ?? '',
    relatedEmployeeId: record?.relatedEmployeeId ?? '',
    relatedWardId: record?.relatedWardId ?? '',
    relatedCaseId: record?.relatedCaseId ?? '',
    isOfficeVisible: record?.isOfficeVisible ?? true,
    isModuleVisible: record?.isModuleVisible ?? true,
    isClientPortalVisible: record?.isClientPortalVisible ?? false,
    isEmployeePortalVisible: record?.isEmployeePortalVisible ?? false,
    sourceType: record?.sourceType ?? 'custom_event',
    eventType:
      record?.eventType
      ?? (event.type === 'geburtstag' || event.type === 'feiertag' ? 'termin' : event.type),
    templateKey: null,
  };
}

export function CalendarEventCreateModal({
  visible,
  sourceContext,
  calendarScope,
  moduleKey,
  accentColor = '#62F3FF',
  preselectedTemplate = null,
  editEvent = null,
  onClose,
  onCreated,
}: CalendarEventCreateModalProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, isReadOnly } = usePermissions();
  const isEdit = !!editEvent;
  const scope = JSON.stringify([tenantId, profile?.id, profile?.roleKey, visible, sourceContext, moduleKey, calendarScope, editEvent?.record?.sourceId ?? editEvent?.id]);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const mounted = useRef(false);
  const saveRequest = useRef(0);
  const savingRef = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const steps = useMemo(() => resolveSteps(moduleKey, isEdit), [moduleKey, isEdit]);
  const [stepIndex, setStepIndex] = useState(0);
  const [template, setTemplate] = useState<CalendarEventTemplate | null>(preselectedTemplate);
  const [form, setForm] = useState(() => createDefaultFormState(moduleKey));
  const writePermission = resolveCalendarFormWritePermission({ sourceContext, moduleKey, sourceType: form.sourceType });
  const canSave = !isReadOnly && !!writePermission && can(writePermission);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistedSourceId, setPersistedSourceId] = useState<string | null>(null);
  const [formScope, setFormScope] = useState(scope);
  const [clients, setClients] = useState<CareEntityOption[]>([]);
  const [employees, setEmployees] = useState<CareEntityOption[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const initialForm = useRef(form);
  const latestInitial = useRef({ editEvent, preselectedTemplate }); latestInitial.current = { editEvent, preselectedTemplate };

  const step = steps[stepIndex] ?? 'template';

  const reset = useCallback(() => {
    setStepIndex(0);
    setTemplate(latestInitial.current.preselectedTemplate);
    const next = latestInitial.current.editEvent ? eventToForm(latestInitial.current.editEvent) : createDefaultFormState(moduleKey);
    if (!latestInitial.current.editEvent) next.sourceType = sourceContext === 'appointment_management' ? 'appointment' : 'custom_event';
    initialForm.current = next; setForm(next);
    setError(null);
  }, [moduleKey, sourceContext]);

  useEffect(() => {
    saveRequest.current += 1; savingRef.current = false; setSaving(false);
    setFormScope(scope); setPersistedSourceId(null); setClients([]); setEmployees([]); setPeopleLoading(false); setPeopleError(null);
    if (!visible) return;
    reset();
    if (!tenantId) return;
    let cancelled = false;
    setPeopleLoading(true);
    void Promise.all([fetchClientList(tenantId, profile?.roleKey, { lifecycleFilter: 'active' }), fetchAssignmentEmployeeList(tenantId, profile?.roleKey)]).then(([clientResult, employeeResult]) => {
      if (cancelled) return;
      if (!clientResult.ok || !employeeResult.ok) {
        setPeopleError(!clientResult.ok ? clientResult.error : !employeeResult.ok ? employeeResult.error : 'Personenauswahl fehlgeschlagen.');
      }
      const clientOptions = (clientResult.ok ? clientResult.data : []).map(person => ({ value: person.id, label: `${person.firstName} ${person.lastName}`.trim() }));
      const employeeOptions = (employeeResult.ok ? employeeResult.data : []).map(person => ({ value: person.id, label: `${person.firstName} ${person.lastName}`.trim() }));
      const record = latestInitial.current.editEvent?.record;
      if (record?.relatedClientId && !clientOptions.some(person => person.value === record.relatedClientId)) clientOptions.push({ value: record.relatedClientId, label: 'Bisherige Zuordnung (nicht in aktiver Liste)' });
      if (record?.relatedEmployeeId && !employeeOptions.some(person => person.value === record.relatedEmployeeId)) employeeOptions.push({ value: record.relatedEmployeeId, label: 'Bisherige Zuordnung (nicht in aktiver Liste)' });
      setClients(clientOptions); setEmployees(employeeOptions);
    }).catch(cause => { if (!cancelled) setPeopleError(cause instanceof Error ? cause.message : 'Personenauswahl fehlgeschlagen.'); })
      .finally(() => { if (!cancelled) setPeopleLoading(false); });
    return () => { cancelled = true; };
  }, [scope, visible, tenantId, profile?.roleKey, reset]);

  const handleSelectTemplate = (next: CalendarEventTemplate) => {
    if (savingRef.current || !canSave) return;
    setTemplate(next);
    setForm(prev => {
      const start = Number.isFinite(Date.parse(prev.startAt)) ? new Date(prev.startAt) : new Date();
      const duration = Number.isFinite(next.defaultDurationMinutes) ? Math.max(1, next.defaultDurationMinutes) : 60;
      const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(start);
      return { ...prev, title: prev.title || next.label,
        sourceType: sourceContext === 'appointment_management' ? 'appointment' : 'custom_event',
        eventType: next.eventType, allDay: next.allDay, templateKey: next.templateKey,
        startAt: next.allDay ? `${day}T00:00:00.000Z` : start.toISOString(),
        endAt: next.allDay ? new Date(Date.parse(`${day}T00:00:00.000Z`) + Math.max(1, Math.ceil(duration / 1440)) * 86_400_000 - 1).toISOString() : new Date(start.getTime() + duration * 60_000).toISOString(),
      };
    });
    goNext();
  };

  const handleContinueWithoutTemplate = () => {
    if (savingRef.current || !canSave) return;
    setTemplate(null);
    goNext();
  };

  const goNext = () => {
    if (savingRef.current) return;
    if (step === 'basics' && !form.title.trim()) {
      setError('Bitte Titel ausfüllen.');
      return;
    }
    if (step === 'datetime' && (!Number.isFinite(Date.parse(form.startAt)) || !Number.isFinite(Date.parse(form.endAt)) || Date.parse(form.endAt) <= Date.parse(form.startAt))) {
      setError('Bitte einen gültigen Beginn und ein späteres Ende angeben.'); return;
    }
    if (step === 'visibility' && ((form.isClientPortalVisible && !form.relatedClientId) || (form.isEmployeePortalVisible && !form.relatedEmployeeId))) {
      setError('Für die Portal-Freigabe bitte zuerst die passende Person zuordnen.'); return;
    }
    setError(null);
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    }
  };

  const goBack = () => {
    if (savingRef.current) return;
    setError(null);
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const handleSave = async () => {
    if (savingRef.current || !canSave || peopleLoading) return;
    if (!Number.isFinite(Date.parse(form.startAt)) || !Number.isFinite(Date.parse(form.endAt)) || Date.parse(form.endAt) <= Date.parse(form.startAt)) {
      setError('Bitte einen gültigen Beginn und ein späteres Ende angeben.'); return;
    }
    if (!tenantId) {
      setError('Kein Mandant am Profil hinterlegt.');
      return;
    }
    if (!form.title.trim()) {
      setError('Bitte Titel ausfüllen.');
      return;
    }
    if ((form.relatedClientId && !clients.some(person => person.value === form.relatedClientId)) || (form.relatedEmployeeId && !employees.some(person => person.value === form.relatedEmployeeId))) {
      setError('Bitte eine verfügbare Person aus der aktuellen Auswahl wählen.'); return;
    }
    const submittedScope = scope; const request = ++saveRequest.current;
    const canCommit = () => mounted.current && scopeRef.current === submittedScope && saveRequest.current === request;
    savingRef.current = true; setSaving(true);
    setError(null);

    const payload = {
      tenantId,
      moduleKey,
      calendarScope,
      sourceContext,
      sourceType: form.sourceType,
      eventType: form.eventType,
      templateKey: form.templateKey,
      title: form.title,
      description: form.description || null,
      internalNote: form.internalNote || null,
      publicNote: form.publicNote || null,
      startAt: form.allDay ? `${form.startAt.slice(0, 10)}T00:00:00.000Z` : form.startAt,
      endAt: form.allDay ? `${form.endAt.slice(0, 10)}T23:59:59.999Z` : form.endAt,
      allDay: form.allDay,
      locationName: form.locationName || null,
      room: form.room || null,
      address: form.address || null,
      relatedClientId: form.relatedClientId || null,
      relatedEmployeeId: form.relatedEmployeeId || null,
      relatedWardId: form.relatedWardId || null,
      relatedCaseId: form.relatedCaseId || null,
      isOfficeVisible: form.isOfficeVisible,
      isModuleVisible: form.isModuleVisible,
      isClientPortalVisible: form.isClientPortalVisible,
      isEmployeePortalVisible: form.isEmployeePortalVisible,
      existingSourceId: persistedSourceId ?? editEvent?.record?.sourceId ?? editEvent?.id ?? null,
      existingEventId: editEvent?.record?.id ?? null,
    };

    try {
    const result = isEdit || persistedSourceId
      ? await updateCalendarEventFromForm(payload, profile?.roleKey)
      : await createCalendarEventFromForm(payload, profile?.roleKey);

    if (!canCommit()) return;
    if (!result.ok) {
      setError(result.error);
      setPersistedSourceId(result.persistedSourceId ?? persistedSourceId);
      return;
    }
    notifyCalendarWorkspaceChanged(tenantId);
    onCreated?.();
    onClose();
    } catch (cause) {
      if (canCommit()) setError(cause instanceof Error ? cause.message : 'Speicherung konnte nicht bestätigt werden.');
    } finally { if (canCommit()) { savingRef.current = false; setSaving(false); } }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm.current);
  const requestClose = async () => {
    if (savingRef.current) return;
    if (dirty && !await confirmAction({ title: 'Entwurf schließen', message: persistedSourceId ? 'Der Termin wurde bereits gespeichert, der Kalenderabgleich ist noch offen. Trotzdem schließen?' : 'Ungespeicherte Änderungen verwerfen?', confirmLabel: 'Schließen', cancelLabel: 'Weiter bearbeiten' })) return;
    onClose();
  };
  if (!visible || formScope !== scope) return null;
  return <PlatformModal visible title={isEdit ? 'Termin bearbeiten' : 'Termin planen'}
    subtitle={isEdit ? 'Angaben ändern und im Kalender aktualisieren' : 'Vorlage wählen oder einen eigenen Eintrag anlegen'}
    onClose={() => void requestClose()} dismissOnBackdrop={!saving} surfaceScope="company" maxWidth={960}
    bodyStyle={{ padding: 24, gap: 18 }} glowColor="#2786E7"
    footerContent={<CalendarDialogContent>
      {error ? <div role="alert" className="cd-alert">{error}</div> : null}
      {!canSave ? <div role="alert" className="cd-alert">Keine Schreibberechtigung für diesen Kalender.</div> : null}
      {saving ? <p role="status" className="cd-footer-note">Der Termin wird gespeichert. Bitte kurz warten.</p> : null}
    </CalendarDialogContent>}
    footerActions={[
      { title: stepIndex > 0 ? 'Zurück' : 'Abbrechen', variant: 'secondary', disabled: saving, onPress: stepIndex > 0 ? goBack : () => void requestClose() },
      ...(step === 'preview' ? [{ title: saving ? 'Wird gespeichert…' : persistedSourceId ? 'Abgleich erneut versuchen' : isEdit ? 'Änderungen speichern' : 'Termin speichern', loading: saving, disabled: saving || !canSave || peopleLoading, onPress: handleSave }]
        : step === 'template' || step === 'type' ? [] : [{ title: 'Weiter', disabled: saving, onPress: goNext }]),
    ]}>
    <CalendarDialogContent>
      <ol className="cd-steps" aria-label="Planungsschritte">{steps.map((item, index) => <li key={item} aria-current={index === stepIndex ? 'step' : undefined} className={index < stepIndex ? 'cd-done' : ''}><span aria-hidden="true">{index < stepIndex ? '✓' : index + 1}</span>{CALENDAR_FORM_STEP_LABELS[item]}</li>)}</ol>
      {peopleError && step === 'basics' ? <div role="alert" className="cd-info">Personen konnten nicht vollständig geladen werden: {peopleError} Prüfe die Zuordnung oder öffne den Dialog später erneut.</div> : null}
      <CalendarEventForm step={step} moduleKey={moduleKey} form={form} template={template} accentColor={accentColor}
        clients={clients} employees={employees} peopleLoading={peopleLoading} disabled={saving || !canSave}
        onChange={(patch) => { if (!savingRef.current && canSave) setForm(prev => ({ ...prev, ...patch })); }}
        onSelectTemplate={handleSelectTemplate} onContinueWithoutTemplate={handleContinueWithoutTemplate}
        onChooseCalendarEntry={goNext} onAssistEinsatzLink={() => { if (savingRef.current) return; onClose(); router.push('/assist/assignments?create=1' as never); }} />
    </CalendarDialogContent>
  </PlatformModal>;
}

export const CalendarCreateModal = CalendarEventCreateModal;
export type CalendarCreateModalProps = CalendarEventCreateModalProps;
