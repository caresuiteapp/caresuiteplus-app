// Generated native presentation from src/components/office/ClientMasterDataNativeEditModal.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from "@/hooks/useNativePreventRemove.native";
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import { CareCatalogSelect, CareDateInput } from '@/components/inputs';
import { DetailInfoRow } from '@/components/detail';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { CLIENT_MASTER_DATA_SECTIONS } from '@/lib/clients/clientMasterDataSections';
import { confirmAction } from '@/lib/platform/confirmAction';
import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { spacing } from '@/theme';
import { subscribeClientIdentityEditWeb, viewClientIdentityEditWeb, chooseClientIdentityEditWeb, updateClientIdentityEditWeb, saveClientIdentityEditWeb, closeClientIdentityEditWeb, type ClientIdentityEditToken, type ClientIdentityEditField } from "../../lib/clients/clientRecordIdentityEditSession.native.ts";
/** The child receives one truly empty opaque token. Its safe view has exactly ten
 * fields, never an Original, whole draft, Auth owner, controller or native ACK. */
export function ClientMasterDataNativeEditModal({ token }: {
    token: ClientIdentityEditToken;
}) {
    const window = useNativeWorkflowWindow();
    const [, render] = useState(0);
    const navigation = useNavigation(), contentStyles = useAdaptiveContentStyles();
    const view = viewClientIdentityEditWeb(token);
    useEffect(() => subscribeClientIdentityEditWeb(token, () => render(value => value + 1)), [token]);
    // Current callbacks also guard before every action. Polling only updates the
    // visible projection when a native session expires between parent renders.
    useEffect(() => { const interval = setInterval(() => render(value => value + 1), 1000); return () => clearInterval(interval); }, [token]);
    const confirmDiscard = () => confirmAction({ title: 'Ungespeicherte Änderungen', message: 'Möchten Sie schließen und Ihre Eingaben verwerfen?', confirmLabel: 'Verwerfen', cancelLabel: 'Weiter bearbeiten' });
    const handleClose = async () => { await closeClientIdentityEditWeb(token, confirmDiscard); };
    const handleSave = async () => { await saveClientIdentityEditWeb(token); };
    const handleChoose = async () => { await chooseClientIdentityEditWeb(token, 'stammdaten'); };
    const handleInput = (field: ClientIdentityEditField, value: string) => { updateClientIdentityEditWeb(token, field, value); };
    usePreventRemove(!!view && (view.dirty || view.busy || view.unknown), ({ data }) => {
        void closeClientIdentityEditWeb(token, confirmDiscard, () => navigation.dispatch(data.action));
    });
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const unload = (event: BeforeUnloadEvent) => {
            const latest = viewClientIdentityEditWeb(token);
            if (latest && (latest.dirty || latest.busy || latest.unknown)) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', unload);
        return () => window.removeEventListener('beforeunload', unload);
    }, [token]);
    if (!view)
        return null;
    const labels: Record<ClientIdentityEditField, string> = { status: 'Status', salutation: 'Anrede', firstName: 'Vorname *', lastName: 'Nachname *', dateOfBirth: 'Geburtsdatum *', gender: 'Geschlecht', housingForm: 'Wohnform', admissionDate: 'Aufnahmedatum', serviceStart: 'Leistungsbeginn *', specialNotes: 'Interne Hinweise' };
    const field = (name: ClientIdentityEditField) => {
        const value = view.fields[name];
        if (!value)
            return null;
        if (!value.editable)
            return <DetailInfoRow key={name} label={labels[name]} value={value.state === 'not_requested' ? 'Nicht angefordert' : value.state === 'unresolved' ? 'Originalwert nicht bestätigt' : name === 'status' ? getCatalogLabel('client_status', value.value) : value.value || '—'}/>;
        if (name === 'status' || name === 'salutation' || name === 'gender' || name === 'housingForm')
            return <CareCatalogSelect key={name} catalogKey={name === 'status' ? 'client_status' : name === 'housingForm' ? 'housing_form' : name} label={labels[name]} value={value.value} onChange={next => handleInput(name, next)} error={value.error}/>;
        if (name === 'dateOfBirth' || name === 'admissionDate' || name === 'serviceStart')
            return <CareDateInput key={name} label={labels[name]} value={value.value} onChange={next => handleInput(name, next)} error={value.error} viewContext="form"/>;
        return <PremiumInput key={name} label={labels[name]} value={value.value} onChangeText={next => handleInput(name, next)} error={value.error} multiline={name === 'specialNotes'} hint={name === 'specialNotes' ? 'Nur für Office sichtbar' : undefined} viewContext="form"/>;
    };
    const blocked = view.busy || view.unknown;
    return (<AppGlassModal visible title={view.stage === 'choose' ? 'Klientenakte bearbeiten' : 'Stammdaten bearbeiten'} subtitle={view.stage === 'choose' ? 'Wählen Sie den Bereich, den Sie bearbeiten möchten.' : 'Identität & interne Hinweise'} onClose={() => void handleClose()} maxWidth={760} footerActions={[
            { title: 'Schließen', onPress: () => void handleClose(), variant: 'secondary', disabled: blocked },
            ...(view.stage === 'ready' ? [{ title: 'Speichern', onPress: () => void handleSave(), variant: 'glass' as const, disabled: !view.canSave, loading: view.busy }] : []),
        ]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {view.stage === 'choose' ? CLIENT_MASTER_DATA_SECTIONS.map(section => (<SectionPanel key={section.key} title={section.key === 'stammdaten' ? 'Identität & interne Hinweise' : section.title} subtitle={section.subtitle}>
            {section.key === 'stammdaten' ? <PremiumButton title="Diesen Bereich bearbeiten" onPress={() => void handleChoose()} variant="secondary"/> :
                <Text style={contentStyles.caption}>Dieser Bereich steht hier noch nicht zur Bearbeitung bereit.</Text>}
          </SectionPanel>)) : null}
        {view.stage === 'loading' ? <LoadingState presentation="inline" message="Eigene Formulargrundlage wird geladen…"/> : null}
        {view.stage === 'saving' ? <LoadingState presentation="inline" message="Änderungen werden gespeichert…"/> : null}
        {view.stage === 'uncertain' ? <ErrorState presentation="inline" message="Der Schreibausgang ist unbestätigt. Prüfen Sie die aktuelle Akte. Dieser Auftrag wird nicht erneut gesendet."/> : null}
        {view.stage === 'blocked' ? <ErrorState presentation="inline" message="Die Bearbeitung ist nicht mehr aktuell bestätigt. Schließen Sie dieses Fenster und öffnen Sie die aktuelle Akte erneut."/> : null}
        {view.stage === 'saved' ? <SuccessState presentation="inline" message="Identität und Hinweise wurden gespeichert."/> : null}
        {view.stage === 'unchanged' ? <InfoBanner presentation="inline" title="Keine Änderung" message="Die Angaben sind unverändert. Es wurde nichts geschrieben."/> : null}
        {view.stage === 'ready' ? (<SectionPanel title="Identität & interne Hinweise" viewContext="form">
            <View style={styles.fields}>{(Object.keys(labels) as ClientIdentityEditField[]).map(field)}</View>
            {!view.canSave && Object.values(view.fields).some(value => value?.state === 'unresolved' || value?.state === 'not_requested') ?
                <InfoBanner presentation="inline" title="Originalgrundlage prüfen" message="Einige Angaben sind nicht vollständig bestätigt. Speichern ist für diese Formulargrundlage gesperrt."/> : null}
          </SectionPanel>) : null}
      </ScrollView>
    </AppGlassModal>);
}
const styles = StyleSheet.create({ scroll: { flexGrow: 1 }, content: { gap: spacing.sm, paddingBottom: spacing.lg }, fields: { gap: spacing.sm } });
