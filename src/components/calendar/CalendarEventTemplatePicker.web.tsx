import { useEffect, useMemo, useState } from 'react';
import type { CalendarEventTemplate, CalendarModuleKey } from '@/types/calendar';
import { SYSTEM_CALENDAR_TEMPLATES } from '@/data/calendar/defaultTemplates';
import { listTemplates } from '@/lib/calendar/calendarTemplateService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

export function CalendarEventTemplatePicker({ moduleKey, selectedId, onSelect, onContinueWithoutTemplate, disabled = false }: {
  moduleKey: CalendarModuleKey; selectedId?: string | null; onSelect: (template: CalendarEventTemplate) => void;
  onContinueWithoutTemplate?: () => void; accentColor?: string; disabled?: boolean;
}) {
  const { profile } = useAuth(); const tenantId = useServiceTenantId();
  const [templates, setTemplates] = useState<CalendarEventTemplate[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [search, setSearch] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setTemplates([]); setLoading(true); setError(''); setSearch('');
    void listTemplates(moduleKey, tenantId, profile?.roleKey).then(result => {
      if (!active) return;
      if (result.ok) setTemplates(result.data.filter(template => template.sourceType !== 'assist_visit'));
      else setError(result.error);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Vorlagen konnten nicht geladen werden.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [moduleKey, tenantId, profile?.roleKey, retry]);
  const filtered = useMemo(() => templates.filter(template => `${template.label} ${template.description ?? ''}`.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'))), [templates, search]);
  return <div className="cd-stack">
    {onContinueWithoutTemplate ? <button type="button" className="cd-choice" disabled={disabled} onClick={onContinueWithoutTemplate}><span className="cd-chip">Eigener Termin</span><strong>Ohne Vorlage fortfahren</strong><small>Titel, Zeitraum und Beteiligte selbst festlegen.</small></button> : null}
    <input className="cd-search" type="search" value={search} onChange={e => setSearch(e.target.value)} aria-label="Kalendervorlage suchen" placeholder="Vorlage suchen…" disabled={disabled || loading} />
    {loading ? <p role="status" className="cd-muted">Vorlagen werden geladen…</p> : error ? <div role="alert" className="cd-alert">{error} <button type="button" className="cd-link" onClick={() => setRetry(value => value + 1)}>Erneut laden</button></div> : <>
      <p className="cd-muted">{filtered.length} {filtered.length === 1 ? 'Vorlage' : 'Vorlagen'}</p>
      {filtered.length ? <div className="cd-grid">{filtered.map(template => <button type="button" className="cd-choice" key={template.id} aria-pressed={selectedId === template.id} disabled={disabled} onClick={() => onSelect(template)}>
        <strong>{template.label}</strong>{template.description ? <span className="cd-muted">{template.description}</span> : null}
        <small>{template.allDay ? 'Ganztägig' : `${template.defaultDurationMinutes} Minuten`}{!template.isSystem ? ' · Eigene Vorlage' : ''}</small>
      </button>)}</div> : <p className="cd-info">Keine passende Vorlage. Ändere die Suche oder lege einen eigenen Termin an.</p>}
    </>}
  </div>;
}
export function getDefaultTemplateCount() { return SYSTEM_CALENDAR_TEMPLATES.length; }
