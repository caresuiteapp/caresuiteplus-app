// Generated native presentation from src/features/beratung/ConsultationFirstContact.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto,nativeNavigator as navigator} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeLabel,NativeSpan,NativeInput,NativeSmall,NativeForm,NativeDiv,NativeH3,NativeP,NativeA,NativeFieldset,NativeStrong,NativeButton,NativeH4,NativeTextarea,NativeDetails,NativeSummary,NativeSelect,NativeOption} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useId, useRef, useState } from 'react';
import { upsertClientIntakeDraft } from '@/lib/clients/repositories/clientIntakeDraftWriter.supabase';
import { clientIntakeResumeRoute } from '@/lib/navigation/clientRoutes';
import { consultationContactErrors, consultationContactForm, consultationContactSelection, emptyConsultationContact, matchingConsultationContacts, type ConsultationContactDraft, type ConsultationContactInput } from '@/lib/beratung/firstContact';
import { clearConsultationContactDraft, keepConsultationContactDraft, readConsultationContactDraft } from '@/lib/beratung/workspaceDrafts';
import type { ConsultationClient } from '@/lib/beratung/workspaceModel';
export function ConsultationFirstContact({ tenantId, draftScope, clients, onSaved, onSelect, onBack, onBusyChange }: {
    tenantId: string;
    draftScope: string;
    clients: ConsultationClient[];
    onSaved: (client: ConsultationClient, notes: string) => void;
    onSelect: (client: ConsultationClient) => void;
    onBack: () => void;
    onBusyChange: (busy: boolean) => void;
}) {
    const [draft, setDraft] = useState<ConsultationContactDraft>(() => readConsultationContactDraft(draftScope)
        ?? { input: emptyConsultationContact(), clientId: crypto.randomUUID() });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const alive = useRef(true);
    const formRef = useRef<HTMLFormElement>(null);
    const prefix = useId();
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const updateDraft = (next: ConsultationContactDraft) => {
        keepConsultationContactDraft(draftScope, next);
        setDraft(next);
    };
    function update(key: keyof ConsultationContactInput, value: string) {
        if (lock.current || draft.pending)
            return;
        updateDraft({ ...draft, input: { ...draft.input, [key]: value } });
        setErrors(previous => ({ ...previous, [key]: '' }));
        setError('');
    }
    async function save() {
        if (lock.current)
            return;
        const issues = consultationContactErrors(draft.input);
        setErrors(issues);
        if (Object.keys(issues).length) {
            if (issues.dateOfBirth) {
                const details = formRef.current?.querySelector('details');
                if (details)
                    details.open = true;
            }
            formRef.current?.querySelector<HTMLInputElement>(`[name="${Object.keys(issues)[0]}"]`)?.focus();
            return;
        }
        if (!navigator.onLine) {
            setError('Keine Netzverbindung. Die Eckdaten bleiben geöffnet. Bitte nach Wiederherstellung der Verbindung speichern.');
            return;
        }
        const attempt = draft.pending ?? { clientId: draft.clientId, operationId: crypto.randomUUID(), form: consultationContactForm(draft.input) };
        updateDraft({ ...draft, pending: attempt });
        lock.current = true;
        setBusy(true);
        onBusyChange(true);
        setError('');
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const result = await Promise.race([
                upsertClientIntakeDraft(tenantId, attempt.form, { clientId: attempt.clientId, expectedRevision: 0, operationId: attempt.operationId }),
                new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Die Speicherung ist noch nicht bestätigt. Bitte denselben Vorgang erneut prüfen.')), 20000); }),
            ]);
            if (!alive.current)
                return;
            if (!result.ok) {
                // Only a definite SQL rejection permits editing. Uncertain writes retain
                // their exact identity and payload, including after closing this dialog.
                if (result.rejected && !result.conflict)
                    updateDraft({ ...draft, pending: undefined });
                setError(result.error);
                return;
            }
            clearConsultationContactDraft(draftScope);
            onSaved(consultationContactSelection(result.data.clientId, attempt.form), [
                attempt.form.intakeContactPerson ? `Kontaktperson: ${attempt.form.intakeContactPerson}` : '', attempt.form.intakeContactNotes,
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            if (alive.current)
                setError(e instanceof Error ? e.message : 'Die Speicherung konnte nicht bestätigt werden. Bitte erneut prüfen.');
        }
        finally {
            if (timer)
                clearTimeout(timer);
            lock.current = false;
            if (alive.current) {
                setBusy(false);
                onBusyChange(false);
            }
        }
    }
    const candidates = draft.pending ? [] : matchingConsultationContacts(draft.input, clients);
    const field = (key: keyof ConsultationContactInput, label: string, options: {
        type?: string;
        required?: boolean;
        autocomplete?: string;
        maxLength?: number;
    } = {}) => {
        const errorId = `${prefix}-${key}-error`;
        return <NativeLabel className="cw-field"><NativeSpan>{label}{options.required ? ' *' : ''}</NativeSpan>
      <NativeInput name={key} type={options.type ?? 'text'} value={draft.input[key]} onChange={e => update(key, e.target.value)} required={options.required} maxLength={options.maxLength ?? 200} autoComplete={options.autocomplete} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? errorId : undefined}/>
      {errors[key] && <NativeSmall className="cw-contact-error" id={errorId}>{errors[key]}</NativeSmall>}
    </NativeLabel>;
    };
    return <NativeForm ref={formRef} className="cw-first-contact" onSubmit={e => { e.preventDefault(); void save(); }} noValidate>
    <NativeDiv className="cw-contact-intro"><NativeSpan className="cw-kicker">ZENTRALE KLIENTENAKTE</NativeSpan><NativeH3>Eckdaten für den Erstbesuch</NativeH3>
      <NativeP>Die Angaben werden unter „Klienten“ gespeichert und hier für die Beratung übernommen. Für den Anfang reichen Nachname und ein Kontaktweg.</NativeP></NativeDiv>
    {draft.pending && !busy && <NativeDiv className="cw-alert cw-alert-warning" role="status">Die letzte Speicherung ist noch offen. Prüfen Sie sie erneut, damit dieselbe Klientenakte übernommen wird.
      <NativeA href={clientIntakeResumeRoute(draft.clientId)} target="_blank" rel="noopener noreferrer">Gespeicherte Aufnahme prüfen</NativeA></NativeDiv>}
    <NativeFieldset className="cw-reset-fieldset" disabled={busy || Boolean(draft.pending)}>
      <NativeDiv className="cw-contact-grid">
        {field('firstName', 'Vorname', { autocomplete: 'given-name' })}{field('lastName', 'Nachname', { required: true, autocomplete: 'family-name' })}
        {field('phone', 'Telefon', { type: 'tel', autocomplete: 'tel', maxLength: 60 })}{field('email', 'E-Mail-Adresse', { type: 'email', autocomplete: 'email' })}
        {field('mobile', 'Mobiltelefon', { type: 'tel', maxLength: 60 })}{field('intakeContactPerson', 'Abweichende Kontaktperson')}
      </NativeDiv>
      {candidates.length > 0 && <NativeDiv className="cw-contact-matches" role="status"><NativeStrong>Möglicherweise bereits vorhanden</NativeStrong><NativeP>Name oder Telefonnummer passen zu einer vorhandenen Akte. Sie können diese direkt übernehmen.</NativeP>
        {candidates.map(c => <NativeButton type="button" className="cw-contact-match" key={c.id} onClick={() => { clearConsultationContactDraft(draftScope); onSelect(c); }}>
          <NativeSpan><NativeStrong>{c.name}</NativeStrong><NativeSmall>{c.address || 'Adresse noch offen'}</NativeSmall></NativeSpan><NativeSpan>Übernehmen →</NativeSpan></NativeButton>)}</NativeDiv>}
      <NativeH4>Adresse für den Besuch</NativeH4>
      <NativeDiv className="cw-contact-address">{field('street', 'Straße', { autocomplete: 'address-line1' })}{field('houseNumber', 'Hausnummer', { maxLength: 20 })}</NativeDiv>
      <NativeDiv className="cw-contact-postal">{field('zip', 'Postleitzahl', { autocomplete: 'postal-code', maxLength: 5 })}{field('city', 'Ort', { autocomplete: 'address-level2' })}</NativeDiv>
      <NativeLabel className="cw-field"><NativeSpan>Anliegen / erste Hinweise</NativeSpan><NativeTextarea rows={3} maxLength={3000} value={draft.input.intakeContactNotes} onChange={e => update('intakeContactNotes', e.target.value)}/></NativeLabel>
      <NativeDetails className="cw-contact-details"><NativeSummary>Weitere bekannte Angaben</NativeSummary><NativeDiv className="cw-contact-grid">
        {field('dateOfBirth', 'Geburtsdatum', { type: 'date', autocomplete: 'bday' })}
        <NativeLabel className="cw-field"><NativeSpan>Pflegegrad</NativeSpan><NativeSelect value={draft.input.careLevel} onChange={e => update('careLevel', e.target.value)}>
          <NativeOption value="">Noch offen</NativeOption><NativeOption value="kein">Kein Pflegegrad</NativeOption>{[1, 2, 3, 4, 5].map(n => <NativeOption key={n} value={`pg${n}`}>Pflegegrad {n}</NativeOption>)}</NativeSelect></NativeLabel>
      </NativeDiv><NativeLabel className="cw-field"><NativeSpan>Zugang / Hinweise zum Besuch</NativeSpan><NativeTextarea rows={2} maxLength={2000} value={draft.input.accessNotes} onChange={e => update('accessNotes', e.target.value)}/></NativeLabel></NativeDetails>
    </NativeFieldset>
    {error && <NativeP className="cw-alert cw-alert-error" role="alert">{error}</NativeP>}
    <NativeDiv className="cw-actions"><NativeButton type="button" className="cw-button" disabled={busy} onClick={onBack}>Zur Klientenauswahl</NativeButton>
      <NativeButton type="submit" className="cw-button cw-primary" disabled={busy}>{busy ? 'Eckdaten werden gespeichert …' : draft.pending ? 'Speicherung erneut prüfen' : 'Eckdaten speichern & übernehmen'}</NativeButton></NativeDiv>
  </NativeForm>;
}
