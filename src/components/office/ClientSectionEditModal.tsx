import { StyleSheet, View } from 'react-native';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import { ClientIntakeSectionContent } from '@/components/office/clientintakewizardform';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessState,
} from '@/components/ui';
import { useClientIntakeWizard } from '@/hooks/useClientIntakeWizard';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { clientSectionEditTitle } from '@/lib/clients/clientSectionEditLabels';
import type { IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import { spacing } from '@/theme';

export type ClientSectionEditModalProps = {
  visible: boolean;
  clientId: string;
  section: IntakeSectionKey;
  onClose: () => void;
  onSaved?: (clientId: string) => void;
};

/** Section-specific edit modal — replaces intake wizard for existing records. */
export function ClientSectionEditModal({
  visible,
  clientId,
  section,
  onClose,
  onSaved,
}: ClientSectionEditModalProps) {
  const contentStyles = useAdaptiveContentStyles();
  const wizard = useClientIntakeWizard({ mode: 'edit', clientId });
  const {
    loading,
    loadError,
    notFound,
    submitting,
    submitError,
    submit,
    isSuccess,
    createdId,
  } = wizard;

  const handleSave = async () => {
    const id = await submit();
    if (id) {
      onSaved?.(id);
      onClose();
    }
  };

  let body = null;

  if (loading) {
    body = <LoadingState message="Daten werden geladen…" />;
  } else if (notFound || loadError) {
    body = (
      <ErrorState
        title={notFound ? 'Nicht gefunden' : 'Fehler'}
        message={loadError ?? 'Der Datensatz existiert nicht.'}
      />
    );
  } else if (isSuccess && createdId) {
    body = <SuccessState message="Änderungen wurden gespeichert." />;
  } else if (submitting) {
    body = <LoadingState message="Änderungen werden gespeichert…" />;
  } else {
    body = (
      <View style={styles.formContent}>
        {section === 'leistungsart' && wizard.form.careContexts.length === 0 ? (
          <EmptyState
            title="Leistungsart wählen"
            message="Wählen Sie mindestens eine Leistungsart."
          />
        ) : null}
        <ClientIntakeSectionContent section={section} wizard={wizard} contentStyles={contentStyles} />
        {submitError ? <ErrorState message={submitError} /> : null}
      </View>
    );
  }

  return (
    <AppGlassModal
      visible={visible}
      title={clientSectionEditTitle(section)}
      onClose={onClose}
      footerActions={
        !loading && !notFound && !loadError && !isSuccess
          ? [
              { title: 'Abbrechen', onPress: onClose, variant: 'secondary' },
              {
                title: 'Speichern',
                onPress: handleSave,
                loading: submitting,
                variant: 'glass',
              },
            ]
          : [{ title: 'Schließen', onPress: onClose, variant: 'secondary' }]
      }
    >
      <View style={styles.body}>{body}</View>
    </AppGlassModal>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 1 },
  formContent: { gap: spacing.sm, paddingBottom: spacing.md },
});
