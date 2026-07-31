import { ScrollView, StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import { ClientIntakeSectionContent } from '@/components/office/clientintakewizardform';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useClientIntakeWizard } from '@/hooks/useClientIntakeWizard';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import {
  CLIENT_MASTER_DATA_SECTIONS,
  CLIENT_MASTER_DATA_SECTION_KEYS,
} from '@/lib/clients/clientMasterDataSections';
import { confirmAction } from '@/lib/platform/confirmAction';
import type { IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { spacing } from '@/theme';

export type ClientMasterDataEditModalProps = {
  visible: boolean;
  clientId: string;
  onClose: () => void;
  onSaved?: (clientId: string) => void;
};

function formsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const MASTER_SECTION_FIELDS: Partial<Record<
  IntakeSectionKey,
  (keyof ClientIntakeFormData)[]
>> = {
  leistungsart: ['careContexts'],
  stammdaten: [
    'status',
    'salutation',
    'firstName',
    'lastName',
    'dateOfBirth',
    'gender',
    'housingForm',
    'admissionDate',
    'serviceStart',
    'specialNotes',
  ],
  adresse_kontakt: [
    'street',
    'houseNumber',
    'zip',
    'city',
    'phone',
    'mobile',
    'email',
    'preferredContact',
  ],
  versorgung: [
    'careLevel',
    'careLevelStatus',
    'careLevelValidFrom',
    'familyDoctor',
    'supportWishes',
    'preferredTimes',
    'excludedTimes',
    'mobility',
    'orientation',
    'communication',
  ],
  kostentraeger: [
    'billingType',
    'billingTypes',
    'costBearerType',
    'costBearerTypes',
    'careFundName',
    'careFundStreet',
    'careFundZip',
    'careFundCity',
    'healthInsurance',
    'healthInsuranceStreet',
    'healthInsuranceZip',
    'healthInsuranceCity',
    'healthInsuranceIk',
    'privatversicherungName',
    'sozialamtName',
    'beihilfeName',
    'selbstzahlerName',
    'berufsgenossenschaftName',
    'unfallversicherungName',
    'sonstigerName',
    'costBearerIk',
    'insuranceNumber',
    'selfPay',
  ],
  angehoerige: ['emergencyContactName', 'emergencyContactPhone'],
  notfall_zugang: [
    'homeAccess',
    'keyStatus',
    'keyNumber',
    'keySafeCode',
    'doorCode',
    'bellName',
    'floor',
    'elevatorAvailable',
    'parkingNotes',
    'accessNotes',
    'hazardNotes',
    'facilityName',
    'careArea',
    'roomNumber',
    'pets',
    'smokerHousehold',
    'aidsOnSite',
    'hygieneNotes',
    'infectionNotes',
  ],
};

function resolveChangedSections(
  initial: ClientIntakeFormData | null,
  current: ClientIntakeFormData,
): IntakeSectionKey[] {
  if (!initial) return [];
  return CLIENT_MASTER_DATA_SECTION_KEYS.filter((section) =>
    (MASTER_SECTION_FIELDS[section] ?? []).some(
      (field) => !formsEqual(initial[field], current[field]),
    ));
}

/** Full master-data edit — scrollable sections with sticky modal footer. */
export function ClientMasterDataEditModal({
  visible,
  clientId,
  onClose,
  onSaved,
}: ClientMasterDataEditModalProps) {
  const contentStyles = useAdaptiveContentStyles();
  const wizard = useClientIntakeWizard({
    mode: 'edit',
    clientId,
    editSections: CLIENT_MASTER_DATA_SECTION_KEYS,
    validateOnSubmit: false,
  });
  const initialFormRef = useRef<ClientIntakeFormData | null>(null);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { flexGrow: 1 },
        scrollContent: { gap: spacing.sm, paddingBottom: spacing.lg },
        sectionWrap: { gap: spacing.xs },
      }),
    [],
  );

  const {
    form,
    loading,
    loadError,
    notFound,
    submitting,
    submitError,
    submit,
    isSuccess,
    createdId,
  } = wizard;

  useEffect(() => {
    if (!loading && !loadError && !notFound && initialFormRef.current === null) {
      initialFormRef.current = form;
    }
  }, [form, loadError, loading, notFound]);

  useEffect(() => {
    if (!visible) {
      initialFormRef.current = null;
    }
  }, [visible]);

  const changedSections = useMemo(
    () => resolveChangedSections(initialFormRef.current, form),
    [form],
  );
  const isDirty = changedSections.length > 0;

  const handleClose = useCallback(async () => {
    if (isDirty && !isSuccess) {
      const confirmed = await confirmAction({
        title: 'Ungespeicherte Änderungen',
        message: 'Möchten Sie wirklich schließen? Ihre Eingaben gehen verloren.',
        confirmLabel: 'Verwerfen',
        cancelLabel: 'Weiter bearbeiten',
      });
      if (!confirmed) return;
    }
    onClose();
  }, [isDirty, isSuccess, onClose]);

  const handleSave = async () => {
    const id = await submit(changedSections);
    if (id) {
      onSaved?.(id);
      onClose();
    }
  };

  let body = null;

  if (loading) {
    body = <LoadingState message="Stammdaten werden geladen…" />;
  } else if (notFound || loadError) {
    body = (
      <ErrorState
        title={notFound ? 'Nicht gefunden' : 'Fehler'}
        message={loadError ?? 'Der Datensatz existiert nicht.'}
      />
    );
  } else if (isSuccess && createdId) {
    body = <SuccessState message="Stammdaten wurden gespeichert." />;
  } else if (submitting) {
    body = <LoadingState message="Änderungen werden gespeichert…" />;
  } else {
    body = (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {CLIENT_MASTER_DATA_SECTIONS.map(({ key, title, subtitle }) => (
          <View key={key} style={styles.sectionWrap}>
            <SectionPanel
              title={key === 'stammdaten' ? 'Identität & interne Hinweise' : title}
              subtitle={subtitle}
            >
              {key === 'leistungsart' && wizard.form.careContexts.length === 0 ? (
                <EmptyState
                  title="Leistungsart wählen"
                  message="Wählen Sie mindestens eine Leistungsart."
                />
              ) : null}
              <ClientIntakeSectionContent
                section={key}
                wizard={wizard}
                contentStyles={contentStyles}
                panelViewContext="form"
                showIntakeOnlyFields={false}
              />
            </SectionPanel>
          </View>
        ))}
        {submitError ? <ErrorState message={submitError} /> : null}
      </ScrollView>
    );
  }

  return (
    <AppGlassModal
      visible={visible}
      title="Stammdaten bearbeiten"
      subtitle="Profilangaben unabhängig von Verträgen bearbeiten"
      onClose={() => void handleClose()}
      maxWidth={760}
      footerActions={
        !loading && !notFound && !loadError && !isSuccess
          ? [
              { title: 'Abbrechen', onPress: () => void handleClose(), variant: 'secondary' },
              {
                title: submitting ? 'Wird gespeichert…' : 'Speichern',
                onPress: handleSave,
                loading: submitting,
                disabled: submitting || !isDirty,
                variant: 'glass',
              },
            ]
          : [{ title: 'Schließen', onPress: onClose, variant: 'secondary' }]
      }
    >
      {body}
    </AppGlassModal>
  );
}
