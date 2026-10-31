// Generated native presentation from src/components/office/calendar/OfficeCalendarSettingsModal.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeP,NativeDiv,NativeSection,NativeH2,NativeButton,NativeStrong,NativeSmall,NativeLabel,NativeSpan,NativeSelect,NativeOption,NativeInput} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PlatformModal } from '@/components/layout/platform';
import { CalendarDialogContent } from "../../calendar/CalendarDialogContent.native.tsx";
import { usePermissions } from '@/hooks/usePermissions';
import { confirmAction } from '@/lib/platform/confirmAction';
import { buildDefaultTenantCalendarSettings, CALENDAR_EVENT_TYPE_LABELS, type CalendarEventType, type CalendarViewMode, type TenantCalendarSettingsForm } from '@/types/modules/calendarEvent';
type Props = {
    visible: boolean;
    initial: TenantCalendarSettingsForm | null;
    saving: boolean;
    error?: string | null;
    disabled?: boolean;
    onClose: () => void;
    onSave: (form: TenantCalendarSettingsForm) => void | Promise<unknown>;
};
const VIEWS: [
    CalendarViewMode,
    string,
    string
][] = [['day', 'Tag', 'Ein Tag mit Stundenraster'], ['week', 'Woche', 'Sieben Tage nebeneinander'], ['month', 'Monat', 'Termine im Monatsraster'], ['year', 'Jahr', 'Alle Monate im Überblick'], ['agenda', 'Agenda', 'Termine nach Tagen geordnet'], ['list', 'Liste', 'Termine tabellarisch vergleichen']];
export function OfficeCalendarSettingsModal({ visible, initial, saving, error, disabled = false, onClose, onSave }: Props) {
    const { can } = usePermissions();
    const allowed = !disabled && can('business.tenant.manage');
    const defaults = useMemo(() => { const { tenantId: _, updatedAt: __, ...form } = buildDefaultTenantCalendarSettings('local'); return form; }, []);
    const [form, setForm] = useState(initial ?? defaults), [localError, setLocalError] = useState(''), [pending, setPending] = useState(false);
    const busy = useRef(false);
    const scope = useRef(0);
    const initialKey = JSON.stringify(initial ?? defaults);
    const initialRef = useRef(initial ?? defaults);
    initialRef.current = initial ?? defaults;
    useEffect(() => { scope.current += 1; busy.current = false; setPending(false); if (visible) {
        setForm(initialRef.current);
        setLocalError('');
    } }, [visible, initialKey]);
    useEffect(() => () => { scope.current += 1; }, []);
    const locked = saving || pending || !allowed;
    const close = async () => {
        if (saving || busy.current)
            return;
        if (JSON.stringify(form) !== JSON.stringify(initial ?? defaults) && !await confirmAction({ title: 'Einstellungen schließen', message: 'Ungespeicherte Änderungen verwerfen?', confirmLabel: 'Verwerfen', cancelLabel: 'Weiter bearbeiten' }))
            return;
        onClose();
    };
    const save = async () => {
        if (locked || busy.current)
            return;
        const submitted = scope.current;
        busy.current = true;
        setPending(true);
        setLocalError('');
        try {
            const result = await onSave(form);
            if (scope.current === submitted && result && typeof result === 'object' && 'ok' in result && !result.ok)
                setLocalError('error' in result ? String(result.error) : 'Die Einstellungen konnten nicht gespeichert werden.');
        }
        catch (cause) {
            if (scope.current === submitted)
                setLocalError(cause instanceof Error ? cause.message : 'Die Einstellungen konnten nicht gespeichert werden.');
        }
        finally {
            if (scope.current === submitted) {
                busy.current = false;
                setPending(false);
            }
        }
    };
    const toggleType = (type: CalendarEventType) => setForm(previous => ({ ...previous, visibleTypes: { ...previous.visibleTypes, [type]: !previous.visibleTypes[type] } }));
    return <PlatformModal visible={visible} title="Kalender-Einstellungen" subtitle="Voreinstellungen für das Unternehmen" onClose={() => void close()} dismissOnBackdrop={!saving && !pending} surfaceScope="company" maxWidth={980} glowColor="#2786E7" footerContent={error || localError || !allowed ? <CalendarDialogContent><NativeP role="alert" className="cd-alert">{error || localError || 'Zum Ändern dieser Einstellungen fehlt die Berechtigung zur Unternehmensverwaltung.'}</NativeP></CalendarDialogContent> : undefined} footerActions={[{ title: 'Abbrechen', variant: 'secondary', disabled: saving || pending, onPress: () => void close() }, { title: saving || pending ? 'Wird gespeichert…' : 'Einstellungen speichern', loading: saving || pending, disabled: locked, onPress: save }]}>
    <CalendarDialogContent><NativeDiv className="cd-stack">
      <NativeP className="cd-info">Diese Voreinstellungen gelten für das Unternehmen. Termine und Einsätze bleiben erhalten, auch wenn ein Ereignistyp ausgeblendet wird.</NativeP>
      <NativeSection className="cd-panel cd-stack"><NativeH2>Startansicht</NativeH2><NativeDiv className="cd-grid">{VIEWS.map(([view, label, description]) => <NativeButton type="button" key={view} className="cd-choice" aria-pressed={form.defaultView === view} disabled={locked} onClick={() => setForm(previous => ({ ...previous, defaultView: view }))}><NativeStrong>{label}</NativeStrong><NativeSmall>{description}</NativeSmall></NativeButton>)}</NativeDiv></NativeSection>
      <NativeSection className="cd-panel cd-stack"><NativeH2>Woche und Tageszeiten</NativeH2><NativeDiv className="cd-grid">
        <NativeLabel className="cd-field"><NativeSpan>Wochenbeginn</NativeSpan><NativeSelect value={form.weekStartDay} disabled={locked} onChange={e => setForm(previous => ({ ...previous, weekStartDay: Number(e.target.value) as 0 | 1 }))}><NativeOption value={1}>Montag</NativeOption><NativeOption value={0}>Sonntag</NativeOption></NativeSelect></NativeLabel>
        <NativeLabel className="cd-field"><NativeSpan>Erste sichtbare Stunde im Tageskalender</NativeSpan><NativeSelect value={form.dayViewStartHour} disabled={locked} onChange={e => setForm(previous => ({ ...previous, dayViewStartHour: Number(e.target.value) }))}>{Array.from({ length: 24 }, (_, hour) => <NativeOption key={hour} value={hour}>{String(hour).padStart(2, '0')}:00 Uhr</NativeOption>)}</NativeSelect></NativeLabel>
        <NativeLabel className="cd-toggle cd-full"><NativeInput type="checkbox" checked={form.weekFullDay} disabled={locked} onChange={e => setForm(previous => ({ ...previous, weekFullDay: e.target.checked }))}/><NativeSpan><NativeStrong>Nachtstunden in der Wochenansicht</NativeStrong><NativeSmall>Den vollständigen Tag von 0 bis 24 Uhr anzeigen.</NativeSmall></NativeSpan></NativeLabel>
        <NativeLabel className="cd-field"><NativeSpan>Sichtbare Termine je Tag im Monatskalender</NativeSpan><NativeSelect value={form.maxCollapsedEvents} disabled={locked} onChange={e => setForm(previous => ({ ...previous, maxCollapsedEvents: Number(e.target.value) }))}>{Array.from({ length: 20 }, (_, index) => <NativeOption key={index} value={index + 1}>{index + 1}</NativeOption>)}</NativeSelect><NativeSmall>Weitere Termine bleiben über „mehr“ erreichbar.</NativeSmall></NativeLabel>
      </NativeDiv></NativeSection>
      <NativeSection className="cd-panel cd-stack"><NativeH2>Ereignistypen</NativeH2><NativeDiv className="cd-grid">{(Object.keys(CALENDAR_EVENT_TYPE_LABELS) as CalendarEventType[]).map(type => <NativeLabel className="cd-toggle" key={type}><NativeInput type="checkbox" checked={form.visibleTypes[type]} disabled={locked} onChange={() => toggleType(type)}/><NativeSpan>{CALENDAR_EVENT_TYPE_LABELS[type]}</NativeSpan></NativeLabel>)}</NativeDiv>
        {!Object.values(form.visibleTypes).some(Boolean) ? <NativeP className="cd-info">Alle Ereignistypen sind ausgeblendet. Der Kalender erscheint dadurch leer.</NativeP> : null}
      </NativeSection>
      <NativeDiv><NativeButton type="button" className="cd-link" disabled={locked} onClick={() => setForm({ ...defaults, visibleTypes: { ...defaults.visibleTypes } })}>Standards wiederherstellen</NativeButton></NativeDiv>
    </NativeDiv></CalendarDialogContent>
  </PlatformModal>;
}
