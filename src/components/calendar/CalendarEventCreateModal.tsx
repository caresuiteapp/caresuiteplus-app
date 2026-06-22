import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { CalendarEventTemplate, CalendarModuleKey, CalendarScope } from '@/types/calendar';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import type {
  CalendarEventCreateContext,
  CalendarFormStep,
} from '@/types/calendar/calendarEventForm';
import {
  CALENDAR_FORM_STEPS,
  createDefaultFormState,
} from '@/types/calendar/calendarEventForm';
import { GradientModalHeader } from '@/components/layout/platform';
import { PremiumButton } from '@/components/ui';
import { GlassSurface } from '@/components/ui/effects';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careRadius } from '@/design/tokens/radius';
import { spacing } from '@/theme';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  createCalendarEventFromForm,
  updateCalendarEventFromForm,
} from '@/lib/calendar/calendarEventSaveService';
import { CalendarEventForm } from './CalendarEventForm';

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
  const steps = [...CALENDAR_FORM_STEPS];
  if (moduleKey !== 'assist' || isEdit) {
    return steps.filter((s) => s !== 'type');
  }
  return steps;
}

function eventToForm(event: CalendarEvent): ReturnType<typeof createDefaultFormState> {
  const record = event.record;
  const base = createDefaultFormState(event.moduleKey ?? 'office');
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
    eventType: record?.eventType ?? event.type,
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
  const { width, height } = useWindowDimensions();
  const { isDark, c } = useCareLightPalette();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const isEdit = !!editEvent;

  const steps = useMemo(() => resolveSteps(moduleKey, isEdit), [moduleKey, isEdit]);
  const [stepIndex, setStepIndex] = useState(0);
  const [template, setTemplate] = useState<CalendarEventTemplate | null>(preselectedTemplate);
  const [form, setForm] = useState(() => createDefaultFormState(moduleKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = steps[stepIndex] ?? 'template';

  const reset = useCallback(() => {
    setStepIndex(0);
    setTemplate(preselectedTemplate);
    setForm(editEvent ? eventToForm(editEvent) : createDefaultFormState(moduleKey));
    setError(null);
  }, [editEvent, moduleKey, preselectedTemplate]);

  useEffect(() => {
    if (!visible) return;
    reset();
  }, [visible, reset]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: isDark ? 'rgba(4,8,24,0.72)' : 'rgba(7,18,42,0.45)',
          justifyContent: 'flex-end',
          alignItems: 'center',
        },
        sheetHost: { width: Math.min(width, 680), maxHeight: height * 0.9, marginBottom: spacing.md },
        sheetInner: { flex: 1, minHeight: 0 },
        body: { padding: spacing.lg, gap: spacing.md },
        progress: { color: c.muted, fontSize: 11, fontWeight: '700', paddingHorizontal: spacing.lg },
        error: { color: '#F87171', fontSize: 13, paddingHorizontal: spacing.lg },
        actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.lg },
      }),
    [c.muted, height, isDark, width],
  );

  const handleSelectTemplate = (next: CalendarEventTemplate) => {
    setTemplate(next);
    setForm((prev) => ({
      ...prev,
      title: prev.title || next.label,
      sourceType: next.sourceType,
      eventType: next.eventType,
      allDay: next.allDay,
      templateKey: next.templateKey,
      endAt: new Date(
        new Date(prev.startAt).getTime() + next.defaultDurationMinutes * 60_000,
      ).toISOString(),
    }));
    goNext();
  };

  const handleContinueWithoutTemplate = () => {
    setTemplate(null);
    goNext();
  };

  const goNext = () => {
    if (step === 'basics' && !form.title.trim()) {
      setError('Bitte Titel ausfüllen.');
      return;
    }
    setError(null);
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    }
  };

  const goBack = () => {
    setError(null);
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const handleSave = async () => {
    if (!tenantId) {
      setError('Kein Mandant am Profil hinterlegt.');
      return;
    }
    if (!form.title.trim()) {
      setError('Bitte Titel ausfüllen.');
      return;
    }
    setSaving(true);
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
      startAt: form.startAt,
      endAt: form.endAt,
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
      existingSourceId: editEvent?.record?.sourceId ?? editEvent?.id ?? null,
      existingEventId: editEvent?.record?.id ?? null,
    };

    const result = isEdit
      ? await updateCalendarEventFromForm(payload, profile?.roleKey)
      : await createCalendarEventFromForm(payload, profile?.roleKey);

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated?.();
    onClose();
  };

  const modalTitle = isEdit
    ? 'Termin bearbeiten'
    : step === 'template'
      ? 'Neuer Kalendereintrag'
      : template?.label ?? 'Kalendereintrag anlegen';

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheetHost}>
          <GlassSurface radius={careRadius.lg} glowColor={accentColor} elevated style={styles.sheetInner}>
            <GradientModalHeader title={modalTitle} onClose={onClose} />
            <Text style={styles.progress}>
              Schritt {stepIndex + 1} von {steps.length}
            </Text>
            <ScrollView contentContainerStyle={styles.body}>
              <CalendarEventForm
                step={step}
                moduleKey={moduleKey}
                form={form}
                template={template}
                accentColor={accentColor}
                onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                onSelectTemplate={handleSelectTemplate}
                onContinueWithoutTemplate={handleContinueWithoutTemplate}
                onAssistEinsatzLink={() => {
                  onClose();
                  router.push('/assist/einsaetze/new' as never);
                }}
              />
            </ScrollView>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              {stepIndex > 0 ? (
                <PremiumButton title="Zurück" variant="secondary" onPress={goBack} />
              ) : (
                <PremiumButton title="Abbrechen" variant="secondary" onPress={onClose} />
              )}
              {step === 'preview' ? (
                <PremiumButton
                  title={saving ? 'Speichern…' : isEdit ? 'Aktualisieren' : 'Speichern'}
                  onPress={handleSave}
                  disabled={saving}
                />
              ) : step === 'template' ? null : (
                <PremiumButton title="Weiter" onPress={goNext} />
              )}
            </View>
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}

/** @deprecated Use CalendarEventCreateModal */
export const CalendarCreateModal = CalendarEventCreateModal;

export type CalendarCreateModalProps = CalendarEventCreateModalProps;
