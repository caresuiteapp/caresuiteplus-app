// Generated native presentation from src/components/calendar/CalendarEventTemplatePicker.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeButton,NativeSpan,NativeStrong,NativeSmall,NativeInput,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useMemo, useState } from 'react';
import type { CalendarEventTemplate, CalendarModuleKey } from '@/types/calendar';
import { listCalendarPlanningTemplates, getDefaultCalendarPlanningTemplates } from "../../lib/calendar/calendarPlanningTemplates.native.ts";
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
export function CalendarEventTemplatePicker({ moduleKey, selectedId, onSelect, onContinueWithoutTemplate, disabled = false }: {
    moduleKey: CalendarModuleKey;
    selectedId?: string | null;
    onSelect: (template: CalendarEventTemplate) => void;
    onContinueWithoutTemplate?: () => void;
    accentColor?: string;
    disabled?: boolean;
}) {
    const { profile } = useAuth();
    const tenantId = useServiceTenantId();
    const scope = JSON.stringify([moduleKey, tenantId, profile?.id, profile?.roleKey]);
    const [loadedScope, setLoadedScope] = useState(scope);
    const [templates, setTemplates] = useState<CalendarEventTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        let active = true;
        setLoadedScope(scope);
        setTemplates([]);
        setLoading(true);
        setError('');
        setSearch('');
        void listCalendarPlanningTemplates(moduleKey, tenantId, profile?.roleKey).then(result => {
            if (!active)
                return;
            if (result.ok)
                setTemplates(result.data);
            else
                setError(result.error);
        }).catch(cause => { if (active)
            setError(cause instanceof Error ? cause.message : 'Vorlagen konnten nicht geladen werden.'); })
            .finally(() => { if (active)
            setLoading(false); });
        return () => { active = false; };
    }, [scope, moduleKey, tenantId, profile?.roleKey, retry]);
    const filtered = useMemo(() => templates.filter(template => `${template.label} ${template.description ?? ''} ${template.templateKey}`.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'))), [templates, search]);
    const pending = loading || loadedScope !== scope;
    return <NativeDiv className="cd-stack" data-cs-calendar-templates="planning-catalog-v1">
    {onContinueWithoutTemplate ? <NativeButton type="button" className="cd-choice" disabled={disabled} onClick={onContinueWithoutTemplate}><NativeSpan className="cd-chip">Eigener Termin</NativeSpan><NativeStrong>Ohne Vorlage fortfahren</NativeStrong><NativeSmall>Titel, Zeitraum und Beteiligte selbst festlegen.</NativeSmall></NativeButton> : null}
    <NativeInput className="cd-search" type="search" value={loadedScope === scope ? search : ''} onChange={e => setSearch(e.target.value)} aria-label="Kalendervorlage suchen" placeholder="Vorlage suchen…" disabled={disabled || pending}/>
    {pending ? <NativeP role="status" className="cd-muted">Vorlagen werden geladen…</NativeP> : error ? <NativeDiv role="alert" className="cd-alert">{error} <NativeButton type="button" className="cd-link" onClick={() => setRetry(value => value + 1)}>Erneut laden</NativeButton></NativeDiv> : <>
      <NativeP className="cd-muted">{filtered.length} {filtered.length === 1 ? 'Vorlage' : 'Vorlagen'}</NativeP>
      {filtered.length ? <NativeDiv className="cd-grid">{filtered.map(template => <NativeButton type="button" className="cd-choice" key={template.id} aria-pressed={selectedId === template.id} disabled={disabled} onClick={() => onSelect(template)}>
        <NativeStrong>{template.label}</NativeStrong>{template.description ? <NativeSpan className="cd-muted">{template.description}</NativeSpan> : null}
        <NativeSmall>{template.allDay ? 'Ganztägig' : `${template.defaultDurationMinutes} Minuten`}{!template.isSystem ? ' · Eigene Vorlage' : ''}</NativeSmall>
      </NativeButton>)}</NativeDiv> : <NativeDiv className="cd-info" role="status">{search.trim() ? <>
        <NativeP>Keine Vorlage passt zu deiner Suche.</NativeP><NativeButton type="button" className="cd-link" disabled={disabled} onClick={() => setSearch('')}>Suche zurücksetzen</NativeButton>
      </> : <NativeP>Für diesen Bereich sind derzeit keine Kalendervorlagen verfügbar. Du kannst einen eigenen Termin anlegen.</NativeP>}</NativeDiv>}
    </>}
  </NativeDiv>;
}
export function getDefaultTemplateCount() { return getDefaultCalendarPlanningTemplates().length; }
