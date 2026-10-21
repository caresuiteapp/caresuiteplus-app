import { useEffect, useState } from 'react';
import type { useClientIntakeWizard } from '@/hooks/useClientIntakeWizard';
import { usePermissions } from '@/hooks/usePermissions';
import { getIntakeFirstAppointment, type IntakeFirstAppointment } from '@/lib/clients/repositories/clientIntakeDraftRepository.supabase';
import { isDemoClientBackend } from '@/lib/clients/clientBackend';

export function ClientFirstContact({ wizard }: { wizard: ReturnType<typeof useClientIntakeWizard> }) {
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
        if (!alive) return;
        if (result.ok) { setAppointment(result.data); setCalendarError(''); }
        else setCalendarError(result.error);
      }).catch(() => { if (alive) setCalendarError('Der Kalendertermin konnte nicht geladen werden.'); });
    }
    return () => { alive = false; };
  }, [tenantId, draftClientId, canReadCalendar, reload, savedFeedback]);
  const textField = (key: 'firstName' | 'lastName' | 'phone' | 'mobile' | 'email' | 'city' | 'intakeContactPerson', label: string, type = 'text') => <label className="ci-contact-field"><span>{label}</span><input type={type} value={form[key] ?? ''} onChange={event => updateField(key, event.target.value)} aria-invalid={Boolean(errors[key])} />{errors[key] ? <small role="alert">{errors[key]}</small> : null}</label>;
  return <section className="ci-contact" aria-label="Erstkontakt erfassen">
    <div><h2>Erstkontakt vorbereiten</h2><p>Für den Anfang reichen ein Name und ein Kontaktweg. Geburtsdatum, Versorgung, Kostenträger und Unterschriften ergänzen Sie bei der vollständigen Aufnahme.</p></div>
    <div className="ci-contact-grid">
      {textField('firstName', 'Vorname')}{textField('lastName', 'Nachname *')}
      {textField('phone', 'Telefon')}{textField('mobile', 'Mobiltelefon')}
      {textField('email', 'E-Mail-Adresse', 'email')}{textField('city', 'Ort')}
      {textField('intakeContactPerson', 'Kontaktperson, falls abweichend')}
      <label className="ci-contact-field"><span>Anliegen / erste Hinweise</span><textarea rows={3} value={form.intakeContactNotes ?? ''} onChange={event => updateField('intakeContactNotes', event.target.value)} /></label>
    </div>
    <div className="ci-contact-calendar">
      <h3>Erster Termin</h3>
      {appointment ? <div role="status"><strong>{appointment.status === 'cancelled' || appointment.status === 'archiviert' ? 'Termin wurde entfernt' : 'Termin im Kalender vorhanden'}</strong><p>{new Date(appointment.startAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' })} – {new Date(appointment.endAt).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })} Uhr{appointment.location ? ` · ${appointment.location}` : ''}</p><p>Änderungen am vereinbarten Termin erfolgen im Kalender. Von dort können Sie diese Aufnahme öffnen.</p><a className="ci-button" href="/assist/calendar">Kalender öffnen</a></div> : <>
        <label className="ci-contact-check"><input type="checkbox" checked={Boolean(form.intakeAppointmentRequested)} disabled={(!canSchedule || Boolean(calendarError)) && !form.intakeAppointmentRequested} onChange={event => updateField('intakeAppointmentRequested', event.target.checked)} /><span>Ersten Termin im Kalender anlegen</span></label>
        {!canSchedule ? <p>Für die Terminplanung benötigen Sie die Berechtigung zur Terminbearbeitung. Der Erstkontakt lässt sich ohne Termin speichern.</p> : null}
        {form.intakeAppointmentRequested ? <div className="ci-contact-grid">
          <label className="ci-contact-field"><span>Beginn *</span><input type="datetime-local" value={form.intakeAppointmentStart ?? ''} onChange={event => updateField('intakeAppointmentStart', event.target.value)} aria-invalid={Boolean(errors.intakeAppointmentStart)} />{errors.intakeAppointmentStart ? <small role="alert">{errors.intakeAppointmentStart}</small> : null}</label>
          <label className="ci-contact-field"><span>Ende *</span><input type="datetime-local" value={form.intakeAppointmentEnd ?? ''} onChange={event => updateField('intakeAppointmentEnd', event.target.value)} aria-invalid={Boolean(errors.intakeAppointmentEnd)} />{errors.intakeAppointmentEnd ? <small role="alert">{errors.intakeAppointmentEnd}</small> : null}</label>
          <label className="ci-contact-field"><span>Ort / Treffpunkt</span><input value={form.intakeAppointmentLocation ?? ''} onChange={event => updateField('intakeAppointmentLocation', event.target.value)} /></label>
          <p>Uhrzeiten gelten für Deutschland (Europe/Berlin). Der Termin wird beim Speichern des Erstkontakts angelegt und bleibt intern.</p>
        </div> : <p>Sie können den Erstkontakt auch ohne vereinbarten Termin speichern.</p>}
      </>}
      {calendarError ? <div role="alert"><p>{calendarError}</p><button type="button" className="ci-button" onClick={() => setReload(value => value + 1)}>Termin erneut laden</button></div> : null}
    </div>
    <p>Die Leistungsbereiche können Sie unten vormerken oder beim Termin auswählen.</p>
  </section>;
}
