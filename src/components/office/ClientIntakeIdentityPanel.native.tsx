// Generated native presentation from src/components/office/ClientIntakeIdentityPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorState, InfoBanner, PremiumInput } from '@/components/ui';
import { ClientWorkspaceButton, ClientWorkspacePanel } from './ClientWorkspacePrimitives';
import type { useClientIntakeWizard } from "../../hooks/pflege/useCareClientIntakeWizard.native.ts";
import { spacing } from '@/theme';
type Wizard = ReturnType<typeof useClientIntakeWizard>;
const statusLabels: Record<string, string> = {
    lead: 'Entwurf', active: 'Aktiv', paused: 'Pausiert', inactive: 'Inaktiv', archived: 'Archiviert',
    deceased: 'Verstorben', blocked: 'Gesperrt', deleted: 'Gelöscht',
    interessent: 'Interessent', aktiv: 'Aktiv', pausiert: 'Pausiert', archiviert: 'Archiviert', verstorben: 'Verstorben',
};
export function ClientIntakeIdentityPanel({ wizard, onOpenExisting }: {
    wizard: Wizard;
    onOpenExisting(id: string): Promise<void>;
}) {
    const review = wizard.identityReview;
    const [reason, setReason] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    useEffect(() => { setVisibleCount(10); setReason(''); }, [review?.candidates]);
    const run = async (operation: () => Promise<unknown>) => {
        if (busy)
            return;
        setBusy(true);
        setActionError(null);
        try {
            await operation();
        }
        catch {
            setActionError('Die Aktion konnte nicht bestätigt werden. Ihre Angaben bleiben erhalten. Bitte prüfen Sie die Aufnahme erneut.');
        }
        finally {
            setBusy(false);
        }
    };
    return (<ClientWorkspacePanel title="Vorhandene Person oder neue Aufnahme?" subtitle="Vor einer neuen Anlage die Identität abgleichen.">
      <Text style={styles.text}>Ihre Eingaben werden zunächst auf diesem Gerät gesichert. Die Prüfung sucht im eigenen Unternehmen nach dem angegebenen Nachnamen und einer vorhandenen Versicherungsnummer.</Text>
      {!wizard.canReviewIdentity ? <InfoBanner message="Für diese Prüfung werden die aktuellen Rechte zum Lesen der Akten und ihrer vertraulichen Angaben benötigt."/> : null}
      {wizard.identityBound ? <InfoBanner message="Dieser Entwurf gehört bereits zu einer Akte. Sie können ihn nach der Prüfung fortführen; eine andere Person wird dadurch nicht zugeordnet."/> : null}
      <View style={styles.actions}>
        <ClientWorkspaceButton label={review?.status === 'loading' ? 'Personen werden geprüft…' : 'Vorhandene Personen prüfen'} loading={review?.status === 'loading'} disabled={busy || !wizard.canReviewIdentity} onPress={() => void run(wizard.reviewIdentity)} compact style={styles.actionButton}/>
      </View>
      {review?.error ? <ErrorState message={review.error} presentation="inline"/> : null}
      {actionError ? <ErrorState message={actionError} presentation="inline"/> : null}
      {review?.status === 'ready' || review?.status === 'approved' ? (<>
          <Text style={styles.text}>{review.candidates.length === 0
                ? 'Im gelesenen Bestand wurden zu diesen Suchmerkmalen keine Personen gefunden. Bitte bestätigen Sie ausdrücklich, dass Sie eine neue Person anlegen möchten.'
                : `${review.candidates.length} mögliche ${review.candidates.length === 1 ? 'Person' : 'Personen'} gefunden. Vergleichen Sie die Angaben einzeln. Ein ähnlicher Name bestätigt keine Identität.`}</Text>
          {review.candidates.slice(0, visibleCount).map(candidate => (<View key={candidate.id} style={styles.candidate}>
              <Text style={styles.name}>{candidate.first_name || 'Vorname nicht angegeben'} {candidate.last_name || 'Nachname nicht angegeben'}</Text>
              <Text style={styles.text}>Geburtsdatum: {candidate.date_of_birth ?? 'Nicht angegeben'}</Text>
              <Text style={styles.text}>Versicherungsnummer: {candidate.insurance_number || 'Nicht angegeben'}</Text>
              <Text style={styles.meta}>Aktenstatus: {statusLabels[candidate.status] ?? 'Unbekannt'}</Text>
              <View style={styles.actions}>
                <ClientWorkspaceButton label="Diese bestehende Akte öffnen" disabled={busy || !wizard.canReviewIdentity || wizard.identityBound || candidate.status === 'deleted'} onPress={() => void run(() => onOpenExisting(candidate.id))} compact style={styles.actionButton}/>
              </View>
            </View>))}
          {visibleCount < review.candidates.length ? <ClientWorkspaceButton label={`Weitere Personen anzeigen (${review.candidates.length - visibleCount})`} onPress={() => setVisibleCount(value => value + 10)} compact style={styles.actionButton}/> : null}
          {!wizard.identityBound ? <Text style={styles.meta}>Beim Öffnen einer vorhandenen Akte werden die neuen Angaben nicht in diese Akte übernommen. Es wird keine Person angelegt oder zusammengeführt.</Text> : null}
          {review.exactConflict ? <InfoBanner message="Übereinstimmende Identitätsmerkmale gefunden. Eine weitere Person kann damit nicht angelegt werden. Bitte prüfen Sie die bestehende Akte."/> : (<>
              {review.candidates.length > 0 ? <PremiumInput label="Begründung für die getrennte Aufnahme" value={reason} onChangeText={setReason} multiline onLightSurface hint="Beschreiben Sie, anhand welcher Angaben Sie die Personen unterscheiden (10 bis 1.000 Zeichen)."/> : null}
              {review.status === 'approved' ? <InfoBanner message={wizard.identityBound ? 'Fortführung dieses Entwurfs ausdrücklich bestätigt.' : 'Getrennte Neuanlage ausdrücklich bestätigt. Vor dem Speichern wird der Bestand erneut geprüft.'}/> : null}
              <View style={styles.actions}>
                <ClientWorkspaceButton label={wizard.identityBound ? 'Diesen Entwurf fortführen' : 'Als neue Person fortfahren'} variant="primary" disabled={busy || !wizard.canReviewIdentity || review.status === 'approved'} onPress={() => void run(() => wizard.confirmNewPerson(reason))} compact style={styles.actionButton}/>
              </View>
            </>)}
        </>) : null}
    </ClientWorkspacePanel>);
}
const styles = StyleSheet.create({
    text: { color: '#17324D', fontSize: 14, lineHeight: 21, flexShrink: 1 },
    meta: { color: '#465C72', fontSize: 13, lineHeight: 20, flexShrink: 1 },
    name: { color: '#102A43', fontSize: 16, lineHeight: 23, fontWeight: '700', flexShrink: 1 },
    candidate: { borderWidth: 1, borderColor: '#CADCEE', borderRadius: 16, padding: spacing.md, gap: spacing.xs, backgroundColor: '#F7FBFF' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.xs, maxWidth: '100%' },
    actionButton: { maxWidth: '100%', flexShrink: 1 },
});
