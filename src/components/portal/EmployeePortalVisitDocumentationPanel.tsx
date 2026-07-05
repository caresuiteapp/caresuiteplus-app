import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { EmployeePortalVisitDocumentationAiModal } from '@/components/portal/EmployeePortalVisitDocumentationAiModal';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import type { EmployeePortalDocumentationInput } from '@/types/modules/employeePortalExecution';
import { spacing, typography } from '@/theme';

const QUICK_BLOCKS = [
  'Klient:in war anwesend und kooperativ.',
  'Haushaltliche Unterstützung wurde durchgeführt.',
  'Begleitung wurde wie geplant erbracht.',
  'Keine besonderen Vorkommnisse.',
  'Besonderheiten siehe Notiz.',
];

type EmployeePortalVisitDocumentationPanelProps = {
  disabled?: boolean;
  loading?: boolean;
  tenantId?: string | null;
  visible?: boolean;
  onClose?: () => void;
  embedded?: boolean;
  lastSavedAt?: string | null;
  initialShortDescription?: string;
  initialSpecialNotes?: string;
  photoReferences?: string[];
  openAiRequest?: number;
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
    initialShortDescription = '',
    initialSpecialNotes = '',
    photoReferences = [],
    openAiRequest = 0,
    onSubmit,
  },
  ref,
) {
  const text = useAuroraAdaptiveText();
  const deviceClass = useDeviceClass();
  const isMobile = !isDesktopClass(deviceClass);
  const [shortDescription, setShortDescription] = useState(initialShortDescription);
  const [specialNotes, setSpecialNotes] = useState(initialSpecialNotes);
  const [deviations, setDeviations] = useState('');
  const [deviationJustification, setDeviationJustification] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [showQuickBlocks, setShowQuickBlocks] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const lastAiRequest = useRef(0);
  const shortDescriptionRef = useRef(initialShortDescription);

  useEffect(() => {
    setSpecialNotes(initialSpecialNotes);
  }, [initialSpecialNotes]);

  useEffect(() => {
    if (openAiRequest <= lastAiRequest.current) return;
    lastAiRequest.current = openAiRequest;
    setShowAiModal(true);
  }, [openAiRequest]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        status: { ...typography.caption, color: text.muted, marginBottom: spacing.sm },
        fields: { gap: spacing.sm },
        toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        quickBlocks: { gap: spacing.xs, marginTop: spacing.xs },
        attachments: { ...typography.caption, color: text.muted },
        error: { ...typography.caption, color: '#EF4444' },
      }),
    [text],
  );

  const resolveShortDescription = () => {
    const fromState = shortDescription.trim() || shortDescriptionRef.current.trim();
    if (fromState) return fromState;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const el = document.querySelector(
        '[data-testid="portal-doc-short-description"]',
      ) as HTMLInputElement | HTMLTextAreaElement | null;
      return el?.value?.trim() ?? '';
    }
    return '';
  };

  const handleSubmit = useCallback(async () => {
    const effectiveShort = resolveShortDescription();
    const effectiveNotes = specialNotes.trim();
    if (!effectiveShort && !effectiveNotes) {
      setLocalError('Kurzbeschreibung ist erforderlich.');
      return;
    }
    if (deviations.trim() && !deviationJustification.trim()) {
      setLocalError('Abweichungen müssen begründet werden.');
      return;
    }
    setLocalError(null);
    const result = await onSubmit({
      shortDescription: effectiveShort || effectiveNotes,
      specialNotes: effectiveNotes || undefined,
      deviations: deviations.trim() || undefined,
      deviationJustification: deviationJustification.trim() || undefined,
      referralRequired: false,
      emergencyOrProblem: false,
      photoReferences: photoReferences.length ? photoReferences : undefined,
    });
    if (!result.ok) {
      setLocalError(result.error ?? 'Dokumentation konnte nicht gespeichert werden.');
    }
  }, [deviationJustification, deviations, onSubmit, photoReferences, shortDescription, specialNotes]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(),
    }),
    [handleSubmit],
  );

  const statusLabel = shortDescription.trim()
    ? lastSavedAt
      ? `Gespeichert · zuletzt ${new Date(lastSavedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
      : 'Begonnen'
    : 'Offen';

  const form = (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.status}>{statusLabel}</Text>
      <View style={styles.fields}>
        <PremiumInput
          label="Dokumentation *"
          testID="portal-doc-short-description"
          accessibilityLabel="Kurzbeschreibung Eingabe"
          value={shortDescription}
          onChangeText={(value) => {
            shortDescriptionRef.current = value;
            setShortDescription(value);
          }}
          placeholder="Was wurde geleistet?"
          multiline
          editable={!disabled}
        />
        <View style={styles.toolbar}>
          <PremiumButton
            title="Schnellbausteine"
            variant="ghost"
            size="sm"
            onPress={() => setShowQuickBlocks((v) => !v)}
          />
          <PremiumButton
            title="✨ KI-Hilfe"
            variant="ghost"
            size="sm"
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
                onPress={() => {
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
          <Text style={styles.attachments}>{photoReferences.length} Anhang/Anhänge werden mitgespeichert</Text>
        ) : null}
        <PremiumInput
          label="Besonderheiten"
          value={specialNotes}
          onChangeText={setSpecialNotes}
          multiline
          editable={!disabled}
        />
        <PremiumInput
          label="Abweichungen"
          value={deviations}
          onChangeText={setDeviations}
          multiline
          editable={!disabled}
        />
        {deviations.trim() ? (
          <PremiumInput
            label="Begründung Abweichung *"
            value={deviationJustification}
            onChangeText={setDeviationJustification}
            multiline
            editable={!disabled}
          />
        ) : null}
        {!disabled ? (
          <PremiumButton
            title="Dokumentation speichern"
            testID="portal-doc-save-button"
            fullWidth
            loading={loading}
            onPress={() => {
              void handleSubmit();
            }}
          />
        ) : null}
        {localError ? <Text style={styles.error}>{localError}</Text> : null}
      </View>
    </ScrollView>
  );

  const aiModal = (
    <EmployeePortalVisitDocumentationAiModal
      visible={showAiModal}
      tenantId={tenantId}
      sourceText={shortDescription}
      onClose={() => setShowAiModal(false)}
      onAccept={(textValue) => {
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
        subtitle={statusLabel}
        onClose={onClose ?? (() => {})}
        variant={isMobile ? 'bottomSheet' : 'center'}
        animationType={isMobile ? 'slide' : 'fade'}
        maxWidth={600}
      >
        {form}
      </PlatformModal>
      {aiModal}
    </>
  );
});
