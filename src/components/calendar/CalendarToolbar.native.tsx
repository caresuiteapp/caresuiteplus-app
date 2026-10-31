// Generated native presentation from src/components/calendar/CalendarToolbar.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {__nativeWorkspaceStyleSheets as __nativeWorkspaceImportedStyles0} from "./CalendarWorkspaceStyles.native.tsx";
import {NativeDiv,NativeButton,NativeH2,NativeLabel,NativeSpan,NativeInput,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import type { CalendarViewMode } from '@/types/modules/calendarEvent';
import { CalendarWorkspaceIcon, CalendarWorkspaceStyles } from "./CalendarWorkspaceStyles.native.tsx";
type CalendarToolbarProps = {
    viewMode: CalendarViewMode;
    onViewModeChange: (mode: CalendarViewMode) => void;
    title: string;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    onOpenSettings?: () => void;
    onCreate?: () => void;
    anchor?: string;
    onAnchorChange?: (date: string) => void;
    accentColor?: string;
    includeYear?: boolean;
    compact?: boolean;
};
const VIEWS: {
    value: CalendarViewMode;
    label: string;
}[] = [
    { value: 'day', label: 'Tag' }, { value: 'week', label: 'Woche' },
    { value: 'month', label: 'Monat' }, { value: 'year', label: 'Jahr' },
    { value: 'agenda', label: 'Agenda' }, { value: 'list', label: 'Liste' },
];
export function CalendarToolbar({ viewMode, onViewModeChange, title, onPrev, onNext, onToday, onOpenSettings, onCreate, anchor, onAnchorChange, includeYear = true }: CalendarToolbarProps) {
    return <NativeWorkspaceStyleScope css={[...__nativeWorkspaceImportedStyles0["CalendarWorkspaceStyles"]]}>{<NativeDiv className="cw-toolbar cw-workspace">
    <CalendarWorkspaceStyles />
    <NativeDiv className="cw-toolbar-top">
      <NativeDiv className="cw-nav" aria-label="Zeitraum wechseln">
        <NativeButton type="button" className="cw-button cw-button--icon" aria-label="Vorheriger Zeitraum" onClick={onPrev}><CalendarWorkspaceIcon name="previous"/></NativeButton>
        <NativeButton type="button" className="cw-button cw-button--icon" aria-label="Nächster Zeitraum" onClick={onNext}><CalendarWorkspaceIcon name="next"/></NativeButton>
        <NativeButton type="button" className="cw-button" onClick={onToday}>Heute</NativeButton>
      </NativeDiv>
      <NativeDiv className="cw-period"><NativeH2 aria-live="polite">{title}</NativeH2></NativeDiv>
      <NativeDiv className="cw-actions">
        {onOpenSettings ? <NativeButton type="button" className="cw-button" aria-label="Kalendereinstellungen öffnen" onClick={onOpenSettings}><CalendarWorkspaceIcon name="settings"/>Einstellungen</NativeButton> : null}
        {onCreate ? <NativeButton type="button" className="cw-button cw-button--primary" onClick={onCreate}><CalendarWorkspaceIcon name="plus"/>Neuer Eintrag</NativeButton> : null}
      </NativeDiv>
    </NativeDiv>
    <NativeDiv className="cw-view-row">
      <NativeDiv className="cw-views" role="group" aria-label="Kalenderansicht">
        {VIEWS.filter((view) => includeYear || view.value !== 'year').map((view) => <NativeButton type="button" key={view.value} aria-pressed={viewMode === view.value} onClick={() => onViewModeChange(view.value)}>{view.label}</NativeButton>)}
      </NativeDiv>
      {onAnchorChange ? <NativeLabel className="cw-date"><NativeSpan>Gehe zu</NativeSpan><NativeInput type="date" aria-label="Datum auswählen" min="1900-01-01" max="2200-12-31" value={anchor} onChange={(event) => onAnchorChange(event.target.value)}/></NativeLabel> : null}
    </NativeDiv>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
