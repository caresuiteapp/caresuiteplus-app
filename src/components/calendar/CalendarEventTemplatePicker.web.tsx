import { useEffect, useMemo, useState } from 'react';
import type { CalendarEventTemplate, CalendarModuleKey } from '@/types/calendar';
import { listCalendarPlanningTemplates, getDefaultCalendarPlanningTemplates } from '@/lib/calendar/calendarPlanningTemplates.web';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

export function CalendarEventTemplatePicker({ moduleKey, selectedId, onSelect, onContinueWithoutTemplate, disabled = false }: {
  moduleKey: CalendarModuleKey; selectedId?: string | null; onSelect: (template: CalendarEventTemplate) => void;
  onContinueWithoutTemplate?: () => void; accentColor?: string; disabled?: boolean;
}) {
  const { profile } = useAuth(); const tenantId = useServiceTenantId();
  const scope = JSON.stringify([moduleKey, tenantId, profile?.id, profile?.roleKey]);
  const [loadedScope, setLoadedScope] = useState(scope);
  const [templates, setTemplates] = useState<CalendarEventTemplate[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [search, setSearch] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoadedScope(scope); setTemplates([]); setLoading(true); setError(''); setSearch('');
    void listCalendarPlanningTemplates(moduleKey, tenantId, profile?.roleKey).then(result => {
      if (!active) return;
      if (result.ok) setTemplates(result.data);
      else setError(result.error);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Vorlagen konnten nicht geladen werden.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope, moduleKey, tenantId, profile?.roleKey, retry]);
  const filtered = useMemo(() => templates.filter(template => `${template.label} ${template.description ?? ''} ${template.templateKey}`.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'))), [templates, search]);
  const pending = loading || loadedScope !== scope;
  return <div className="cd-stack" data-cs-calendar-templates="planning-catalog-v1">
    {onContinueWithoutTemplate ? <button type="button" className="cd-choice" disabled={disabled} onClick={onContinueWithoutTemplate}><span className="cd-chip">Eigener Termin</span><strong>Ohne Vorlage fortfahren</strong><small>Titel, Zeitraum und Beteiligte selbst festlegen.</small></button> : null}
    <input className="cd-search" type="search" value={loadedScope === scope ? search : ''} onChange={e => setSearch(e.target.value)} aria-label="Kalendervorlage suchen" placeholder="Vorlage suchen…" disabled={disabled || pending} />
    {pending ? <p role="status" className="cd-muted">Vorlagen werden geladen…</p> : error ? <div role="alert" className="cd-alert">{error} <button type="button" className="cd-link" onClick={() => setRetry(value => value + 1)}>Erneut laden</button></div> : <>
      <p className="cd-muted">{filtered.length} {filtered.length === 1 ? 'Vorlage' : 'Vorlagen'}</p>
      {filtered.length ? <div className="cd-grid">{filtered.map(template => <button type="button" className="cd-choice" key={template.id} aria-pressed={selectedId === template.id} disabled={disabled} onClick={() => onSelect(template)}>
        <strong>{template.label}</strong>{template.description ? <span className="cd-muted">{template.description}</span> : null}
        <small>{template.allDay ? 'Ganztägig' : `${template.defaultDurationMinutes} Minuten`}{!template.isSystem ? ' · Eigene Vorlage' : ''}</small>
      </button>)}</div> : <div className="cd-info" role="status">{search.trim() ? <>
        <p>Keine Vorlage passt zu deiner Suche.</p><button type="button" className="cd-link" disabled={disabled} onClick={() => setSearch('')}>Suche zurücksetzen</button>
      </> : <p>Für diesen Bereich sind derzeit keine Kalendervorlagen verfügbar. Du kannst einen eigenen Termin anlegen.</p>}</div>}
    </>}
  </div>;
}
export function getDefaultTemplateCount() { return getDefaultCalendarPlanningTemplates().length; }
