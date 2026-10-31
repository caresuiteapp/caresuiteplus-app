import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { CalendarEventTemplate, CalendarModuleKey } from '@/types/calendar';
import type { CalendarEventFormState, CalendarFormStep } from '@/types/calendar/calendarEventForm';
import type { CareEntityOption } from '@/components/inputs/CareEntitySelect';
import { berlinTimestamp } from '@/lib/calendar/employeeMonthPlanning';
import { calendarEmployeeIds } from '@/lib/calendar/calendarParticipants';
import { CalendarEventTemplatePicker } from './CalendarEventTemplatePicker.web';
import { CalendarEventPreviewStep } from './CalendarEventPreviewStep.web';

type Props = {
  step: CalendarFormStep; moduleKey: CalendarModuleKey; form: CalendarEventFormState;
  template: CalendarEventTemplate | null; accentColor?: string;
  onChange: (patch: Partial<CalendarEventFormState>) => void;
  onSelectTemplate: (template: CalendarEventTemplate) => void;
  onContinueWithoutTemplate: () => void;
  onChooseCalendarEntry?: () => void; onAssistEinsatzLink?: () => void;
  clients?: CareEntityOption[]; employees?: CareEntityOption[]; peopleLoading?: boolean; disabled?: boolean;
};
function Heading({ title, children }: { title: string; children: ReactNode }) {
  return <header className="cd-step-header"><h2>{title}</h2><p className="cd-muted">{children}</p></header>;
}
function Field({ label, value, onChange, placeholder, multiline, full, disabled }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; full?: boolean; disabled?: boolean;
}) {
  return <label className={`cd-field${full ? ' cd-full' : ''}`}><span>{label}</span>{multiline
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} maxLength={5000} />
    : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} maxLength={250} />}</label>;
}
function Toggle({ title, description, value, onChange, disabled }: {
  title: string; description: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean;
}) {
  return <label className="cd-toggle"><input type="checkbox" checked={value} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span><strong>{title}</strong><small>{description}</small></span></label>;
}
function PersonSelect({ label, value, options, onChange, disabled, loading }: {
  label: string; value: string; options: CareEntityOption[]; onChange: (value: string) => void; disabled: boolean; loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const inputId = useId();
  const filtered = options.filter(person => person.value === value || person.label.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE')));
  return <div className="cd-field cd-full"><label htmlFor={inputId}>{label}</label>
    {options.length > 8 ? <input type="search" aria-label={`${label} suchen`} placeholder="Name suchen…" value={search} onChange={e => setSearch(e.target.value)} disabled={disabled || loading} /> : null}
    <select id={inputId} value={value} onChange={e => onChange(e.target.value)} disabled={disabled || loading}>
      <option value="">{loading ? 'Wird geladen…' : 'Keine Zuordnung'}</option>{filtered.map(person => <option key={person.value} value={person.value}>{person.label}</option>)}
    </select>{search && !filtered.length ? <small>Keine passende Person gefunden.</small> : null}
  </div>;
}
function EmployeeMultiSelect({ values, options, onChange, disabled, loading }: {
  values: string[]; options: CareEntityOption[]; onChange: (values: string[]) => void; disabled: boolean; loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const hintId = useId();
  const query = search.trim().toLocaleLowerCase('de-DE');
  const filtered = options.filter(person => person.label.toLocaleLowerCase('de-DE').includes(query));
  const peopleById = new Map(options.map(person => [person.value, person]));
  const selected = new Set(values);
  const locked = disabled || loading;
  return <fieldset className="cd-field cd-people cd-full" disabled={locked} aria-describedby={hintId}>
    <legend>Mitarbeitende</legend>
    <p id={hintId} className="cd-muted">Mehrere Personen auswählen oder das gesamte Team hinzufügen.</p>
    <div className="cd-people-toolbar">
      <label className="cd-field cd-people-search"><span className="cd-sr-only">Mitarbeitende suchen</span><input type="search" placeholder="Mitarbeitende suchen…" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <button type="button" className="cd-link" disabled={locked || !options.some(person => !selected.has(person.value))} onClick={() => onChange([...new Set([...values, ...options.map(person => person.value)])])}>Alle auswählen</button>
      <button type="button" className="cd-link" disabled={locked || !values.length} onClick={() => onChange([])}>Auswahl aufheben</button>
    </div>
    <p role="status" className="cd-muted">{loading ? 'Mitarbeitende werden geladen…' : `${values.length} ${values.length === 1 ? 'Person ausgewählt' : 'Personen ausgewählt'}`}</p>
    {values.length ? <ul className="cd-people-selected" aria-label="Ausgewählte Mitarbeitende">{values.map(id => {
      const person = peopleById.get(id);
      const name = person?.label ?? 'Nicht mehr verfügbare Person';
      return <li key={id}><span>{name}</span><button type="button" disabled={locked} aria-label={`${name} aus Auswahl entfernen`} onClick={() => onChange(values.filter(value => value !== id))}>×</button></li>;
    })}</ul> : null}
    <div className="cd-people-options">{filtered.map(person => <label key={person.value} className="cd-person-option">
      <input type="checkbox" checked={selected.has(person.value)} onChange={event => onChange(event.target.checked ? [...values, person.value] : values.filter(id => id !== person.value))} />
      <span>{person.label}</span>
    </label>)}{!loading && !filtered.length ? <p className="cd-muted">{query ? 'Keine passenden Mitarbeitenden gefunden.' : 'Keine Mitarbeitenden verfügbar.'}</p> : null}</div>
  </fieldset>;
}
function partsFor(value: string, allDay: boolean) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { date: '', time: '' };
  return { date: allDay ? value.slice(0, 10) : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(date),
    time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date) };
}
function DateTimeField({ label, value, allDay, end, disabled, onChange }: {
  label: string; value: string; allDay: boolean; end?: boolean; disabled: boolean; onChange: (value: string) => void;
}) {
  const [parts, setParts] = useState(() => partsFor(value, allDay));
  const [error, setError] = useState('');
  const emitted = useRef(value);
  const previousAllDay = useRef(allDay);
  useEffect(() => {
    if (value === emitted.current && allDay === previousAllDay.current) return;
    emitted.current = value; previousAllDay.current = allDay; setParts(partsFor(value, allDay)); setError('');
  }, [allDay, value]);
  const change = (patch: Partial<typeof parts>) => {
    const next = { ...parts, ...patch }; setParts(next);
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(next.date)) throw new Error('Bitte ein vollständiges Datum wählen.');
      if (!allDay && !/^([01]\d|2[0-3]):[0-5]\d$/.test(next.time)) throw new Error('Bitte eine vollständige Uhrzeit wählen.');
      const nextValue = allDay ? `${next.date}T${end ? '23:59:59.999' : '00:00:00.000'}Z` : berlinTimestamp(next.date, next.time);
      if (!Number.isFinite(Date.parse(nextValue))) throw new Error('Bitte Datum und Uhrzeit prüfen.');
      emitted.current = nextValue; onChange(nextValue); setError('');
    } catch (cause) { emitted.current = ''; onChange(''); setError(cause instanceof Error ? cause.message : 'Datum und Uhrzeit prüfen.'); }
  };
  return <div className="cd-panel cd-stack"><h3>{label}</h3><label className="cd-field"><span>Datum</span><input type="date" aria-label={`${label}: Datum`} value={parts.date} disabled={disabled} onChange={e => change({ date: e.target.value })} /></label>
    {!allDay ? <label className="cd-field"><span>Uhrzeit</span><input type="time" aria-label={`${label}: Uhrzeit`} value={parts.time} disabled={disabled} onChange={e => change({ time: e.target.value })} /></label> : null}
    {error ? <p role="alert" className="cd-alert">{error}</p> : null}
  </div>;
}
export function CalendarEventForm({ step, moduleKey, form, template, onChange, onSelectTemplate, onContinueWithoutTemplate, onChooseCalendarEntry, onAssistEinsatzLink,
  clients = [], employees = [], peopleLoading = false, disabled = false }: Props) {
  if (step === 'type') return <><Heading title="Was möchtest du planen?">Termine und Einsätze bleiben mit den passenden Daten verknüpft.</Heading><div className="cd-grid">
    <button type="button" className="cd-choice" disabled={disabled} onClick={onChooseCalendarEntry}><span className="cd-chip">Kalender</span><strong>Termin oder Ereignis</strong><span className="cd-muted">Teamgespräch, Besprechung oder ein anderer Kalendereintrag.</span><small>Termin planen →</small></button>
    <button type="button" className="cd-choice" disabled={disabled} onClick={onAssistEinsatzLink}><span className="cd-chip">Einsatzplanung</span><strong>Assist-Einsatz</strong><span className="cd-muted">Klient:in, Mitarbeitende, Leistungen und Aufgaben gemeinsam planen.</span><small>Einsatzplanung öffnen →</small></button>
  </div></>;
  if (step === 'template') return <><Heading title="Mit einer Vorlage starten">Art und Dauer werden übernommen. Alle Angaben lassen sich danach anpassen.</Heading><CalendarEventTemplatePicker moduleKey={moduleKey} selectedId={template?.id} onSelect={onSelectTemplate} onContinueWithoutTemplate={onContinueWithoutTemplate} disabled={disabled} /></>;
  if (step === 'basics') return <><Heading title="Anlass und Beteiligte">Ein eindeutiger Titel macht den Termin im Kalender leichter auffindbar.</Heading><div className="cd-grid">
    <Field label="Titel *" value={form.title} onChange={title => onChange({ title })} placeholder="z. B. Teamgespräch" full disabled={disabled} />
    <Field label="Beschreibung" value={form.description} onChange={description => onChange({ description })} placeholder="Was ist geplant?" multiline full disabled={disabled} />
    <PersonSelect label="Klient:in / Bewohner:in" value={form.relatedClientId} options={clients} onChange={relatedClientId => onChange({ relatedClientId, ...(!relatedClientId ? { isClientPortalVisible: false } : {}) })} disabled={disabled || form.sourceType === 'intake_appointment'} loading={peopleLoading} />
    <EmployeeMultiSelect values={calendarEmployeeIds(form)} options={employees} onChange={participantEmployeeIds => onChange({ participantEmployeeIds, relatedEmployeeId: participantEmployeeIds[0] ?? '', ...(!participantEmployeeIds.length ? { isEmployeePortalVisible: false } : {}) })} disabled={disabled} loading={peopleLoading} />
  </div></>;
  if (step === 'datetime') return <><Heading title="Zeitraum und Treffpunkt">Uhrzeiten gelten für Deutschland. Bei ganztägigen Terminen zählt das Enddatum mit.</Heading><div className="cd-stack">
    <Toggle title="Ganztägiger Termin" description="Ein oder mehrere vollständige Kalendertage." value={form.allDay} disabled={disabled} onChange={allDay => {
      const start = partsFor(form.startAt, form.allDay).date, end = partsFor(form.endAt, form.allDay).date;
      if (!start || !end) { onChange({ allDay }); return; }
      onChange({ allDay, startAt: allDay ? `${start}T00:00:00.000Z` : berlinTimestamp(start, '08:00'), endAt: allDay ? `${end}T23:59:59.999Z` : berlinTimestamp(end, '09:00') });
    }} />
    <div className="cd-grid"><DateTimeField label="Beginn" value={form.startAt} allDay={form.allDay} disabled={disabled} onChange={startAt => onChange({ startAt })} /><DateTimeField label="Ende" value={form.endAt} allDay={form.allDay} end disabled={disabled} onChange={endAt => onChange({ endAt })} />
      <Field label="Ort" value={form.locationName} onChange={locationName => onChange({ locationName })} placeholder="Einrichtung oder Treffpunkt" disabled={disabled} />
      <Field label="Raum" value={form.room} onChange={room => onChange({ room })} placeholder="Raum oder Etage" disabled={disabled} />
      <Field label="Adresse" value={form.address} onChange={address => onChange({ address })} placeholder="Straße, PLZ und Ort" full disabled={disabled} />
    </div></div></>;
  if (step === 'visibility') return <><Heading title="Sichtbarkeit und Hinweise">Lege fest, wo der Termin angezeigt wird. Interne Notizen bleiben in der Verwaltung.</Heading><div className="cd-stack"><div className="cd-grid">
    <Toggle title="Zentraler Kalender" description="In der Übersicht aller Bereiche anzeigen." value={form.isOfficeVisible} onChange={isOfficeVisible => onChange({ isOfficeVisible })} disabled={disabled} />
    <Toggle title="Kalender des Bereichs" description="Im zugehörigen Bereich anzeigen." value={form.isModuleVisible} onChange={isModuleVisible => onChange({ isModuleVisible })} disabled={disabled} />
    <Toggle title="Klientenportal" description={form.relatedClientId ? 'Für die zugeordnete Person freigeben.' : 'Zuerst eine Klientin oder einen Klienten zuordnen.'} value={form.isClientPortalVisible} onChange={isClientPortalVisible => onChange({ isClientPortalVisible })} disabled={disabled || !form.relatedClientId || form.sourceType === 'intake_appointment'} />
    <Toggle title="Mitarbeiterportal" description={calendarEmployeeIds(form).length ? 'Im Portal anzeigen und allen ausgewählten Mitarbeitenden zuordnen.' : 'Zuerst Mitarbeitende auswählen.'} value={form.isEmployeePortalVisible} onChange={isEmployeePortalVisible => onChange({ isEmployeePortalVisible })} disabled={disabled || !calendarEmployeeIds(form).length || form.sourceType === 'intake_appointment'} />
    <Field label="Interne Notiz" value={form.internalNote} onChange={internalNote => onChange({ internalNote })} placeholder="Nur für die Verwaltung" multiline disabled={disabled} />
    <Field label="Hinweis für die Portale" value={form.publicNote} onChange={publicNote => onChange({ publicNote })} placeholder="Für Personen mit freigegebenem Portal" multiline disabled={disabled} />
  </div></div></>;
  if (step === 'preview') return <><Heading title="Prüfen und speichern">Kontrolliere Zeitraum, Zuordnung und Freigaben.</Heading><CalendarEventPreviewStep form={form} template={template} moduleKey={moduleKey} clientLabel={clients.find(person => person.value === form.relatedClientId)?.label} employeeLabel={calendarEmployeeIds(form).map(id => employees.find(person => person.value === id)?.label ?? 'Nicht mehr verfügbare Person').join('\n')} /></>;
  return null;
}
