// Generated native presentation from src/components/calendar/CalendarEventPreviewStep.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeDiv,NativeH2,NativeP,NativeDl,NativeDt,NativeDd,NativeH3} from '@/components/layout/NativeWorkspaceElements.native';
import type { CalendarEventTemplate } from '@/types/calendar';
import type { CalendarEventFormState } from '@/types/calendar/calendarEventForm';
import { CALENDAR_EVENT_TYPE_LABELS } from '@/types/modules/calendarEvent';
export function CalendarEventPreviewStep({ form, template, clientLabel, employeeLabel }: {
    form: CalendarEventFormState;
    template: CalendarEventTemplate | null;
    moduleKey: string;
    clientLabel?: string;
    employeeLabel?: string;
}) {
    const date = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('de-DE', form.allDay ? { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' } : { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Bitte Zeitraum prüfen';
    const rows = [
        ['Zeitraum', `${date(form.startAt)} – ${date(form.endAt)}${form.allDay ? ' · ganztägig' : ' Uhr'}`],
        ['Klient:in', clientLabel], ['Mitarbeitende', employeeLabel], ['Ort', form.locationName], ['Raum', form.room], ['Adresse', form.address],
        ['Beschreibung', form.description], ['Interne Notiz', form.internalNote], ['Hinweis für die Portale', form.publicNote],
    ];
    const places = [form.isOfficeVisible && 'Zentraler Kalender', form.isModuleVisible && 'Kalender des Bereichs', form.isClientPortalVisible && 'Klientenportal', form.isEmployeePortalVisible && 'Mitarbeiterportal'].filter(Boolean);
    return <NativeSection className="cd-panel cd-stack"><NativeDiv><NativeH2>{form.title || 'Ohne Titel'}</NativeH2><NativeP className="cd-muted">{template?.label ?? CALENDAR_EVENT_TYPE_LABELS[form.eventType as keyof typeof CALENDAR_EVENT_TYPE_LABELS] ?? 'Termin'}</NativeP></NativeDiv>
    <NativeDl className="cd-details">{rows.filter(([, value]) => !!value).map(([label, value]) => <NativeDiv key={label} style={{ display: 'contents' }}><NativeDt>{label}</NativeDt><NativeDd>{value}</NativeDd></NativeDiv>)}</NativeDl>
    <NativeDiv><NativeH3>Sichtbar in</NativeH3><NativeP className="cd-muted">{places.join(' · ') || 'Keinem Kalender oder Portal. Der Eintrag bleibt gespeichert.'}</NativeP></NativeDiv>
  </NativeSection>;
}
