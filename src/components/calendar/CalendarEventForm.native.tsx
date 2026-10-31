// Generated native presentation from src/components/calendar/CalendarEventForm.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeHeader,NativeH2,NativeP,NativeLabel,NativeSpan,NativeTextarea,NativeInput,NativeStrong,NativeSmall,NativeDiv,NativeSelect,NativeOption,NativeFieldset,NativeLegend,NativeButton,NativeUl,NativeLi,NativeH3} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { CalendarEventTemplate, CalendarModuleKey } from '@/types/calendar';
import type { CalendarEventFormState, CalendarFormStep } from '@/types/calendar/calendarEventForm';
import type { CareEntityOption } from '@/components/inputs/CareEntitySelect';
import { berlinTimestamp } from '@/lib/calendar/employeeMonthPlanning';
import { calendarEmployeeIds } from '@/lib/calendar/calendarParticipants';
import { CalendarEventTemplatePicker } from "./CalendarEventTemplatePicker.native.tsx";
import { CalendarEventPreviewStep } from "./CalendarEventPreviewStep.native.tsx";
type Props = {
    step: CalendarFormStep;
    moduleKey: CalendarModuleKey;
    form: CalendarEventFormState;
    template: CalendarEventTemplate | null;
    accentColor?: string;
    onChange: (patch: Partial<CalendarEventFormState>) => void;
    onSelectTemplate: (template: CalendarEventTemplate) => void;
    onContinueWithoutTemplate: () => void;
    onChooseCalendarEntry?: () => void;
    onAssistEinsatzLink?: () => void;
    clients?: CareEntityOption[];
    employees?: CareEntityOption[];
    peopleLoading?: boolean;
    disabled?: boolean;
};
function Heading({ title, children }: {
    title: string;
    children: ReactNode;
}) {
    return <NativeHeader className="cd-step-header"><NativeH2>{title}</NativeH2><NativeP className="cd-muted">{children}</NativeP></NativeHeader>;
}
function Field({ label, value, onChange, placeholder, multiline, full, disabled }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    multiline?: boolean;
    full?: boolean;
    disabled?: boolean;
}) {
    return <NativeLabel className={`cd-field${full ? ' cd-full' : ''}`}><NativeSpan>{label}</NativeSpan>{multiline
            ? <NativeTextarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} maxLength={5000}/>
            : <NativeInput value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} maxLength={250}/>}</NativeLabel>;
}
function Toggle({ title, description, value, onChange, disabled }: {
    title: string;
    description: string;
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
}) {
    return <NativeLabel className="cd-toggle"><NativeInput type="checkbox" checked={value} disabled={disabled} onChange={e => onChange(e.target.checked)}/><NativeSpan><NativeStrong>{title}</NativeStrong><NativeSmall>{description}</NativeSmall></NativeSpan></NativeLabel>;
}
function PersonSelect({ label, value, options, onChange, disabled, loading }: {
    label: string;
    value: string;
    options: CareEntityOption[];
    onChange: (value: string) => void;
    disabled: boolean;
    loading: boolean;
}) {
    const [search, setSearch] = useState('');
    const inputId = useId();
    const filtered = options.filter(person => person.value === value || person.label.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE')));
    return <NativeDiv className="cd-field cd-full"><NativeLabel htmlFor={inputId}>{label}</NativeLabel>
    {options.length > 8 ? <NativeInput type="search" aria-label={`${label} suchen`} placeholder="Name suchen…" value={search} onChange={e => setSearch(e.target.value)} disabled={disabled || loading}/> : null}
    <NativeSelect id={inputId} value={value} onChange={e => onChange(e.target.value)} disabled={disabled || loading}>
      <NativeOption value="">{loading ? 'Wird geladen…' : 'Keine Zuordnung'}</NativeOption>{filtered.map(person => <NativeOption key={person.value} value={person.value}>{person.label}</NativeOption>)}
    </NativeSelect>{search && !filtered.length ? <NativeSmall>Keine passende Person gefunden.</NativeSmall> : null}
  </NativeDiv>;
}
function EmployeeMultiSelect({ values, options, onChange, disabled, loading }: {
    values: string[];
    options: CareEntityOption[];
    onChange: (values: string[]) => void;
    disabled: boolean;
    loading: boolean;
}) {
    const [search, setSearch] = useState('');
    const hintId = useId();
    const query = search.trim().toLocaleLowerCase('de-DE');
    const filtered = options.filter(person => person.label.toLocaleLowerCase('de-DE').includes(query));
    const peopleById = new Map(options.map(person => [person.value, person]));
    const selected = new Set(values);
    const locked = disabled || loading;
    return <NativeFieldset className="cd-field cd-people cd-full" disabled={locked} aria-describedby={hintId}>
    <NativeLegend>Mitarbeitende</NativeLegend>
    <NativeP id={hintId} className="cd-muted">Mehrere Personen auswählen oder das gesamte Team hinzufügen.</NativeP>
    <NativeDiv className="cd-people-toolbar">
      <NativeLabel className="cd-field cd-people-search"><NativeSpan className="cd-sr-only">Mitarbeitende suchen</NativeSpan><NativeInput type="search" placeholder="Mitarbeitende suchen…" value={search} onChange={event => setSearch(event.target.value)}/></NativeLabel>
      <NativeButton type="button" className="cd-link" disabled={locked || !options.some(person => !selected.has(person.value))} onClick={() => onChange([...new Set([...values, ...options.map(person => person.value)])])}>Alle auswählen</NativeButton>
      <NativeButton type="button" className="cd-link" disabled={locked || !values.length} onClick={() => onChange([])}>Auswahl aufheben</NativeButton>
    </NativeDiv>
    <NativeP role="status" className="cd-muted">{loading ? 'Mitarbeitende werden geladen…' : `${values.length} ${values.length === 1 ? 'Person ausgewählt' : 'Personen ausgewählt'}`}</NativeP>
    {values.length ? <NativeUl className="cd-people-selected" aria-label="Ausgewählte Mitarbeitende">{values.map(id => {
                const person = peopleById.get(id);
                const name = person?.label ?? 'Nicht mehr verfügbare Person';
                return <NativeLi key={id}><NativeSpan>{name}</NativeSpan><NativeButton type="button" disabled={locked} aria-label={`${name} aus Auswahl entfernen`} onClick={() => onChange(values.filter(value => value !== id))}>×</NativeButton></NativeLi>;
            })}</NativeUl> : null}
    <NativeDiv className="cd-people-options">{filtered.map(person => <NativeLabel key={person.value} className="cd-person-option">
      <NativeInput type="checkbox" checked={selected.has(person.value)} onChange={event => onChange(event.target.checked ? [...values, person.value] : values.filter(id => id !== person.value))}/>
      <NativeSpan>{person.label}</NativeSpan>
    </NativeLabel>)}{!loading && !filtered.length ? <NativeP className="cd-muted">{query ? 'Keine passenden Mitarbeitenden gefunden.' : 'Keine Mitarbeitenden verfügbar.'}</NativeP> : null}</NativeDiv>
  </NativeFieldset>;
}
function partsFor(value: string, allDay: boolean) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
        return { date: '', time: '' };
    return { date: allDay ? value.slice(0, 10) : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(date),
        time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date) };
}
function DateTimeField({ label, value, allDay, end, disabled, onChange }: {
    label: string;
    value: string;
    allDay: boolean;
    end?: boolean;
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    const [parts, setParts] = useState(() => partsFor(value, allDay));
    const [error, setError] = useState('');
    const emitted = useRef(value);
    const previousAllDay = useRef(allDay);
    useEffect(() => {
        if (value === emitted.current && allDay === previousAllDay.current)
            return;
        emitted.current = value;
        previousAllDay.current = allDay;
        setParts(partsFor(value, allDay));
        setError('');
    }, [allDay, value]);
    const change = (patch: Partial<typeof parts>) => {
        const next = { ...parts, ...patch };
        setParts(next);
        try {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(next.date))
                throw new Error('Bitte ein vollständiges Datum wählen.');
            if (!allDay && !/^([01]\d|2[0-3]):[0-5]\d$/.test(next.time))
                throw new Error('Bitte eine vollständige Uhrzeit wählen.');
            const nextValue = allDay ? `${next.date}T${end ? '23:59:59.999' : '00:00:00.000'}Z` : berlinTimestamp(next.date, next.time);
            if (!Number.isFinite(Date.parse(nextValue)))
                throw new Error('Bitte Datum und Uhrzeit prüfen.');
            emitted.current = nextValue;
            onChange(nextValue);
            setError('');
        }
        catch (cause) {
            emitted.current = '';
            onChange('');
            setError(cause instanceof Error ? cause.message : 'Datum und Uhrzeit prüfen.');
        }
    };
    return <NativeDiv className="cd-panel cd-stack"><NativeH3>{label}</NativeH3><NativeLabel className="cd-field"><NativeSpan>Datum</NativeSpan><NativeInput type="date" aria-label={`${label}: Datum`} value={parts.date} disabled={disabled} onChange={e => change({ date: e.target.value })}/></NativeLabel>
    {!allDay ? <NativeLabel className="cd-field"><NativeSpan>Uhrzeit</NativeSpan><NativeInput type="time" aria-label={`${label}: Uhrzeit`} value={parts.time} disabled={disabled} onChange={e => change({ time: e.target.value })}/></NativeLabel> : null}
    {error ? <NativeP role="alert" className="cd-alert">{error}</NativeP> : null}
  </NativeDiv>;
}
export function CalendarEventForm({ step, moduleKey, form, template, onChange, onSelectTemplate, onContinueWithoutTemplate, onChooseCalendarEntry, onAssistEinsatzLink, clients = [], employees = [], peopleLoading = false, disabled = false }: Props) {
    if (step === 'type')
        return <><Heading title="Was möchtest du planen?">Termine und Einsätze bleiben mit den passenden Daten verknüpft.</Heading><NativeDiv className="cd-grid">
    <NativeButton type="button" className="cd-choice" disabled={disabled} onClick={onChooseCalendarEntry}><NativeSpan className="cd-chip">Kalender</NativeSpan><NativeStrong>Termin oder Ereignis</NativeStrong><NativeSpan className="cd-muted">Teamgespräch, Besprechung oder ein anderer Kalendereintrag.</NativeSpan><NativeSmall>Termin planen →</NativeSmall></NativeButton>
    <NativeButton type="button" className="cd-choice" disabled={disabled} onClick={onAssistEinsatzLink}><NativeSpan className="cd-chip">Einsatzplanung</NativeSpan><NativeStrong>Assist-Einsatz</NativeStrong><NativeSpan className="cd-muted">Klient:in, Mitarbeitende, Leistungen und Aufgaben gemeinsam planen.</NativeSpan><NativeSmall>Einsatzplanung öffnen →</NativeSmall></NativeButton>
  </NativeDiv></>;
    if (step === 'template')
        return <><Heading title="Mit einer Vorlage starten">Art und Dauer werden übernommen. Alle Angaben lassen sich danach anpassen.</Heading><CalendarEventTemplatePicker moduleKey={moduleKey} selectedId={template?.id} onSelect={onSelectTemplate} onContinueWithoutTemplate={onContinueWithoutTemplate} disabled={disabled}/></>;
    if (step === 'basics')
        return <><Heading title="Anlass und Beteiligte">Ein eindeutiger Titel macht den Termin im Kalender leichter auffindbar.</Heading><NativeDiv className="cd-grid">
    <Field label="Titel *" value={form.title} onChange={title => onChange({ title })} placeholder="z. B. Teamgespräch" full disabled={disabled}/>
    <Field label="Beschreibung" value={form.description} onChange={description => onChange({ description })} placeholder="Was ist geplant?" multiline full disabled={disabled}/>
    <PersonSelect label="Klient:in / Bewohner:in" value={form.relatedClientId} options={clients} onChange={relatedClientId => onChange({ relatedClientId, ...(!relatedClientId ? { isClientPortalVisible: false } : {}) })} disabled={disabled || form.sourceType === 'intake_appointment'} loading={peopleLoading}/>
    <EmployeeMultiSelect values={calendarEmployeeIds(form)} options={employees} onChange={participantEmployeeIds => onChange({ participantEmployeeIds, relatedEmployeeId: participantEmployeeIds[0] ?? '', ...(!participantEmployeeIds.length ? { isEmployeePortalVisible: false } : {}) })} disabled={disabled} loading={peopleLoading}/>
  </NativeDiv></>;
    if (step === 'datetime')
        return <><Heading title="Zeitraum und Treffpunkt">Uhrzeiten gelten für Deutschland. Bei ganztägigen Terminen zählt das Enddatum mit.</Heading><NativeDiv className="cd-stack">
    <Toggle title="Ganztägiger Termin" description="Ein oder mehrere vollständige Kalendertage." value={form.allDay} disabled={disabled} onChange={allDay => {
                const start = partsFor(form.startAt, form.allDay).date, end = partsFor(form.endAt, form.allDay).date;
                if (!start || !end) {
                    onChange({ allDay });
                    return;
                }
                onChange({ allDay, startAt: allDay ? `${start}T00:00:00.000Z` : berlinTimestamp(start, '08:00'), endAt: allDay ? `${end}T23:59:59.999Z` : berlinTimestamp(end, '09:00') });
            }}/>
    <NativeDiv className="cd-grid"><DateTimeField label="Beginn" value={form.startAt} allDay={form.allDay} disabled={disabled} onChange={startAt => onChange({ startAt })}/><DateTimeField label="Ende" value={form.endAt} allDay={form.allDay} end disabled={disabled} onChange={endAt => onChange({ endAt })}/>
      <Field label="Ort" value={form.locationName} onChange={locationName => onChange({ locationName })} placeholder="Einrichtung oder Treffpunkt" disabled={disabled}/>
      <Field label="Raum" value={form.room} onChange={room => onChange({ room })} placeholder="Raum oder Etage" disabled={disabled}/>
      <Field label="Adresse" value={form.address} onChange={address => onChange({ address })} placeholder="Straße, PLZ und Ort" full disabled={disabled}/>
    </NativeDiv></NativeDiv></>;
    if (step === 'visibility')
        return <><Heading title="Sichtbarkeit und Hinweise">Lege fest, wo der Termin angezeigt wird. Interne Notizen bleiben in der Verwaltung.</Heading><NativeDiv className="cd-stack"><NativeDiv className="cd-grid">
    <Toggle title="Zentraler Kalender" description="In der Übersicht aller Bereiche anzeigen." value={form.isOfficeVisible} onChange={isOfficeVisible => onChange({ isOfficeVisible })} disabled={disabled}/>
    <Toggle title="Kalender des Bereichs" description="Im zugehörigen Bereich anzeigen." value={form.isModuleVisible} onChange={isModuleVisible => onChange({ isModuleVisible })} disabled={disabled}/>
    <Toggle title="Klientenportal" description={form.relatedClientId ? 'Für die zugeordnete Person freigeben.' : 'Zuerst eine Klientin oder einen Klienten zuordnen.'} value={form.isClientPortalVisible} onChange={isClientPortalVisible => onChange({ isClientPortalVisible })} disabled={disabled || !form.relatedClientId || form.sourceType === 'intake_appointment'}/>
    <Toggle title="Mitarbeiterportal" description={calendarEmployeeIds(form).length ? 'Im Portal anzeigen und allen ausgewählten Mitarbeitenden zuordnen.' : 'Zuerst Mitarbeitende auswählen.'} value={form.isEmployeePortalVisible} onChange={isEmployeePortalVisible => onChange({ isEmployeePortalVisible })} disabled={disabled || !calendarEmployeeIds(form).length || form.sourceType === 'intake_appointment'}/>
    <Field label="Interne Notiz" value={form.internalNote} onChange={internalNote => onChange({ internalNote })} placeholder="Nur für die Verwaltung" multiline disabled={disabled}/>
    <Field label="Hinweis für die Portale" value={form.publicNote} onChange={publicNote => onChange({ publicNote })} placeholder="Für Personen mit freigegebenem Portal" multiline disabled={disabled}/>
  </NativeDiv></NativeDiv></>;
    if (step === 'preview')
        return <><Heading title="Prüfen und speichern">Kontrolliere Zeitraum, Zuordnung und Freigaben.</Heading><CalendarEventPreviewStep form={form} template={template} moduleKey={moduleKey} clientLabel={clients.find(person => person.value === form.relatedClientId)?.label} employeeLabel={calendarEmployeeIds(form).map(id => employees.find(person => person.value === id)?.label ?? 'Nicht mehr verfügbare Person').join('\n')}/></>;
    return null;
}
