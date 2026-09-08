import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { EmployeePortalVisitDocumentationAiModal } from '@/components/portal/EmployeePortalVisitDocumentationAiModal';
import {
  employeePortalExecutionSurface,
  employeePortalExecutionText,
} from '@/lib/portal/employeePortalExecutionSurface';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import type { EmployeePortalDocumentationInput } from '@/types/modules/employeePortalExecution';
import { spacing, typography } from '@/theme';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';

const QUICK_BLOCKS = [
  'Klient:in war anwesend und kooperativ.',
  'Hauswirtschaftliche Unterstützung wurde durchgeführt.',
  'Begleitung wurde wie geplant erbracht.',
  'Keine besonderen Vorkommnisse.',
];

type EmployeePortalVisitDocumentationPanelProps = {
  disabled?: boolean;
  loading?: boolean;
  tenantId?: string | null;
  visible?: boolean;
  onClose?: () => void;
  embedded?: boolean;
  lastSavedAt?: string | null;
  initialDraftUnsaved?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  initialShortDescription?: string;
  initialSpecialNotes?: string;
  initialDeviations?: string;
  initialDeviationJustification?: string;
  photoReferences?: string[];
  openAiRequest?: number;
  onDraftChange?: (draft: {
    shortDescription: string;
    specialNotes: string;
    deviations: string;
    deviationJustification: string;
  }) => void;
  onSubmit: (doc: EmployeePortalDocumentationInput) => Promise<{ ok: boolean; error?: string }>;
};

export type EmployeePortalVisitDocumentationPanelHandle = {
  submit: () => Promise<void>;
};

export const EmployeePortalVisitDocumentationPanel = forwardRef<
  EmployeePortalVisitDocumentationPanelHandle,
  EmployeePortalVisitDocumentationPanelProps
