// Generated native presentation from src/components/office/ClientFirstContact.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeLabel,NativeSpan,NativeInput,NativeSmall,NativeSection,NativeDiv,NativeH2,NativeP,NativeTextarea,NativeH3,NativeStrong,NativeA,NativeButton} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useState } from 'react';
import type { useClientIntakeWizard } from "../../hooks/useClientIntakeWizard.ts";
import { usePermissions } from '@/hooks/usePermissions';
import { getIntakeFirstAppointment, type IntakeFirstAppointment } from '@/lib/clients/repositories/clientIntakeDraftRepository.supabase';
import { isDemoClientBackend } from '@/lib/clients/clientBackend';
export function ClientFirstContact({ wizard }: {
    wizard: ReturnType<typeof useClientIntakeWizard>;
}) {
    const { form, errors, updateField, tenantId, draftClientId } = wizard;
    const { can } = usePermissions();
    const canSchedule = can('office.appointments.edit');
    const canReadCalendar = canSchedule || can('office.appointments.view');
    const [appointment, setAppointment] = useState<IntakeFirstAppointment | null>(null);
    const [calendarError, setCalendarError] = useState('');
    const [reload, setReload] = useState(0);
    const savedFeedback = wizard.draftSaveFeedback?.message;
    useEffect(() => { setAppointment(null); setCalendarError(''); }, [tenantId, draftClientId]);
    useEffect(() => {
        let alive = true;
        if (tenantId && draftClientId && canReadCalendar && !isDemoClientBackend()) {
            void getIntakeFirstAppointment(tenantId, draftClientId).then(result => {
                if (!alive)
                    return;
                if (result.ok) {
                    setAppointment(result.data);
                    setCalendarError('');
                }
                else
                    setCalendarError(result.error);
            }).catch(() => { if (alive)
                setCalendarError('Der Kalendertermin konnte nicht geladen werden.'); });
        }
        return () => { alive = false; };
    }, [tenantId, draftClientId, canReadCalendar, reload, savedFeedback]);
    const textField = (key: 'firstName' | 'lastName' | 'phone' | 'mobile' | 'email' | 'city' | 'intakeContactPerson', label: string, type = 'text') => <NativeLabel className="ci-contact-field"><NativeSpan>{label}</NativeSpan><NativeInput type={type} value={form[key] ?? ''} onChange={event => updateField(key, event.target.value)} aria-invalid={Boolean(errors[key])}/>{errors[key] ? <NativeSmall role="alert">{errors[key]}</NativeSmall> : null}</NativeLabel>;
    return <NativeSection className="ci-contact" aria-label="Erstkontakt erfassen">
    <NativeDiv><NativeH2>Erstkontakt vorbereiten</NativeH2><NativeP>Für den Anfang reichen ein Name und ein Kontaktweg. Geburtsdatum, Versorgung, Kostenträger und Unterschriften ergänzen Sie bei der vollständigen Aufnahme.</NativeP></NativeDiv>
    <NativeDiv className="ci-contact-grid">
      {textField('firstName', 'Vorname')}{textField('lastName', 'Nachname *')}
      {textField('phone', 'Telefon')}{textField('mobile', 'Mobiltelefon')}
      {textField('email', 'E-Mail-Adresse', 'email')}{textField('city', 'Ort')}
      {textField('intakeContactPerson', 'Kontaktperson, falls abweichend')}
      <NativeLabel className="ci-contact-field"><NativeSpan>Anliegen / erste Hinweise</NativeSpan><NativeTextarea rows={3} value={form.intakeContactNotes ?? ''} onChange={event => updateField('intakeContactNotes', event.target.value)}/></NativeLabel>
    </NativeDiv>
    <NativeDiv className="ci-contact-calendar">
      <NativeH3>Erster Termin</NativeH3>
      {appointment ? <NativeDiv role="status"><NativeStrong>{appointment.status === 'cancelled' || appointment.status === 'archiviert' ? 'Termin wurde entfernt' : 'Termin im Kalender vorhanden'}</NativeStrong><NativeP>{new Date(appointment.startAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' })} – {new Date(appointment.endAt).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })} Uhr{appointment.location ? ` · ${appointment.location}` : ''}</NativeP><NativeP>Änderungen am vereinbarten Termin erfolgen im Kalender. Von dort können Sie diese Aufnahme öffnen.</NativeP><NativeA className="ci-button" href="/assist/calendar">Kalender öffnen</NativeA></NativeDiv> : <>
        <NativeLabel className="ci-contact-check"><NativeInput type="checkbox" checked={Boolean(form.intakeAppointmentRequested)} disabled={(!canSchedule || Boolean(calendarError)) && !form.intakeAppointmentRequested} onChange={event => updateField('intakeAppointmentRequested', event.target.checked)}/><NativeSpan>Ersten Termin im Kalender anlegen</NativeSpan></NativeLabel>
        {!canSchedule ? <NativeP>Für die Terminplanung benötigen Sie die Berechtigung zur Terminbearbeitung. Der Erstkontakt lässt sich ohne Termin speichern.</NativeP> : null}
        {form.intakeAppointmentRequested ? <NativeDiv className="ci-contact-grid">
          <NativeLabel className="ci-contact-field"><NativeSpan>Beginn *</NativeSpan><NativeInput type="datetime-local" value={form.intakeAppointmentStart ?? ''} onChange={event => updateField('intakeAppointmentStart', event.target.value)} aria-invalid={Boolean(errors.intakeAppointmentStart)}/>{errors.intakeAppointmentStart ? <NativeSmall role="alert">{errors.intakeAppointmentStart}</NativeSmall> : null}</NativeLabel>
          <NativeLabel className="ci-contact-field"><NativeSpan>Ende *</NativeSpan><NativeInput type="datetime-local" value={form.intakeAppointmentEnd ?? ''} onChange={event => updateField('intakeAppointmentEnd', event.target.value)} aria-invalid={Boolean(errors.intakeAppointmentEnd)}/>{errors.intakeAppointmentEnd ? <NativeSmall role="alert">{errors.intakeAppointmentEnd}</NativeSmall> : null}</NativeLabel>
          <NativeLabel className="ci-contact-field"><NativeSpan>Ort / Treffpunkt</NativeSpan><NativeInput value={form.intakeAppointmentLocation ?? ''} onChange={event => updateField('intakeAppointmentLocation', event.target.value)}/></NativeLabel>
          <NativeP>Uhrzeiten gelten für Deutschland (Europe/Berlin). Der Termin wird beim Speichern des Erstkontakts angelegt und bleibt intern.</NativeP>
        </NativeDiv> : <NativeP>Sie können den Erstkontakt auch ohne vereinbarten Termin speichern.</NativeP>}
      </>}
      {calendarError ? <NativeDiv role="alert"><NativeP>{calendarError}</NativeP><NativeButton type="button" className="ci-button" onClick={() => setReload(value => value + 1)}>Termin erneut laden</NativeButton></NativeDiv> : null}
    </NativeDiv>
    <NativeP>Die Leistungsbereiche können Sie unten vormerken oder beim Termin auswählen.</NativeP>
  </NativeSection>;
}
