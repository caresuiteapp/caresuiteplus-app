import type { CalendarViewMode } from '@/types/modules/calendarEvent';
import { CalendarWorkspaceIcon, CalendarWorkspaceStyles } from './CalendarWorkspaceStyles.web';

type CalendarToolbarProps = {
  viewMode: CalendarViewMode; onViewModeChange: (mode: CalendarViewMode) => void;
  title: string; onPrev: () => void; onNext: () => void; onToday: () => void;
  onOpenSettings?: () => void; onCreate?: () => void;
  anchor?: string; onAnchorChange?: (date: string) => void;
  accentColor?: string; includeYear?: boolean; compact?: boolean;
};
const VIEWS: { value: CalendarViewMode; label: string }[] = [
  { value: 'day', label: 'Tag' }, { value: 'week', label: 'Woche' },
  { value: 'month', label: 'Monat' }, { value: 'year', label: 'Jahr' },
  { value: 'agenda', label: 'Agenda' }, { value: 'list', label: 'Liste' },
];
export function CalendarToolbar({ viewMode, onViewModeChange, title, onPrev, onNext, onToday,
  onOpenSettings, onCreate, anchor, onAnchorChange, includeYear = true }: CalendarToolbarProps) {
  return <div className="cw-toolbar cw-workspace">
    <CalendarWorkspaceStyles />
    <div className="cw-toolbar-top">
      <div className="cw-nav" aria-label="Zeitraum wechseln">
        <button type="button" className="cw-button cw-button--icon" aria-label="Vorheriger Zeitraum" onClick={onPrev}><CalendarWorkspaceIcon name="previous" /></button>
        <button type="button" className="cw-button cw-button--icon" aria-label="Nächster Zeitraum" onClick={onNext}><CalendarWorkspaceIcon name="next" /></button>
        <button type="button" className="cw-button" onClick={onToday}>Heute</button>
      </div>
      <div className="cw-period"><h2 aria-live="polite">{title}</h2></div>
      <div className="cw-actions">
        {onOpenSettings ? <button type="button" className="cw-button" aria-label="Kalendereinstellungen öffnen" onClick={onOpenSettings}><CalendarWorkspaceIcon name="settings" />Einstellungen</button> : null}
        {onCreate ? <button type="button" className="cw-button cw-button--primary" onClick={onCreate}><CalendarWorkspaceIcon name="plus" />Neuer Eintrag</button> : null}
      </div>
    </div>
    <div className="cw-view-row">
      <div className="cw-views" role="group" aria-label="Kalenderansicht">
        {VIEWS.filter((view) => includeYear || view.value !== 'year').map((view) => <button type="button" key={view.value} aria-pressed={viewMode === view.value} onClick={() => onViewModeChange(view.value)}>{view.label}</button>)}
      </div>
      {onAnchorChange ? <label className="cw-date"><span>Gehe zu</span><input type="date" aria-label="Datum auswählen" min="1900-01-01" max="2200-12-31" value={anchor} onChange={(event) => onAnchorChange(event.target.value)} /></label> : null}
    </div>
  </div>;
}