>(function EmployeePortalVisitDocumentationPanel(
  {
    disabled = false,
    loading = false,
    tenantId = null,
    visible = true,
    onClose,
    embedded = false,
    lastSavedAt = null,
    initialDraftUnsaved = false,
    onDirtyChange,
    initialShortDescription = '',
    initialSpecialNotes = '',
    initialDeviations = '',
    initialDeviationJustification = '',
    photoReferences = [],
    openAiRequest = 0,
    onDraftChange,
    onSubmit,
  },
  ref,
) {
  const text = employeePortalExecutionText;
  const deviceClass = useDeviceClass();
  const isMobile = !isDesktopClass(deviceClass);
  const useBottomSheet = Platform.OS !== 'web' && isMobile;
  const [shortDescription, setShortDescription] = useState(initialShortDescription);
  const [specialNotes, setSpecialNotes] = useState(initialSpecialNotes);
  const [deviations, setDeviations] = useState(initialDeviations);
  const [deviationJustification, setDeviationJustification] = useState(
    initialDeviationJustification,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [showQuickBlocks, setShowQuickBlocks] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const lastAiRequest = useRef(0);
  const shortDescriptionRef = useRef(initialShortDescription);
  const editedRef = useRef(false);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(initialDraftUnsaved);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(lastSavedAt);
  const onDraftChangeRef = useRef(onDraftChange);
  const onDirtyChangeRef = useRef(onDirtyChange);
  const busy = loading || submitting;
  useUnsavedWebChanges(dirty, busy, 'Die Dokumentation enthält noch nicht gespeicherte Änderungen. Möchten Sie den Einsatz trotzdem verlassen?');
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { onDraftChangeRef.current = onDraftChange; onDirtyChangeRef.current = onDirtyChange; }, [onDraftChange, onDirtyChange]);
  useEffect(() => { onDirtyChangeRef.current?.(dirty); }, [dirty]);
  useEffect(() => { if (initialDraftUnsaved) setDirty(true); }, [initialDraftUnsaved]);
  useEffect(() => { if (lastSavedAt) setConfirmedAt(lastSavedAt); }, [lastSavedAt]);
  const markEdited = () => { editedRef.current = true; setDirty(true); setLocalError(null); };

  useEffect(() => {
    if (editedRef.current) return;
    shortDescriptionRef.current = initialShortDescription;
    setShortDescription(initialShortDescription);
  }, [initialShortDescription]);

  useEffect(() => {
    if (!editedRef.current) setSpecialNotes(initialSpecialNotes);
  }, [initialSpecialNotes]);

  useEffect(() => {
    if (!editedRef.current) setDeviations(initialDeviations);
  }, [initialDeviations]);

  useEffect(() => {
    if (!editedRef.current) setDeviationJustification(initialDeviationJustification);
  }, [initialDeviationJustification]);

  useEffect(() => {
    if (!editedRef.current || !dirty) return;
    onDraftChangeRef.current?.({
      shortDescription,
      specialNotes,
      deviations,
      deviationJustification,
    });
  }, [deviationJustification, deviations, dirty, shortDescription, specialNotes]);

  useEffect(() => {
    if (openAiRequest <= lastAiRequest.current) return;
    lastAiRequest.current = openAiRequest;
    setShowAiModal(true);
  }, [openAiRequest]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        status: { fontSize: font(14), lineHeight: font(21), color: text.muted, marginBottom: spacing.sm },
        modalSheet: { backgroundColor: employeePortalExecutionSurface.background },
        modalBody: { backgroundColor: employeePortalExecutionSurface.background },
        form: { width: '100%', minWidth: 0 },
        fields: { gap: spacing.sm },
        toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        quickBlocks: { gap: spacing.xs, marginTop: spacing.xs },
        attachments: { fontSize: font(14), lineHeight: font(21), color: text.muted },
        privacyBox: {
          gap: 3,
          padding: spacing.sm,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(14, 165, 233, 0.32)',
          backgroundColor: 'rgba(14, 165, 233, 0.08)',
        },
        privacyTitle: { fontSize: font(17), lineHeight: font(23), fontWeight: '700', color: text.primary },
        privacyText: { fontSize: font(15), lineHeight: font(22), color: text.secondary },
        error: { fontSize: font(15), lineHeight: font(22), color: '#AD263F' },
      }),
    [text],
  );

  const resolveShortDescription = useCallback(() => {
    const fromState = shortDescription.trim() || shortDescriptionRef.current.trim();
    if (fromState) return fromState;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const el = document.querySelector(
        '[data-testid="portal-doc-short-description"]',
      ) as HTMLInputElement | HTMLTextAreaElement | null;
      return el?.value?.trim() ?? '';
    }
    return '';
  }, [shortDescription]);

  const handleSubmit = useCallback(async () => {
    if (disabled || loading || submittingRef.current) return;
    const effectiveShort = resolveShortDescription();
    const effectiveNotes = specialNotes.trim();
    if (!effectiveShort) {
      setLocalError('Die Leistungsdokumentation ist erforderlich.');
      return;
    }
    if (deviations.trim() && !deviationJustification.trim()) {
      setLocalError('Abweichungen müssen begründet werden.');
      return;
    }
    setLocalError(null);
    submittingRef.current = true;
    setSubmitting(true);
    try {
    const result = await onSubmit({
      shortDescription: effectiveShort,
      specialNotes: effectiveNotes || undefined,
      deviations: deviations.trim() || undefined,
      deviationJustification: deviationJustification.trim() || undefined,
      referralRequired: false,
      emergencyOrProblem: false,
      photoReferences: photoReferences.length ? photoReferences : undefined,
    });
    if (!mountedRef.current) return;
    if (!result.ok) {
      setLocalError(result.error ?? 'Dokumentation konnte nicht gespeichert werden. Ihre Eingaben bleiben erhalten.');
    } else {
      editedRef.current = false;
      setDirty(false);
      onDirtyChangeRef.current?.(false);
      setConfirmedAt(new Date().toISOString());
    }
    } catch {
      if (mountedRef.current) setLocalError('Die Speicherung konnte nicht bestätigt werden. Ihre Eingaben bleiben in diesem Fenster erhalten.');
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  }, [disabled, loading, deviationJustification, deviations, onSubmit, photoReferences, resolveShortDescription, specialNotes]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(),
    }),
    [handleSubmit],
  );

  const statusLabel = busy ? 'Dokumentation wird gespeichert …'
    : dirty ? 'Änderungen noch nicht auf dem Server gespeichert'
      : confirmedAt ? `Gespeichert · zuletzt ${new Date(confirmedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
        : shortDescription.trim() ? 'Dokumentation geladen' : 'Noch keine Dokumentation';

  const form = (
    <View style={styles.form} testID="employee-visit-documentation-form">
      <Text style={styles.status} accessibilityLiveRegion="polite">{statusLabel}</Text>
      <View style={styles.fields}>
        <View style={styles.privacyBox}>
          <Text style={styles.privacyTitle}>Klientensichtbare Dokumentation</Text>
          <Text style={styles.privacyText}>
            Nur der Inhalt dieses Feldes erscheint im Leistungsnachweis und im Klient:innenportal.
          </Text>
        </View>
        <PremiumInput
          label="Leistungsdokumentation *"
          testID="portal-doc-short-description"
          accessibilityLabel="Kurzbeschreibung Eingabe"
          value={shortDescription}
          onChangeText={(value) => {
            markEdited();
            shortDescriptionRef.current = value;
            setShortDescription(value);
          }}
          placeholder="Sachlich beschreiben, welche vereinbarten Leistungen durchgeführt wurden …"
          multiline
          editable={!disabled && !busy}
        />
        <View style={styles.toolbar}>
          <PremiumButton
            title="Schnellbausteine"
            variant="ghost"
            size="sm"
            disabled={disabled || busy}
            onPress={() => setShowQuickBlocks((v) => !v)}
          />
          <PremiumButton
            title="KI-Hilfe"
            variant="ghost"
            size="sm"
            disabled={disabled || busy}
            onPress={() => setShowAiModal(true)}
          />
        </View>
        {showQuickBlocks ? (
          <View style={styles.quickBlocks}>
            {QUICK_BLOCKS.map((block) => (
              <PremiumButton
                key={block}
                title={block}
                variant="secondary"
                size="sm"
                disabled={disabled || busy}
                onPress={() => {
                  markEdited();
                  const next = shortDescription.trim()
                    ? `${shortDescription.trim()}\n${block}`
                    : block;
                  shortDescriptionRef.current = next;
                  setShortDescription(next);
                }}
              />
            ))}
          </View>
        ) : null}
        {photoReferences.length > 0 ? (
          <Text style={styles.attachments}>
            {photoReferences.length} interne Datei(en) am Einsatz gespeichert – nicht im Leistungsnachweis.
          </Text>
        ) : null}
        <View style={styles.privacyBox}>
          <Text style={styles.privacyTitle}>Nur intern</Text>
          <Text style={styles.privacyText}>
            Die folgenden Angaben sind ausschließlich für Verwaltung und Qualitätssicherung bestimmt.
          </Text>
        </View>
        <PremiumInput
          label="Interne Nachricht an die Verwaltung"
          value={specialNotes}
          onChangeText={(value) => { markEdited(); setSpecialNotes(value); }}
          placeholder="Interne Hinweise, Rückfragen oder Beobachtungen – niemals klientensichtbar"
          multiline
          editable={!disabled && !busy}
        />
        <PremiumInput
          label="Abweichungen"
          value={deviations}
          onChangeText={(value) => { markEdited(); setDeviations(value); }}
          multiline
          editable={!disabled && !busy}
        />
        {deviations.trim() ? (
          <PremiumInput
            label="Interne Begründung der Abweichung *"
            value={deviationJustification}
            onChangeText={(value) => { markEdited(); setDeviationJustification(value); }}
            multiline
            editable={!disabled && !busy}
          />
        ) : null}
        {!disabled ? (
          <PremiumButton
            title="Dokumentation und interne Angaben sicher speichern"
            testID="portal-doc-save-button"
            fullWidth
            loading={busy}
            disabled={busy}
            onPress={() => {
              void handleSubmit();
            }}
          />
        ) : null}
        {localError ? <Text style={styles.error} accessibilityRole="alert">{localError}</Text> : null}
      </View>
    </View>
  );

  const aiModal = (
    <EmployeePortalVisitDocumentationAiModal
      visible={showAiModal}
      tenantId={tenantId}
      sourceText={shortDescription}
      onClose={() => setShowAiModal(false)}
      onAccept={(textValue) => {
        if (disabled || submittingRef.current || loading) return;
        markEdited();
        shortDescriptionRef.current = textValue;
        setShortDescription(textValue);
        setShowAiModal(false);
      }}
    />
  );

  if (embedded) {
    return (
      <>
        {form}
        {aiModal}
      </>
    );
  }

  return (
    <>
      <PlatformModal
        visible={visible}
        title="Dokumentation"
        onClose={() => { if (!busy) onClose?.(); }}
        variant={useBottomSheet ? 'bottomSheet' : 'center'}
        animationType={useBottomSheet ? 'slide' : 'fade'}
        maxWidth={820}
        dismissOnBackdrop={false}
        surfaceScope="personal"
        sheetStyle={styles.modalSheet}
        bodyStyle={styles.modalBody}
      >
        {form}
      </PlatformModal>
      {aiModal}
    </>
  );
});
