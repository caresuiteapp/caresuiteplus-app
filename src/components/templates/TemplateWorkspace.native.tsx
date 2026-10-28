// Generated native presentation from src/components/templates/TemplateWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeStyle,NativeButton,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeP,NativeTable,NativeThead,NativeTr,NativeTh,NativeSpan,NativeTbody,NativeTd,NativeStrong,NativeH2,NativeSection,NativeTextarea,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter } from "../../hooks/useFlowRouter.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createTemplate, getTemplate, listTemplates, updateTemplate, archiveTemplate, duplicateSystemTemplateForTenant, getTenantTemplateSettings } from '@/lib/templates';
import { extractTemplateVariables, getSampleVariableValues, renderTemplateWithVariables, TEMPLATE_VARIABLES } from '@/lib/templates/templateVariables';
import { DocumentsWorkspaceShell } from "../documents/DocumentsWorkspaceShell.native.tsx";
import type { TemplateListFilters, TemplateModuleKey, TemplateStatus, TemplateType } from '@/types/templates';
export const TEMPLATE_MODULE_LABELS: Record<TemplateModuleKey, string> = { core: 'Allgemein', office: 'Office', assist: 'Assist', pflege: 'Pflege', stationaer: 'Stationär', beratung: 'Beratung', akademie: 'Fortbildung', communication: 'Kommunikation', billing: 'Abrechnung', documents: 'Dokumente', ti: 'Telematikinfrastruktur' };
export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = { task: 'Aufgabe', documentation_text: 'Textbaustein', message: 'Nachricht', email: 'E-Mail', document: 'Dokumenttext', invoice_text: 'Rechnungstext', dunning_text: 'Mahnungstext', consent: 'Einwilligung', care_plan: 'Pflegeplanung', sis: 'Strukturierte Informationssammlung', risk_assessment: 'Risikoeinschätzung', counseling_protocol: 'Beratungsprotokoll', academy_course: 'Kurs', certificate: 'Bescheinigung', category: 'Kategorie', dropdown_value: 'Auswahlwert', checklist: 'Checkliste' };
export const TEMPLATE_STATUS_LABELS: Record<TemplateStatus, string> = { active: 'Aktiv', draft: 'Entwurf', archived: 'Archiviert', disabled: 'Deaktiviert' };
const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';
export function TemplateWorkspaceFrame({ title, description, children, actions, beforeNavigate }: {
    title: string;
    description?: string;
    children: ReactNode;
    actions?: ReactNode;
    beforeNavigate?: () => boolean | Promise<boolean>;
}) {
    const router = useFlowRouter();
    return <NativeWorkspaceStyleScope css={[`.tw-workspace{display:grid;gap:20px;min-width:0}.tw-workspace .dw-panel{display:flex;flex-direction:column;gap:16px}.tw-workspace .dw-field{font-size:calc(12px * var(--app-font-scale,1));font-weight:600;line-height:1.6}.tw-workspace input[type=checkbox]{accent-color:#1764d4;width:16px;height:16px;vertical-align:middle;margin-right:7px}.tw-workspace .dw-table td:first-child{min-width:220px;max-width:560px;overflow-wrap:anywhere}.tw-workspace .dw-table td:last-child{white-space:nowrap}.tw-workspace .dw-alert{flex-wrap:wrap}.tw-workspace .dw-toolbar h2{flex:1 1 180px}`, `.tw-workspace{display:grid;gap:20px;min-width:0}.tw-workspace .dw-panel{display:flex;flex-direction:column;gap:16px}.tw-workspace .dw-field{font-size:calc(12px * var(--app-font-scale,1));font-weight:600;line-height:1.6}.tw-workspace input[type=checkbox]{accent-color:#1764d4;width:16px;height:16px;vertical-align:middle;margin-right:7px}.tw-workspace .dw-table td:first-child{min-width:220px;max-width:560px;overflow-wrap:anywhere}.tw-workspace .dw-table td:last-child{white-space:nowrap}.tw-workspace .dw-alert{flex-wrap:wrap}.tw-workspace .dw-toolbar h2{flex:1 1 180px}`]}>{<DocumentsWorkspaceShell active="settings" title={title} description={description} beforeNavigate={beforeNavigate} back={{ label: 'Vorlagenverwaltung', onClick: () => router.push('/business/templates/documents-hub' as never) }} actions={actions}><NativeDiv className="tw-workspace"><NativeStyle>{`.tw-workspace{display:grid;gap:20px;min-width:0}.tw-workspace .dw-panel{display:flex;flex-direction:column;gap:16px}.tw-workspace .dw-field{font-size:calc(12px * var(--app-font-scale,1));font-weight:600;line-height:1.6}.tw-workspace input[type=checkbox]{accent-color:#1764d4;width:16px;height:16px;vertical-align:middle;margin-right:7px}.tw-workspace .dw-table td:first-child{min-width:220px;max-width:560px;overflow-wrap:anywhere}.tw-workspace .dw-table td:last-child{white-space:nowrap}.tw-workspace .dw-alert{flex-wrap:wrap}.tw-workspace .dw-toolbar h2{flex:1 1 180px}`}</NativeStyle>{children}</NativeDiv></DocumentsWorkspaceShell>}</NativeWorkspaceStyleScope>;
}
export function TemplateAccessMessage({ edit = false }: {
    edit?: boolean;
}) {
    const { check } = usePermissions();
    return <NativeWorkspaceStyleScope css={[`.tw-workspace{display:grid;gap:20px;min-width:0}.tw-workspace .dw-panel{display:flex;flex-direction:column;gap:16px}.tw-workspace .dw-field{font-size:calc(12px * var(--app-font-scale,1));font-weight:600;line-height:1.6}.tw-workspace input[type=checkbox]{accent-color:#1764d4;width:16px;height:16px;vertical-align:middle;margin-right:7px}.tw-workspace .dw-table td:first-child{min-width:220px;max-width:560px;overflow-wrap:anywhere}.tw-workspace .dw-table td:last-child{white-space:nowrap}.tw-workspace .dw-alert{flex-wrap:wrap}.tw-workspace .dw-toolbar h2{flex:1 1 180px}`]}>{<NativeDiv className="dw-alert" data-tone="danger" role="alert">{check(edit ? 'office.catalogs.edit' : 'office.catalogs.view').reason || 'Für diesen Bereich fehlt die Berechtigung.'}</NativeDiv>}</NativeWorkspaceStyleScope>;
}
export function TemplateListWorkspace({ title, subtitle, baseFilters = {}, showCreate = true }: {
    title: string;
    subtitle: string;
    baseFilters?: TemplateListFilters;
    showCreate?: boolean;
}) {
    const router = useFlowRouter();
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can } = usePermissions();
    const canView = can('office.catalogs.view');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<TemplateStatus | 'all'>('all');
    const [module, setModule] = useState<TemplateModuleKey | 'all'>('all');
    const query = useAsyncQuery(() => listTemplates(tenantId!, baseFilters, profile?.roleKey), [tenantId, profile?.roleKey, JSON.stringify(baseFilters)], { enabled: !!tenantId && canView, queryKey: JSON.stringify([tenantId, profile?.roleKey, baseFilters]) });
    const settings = useAsyncQuery(() => getTenantTemplateSettings(tenantId!, profile?.roleKey), [tenantId, profile?.roleKey], { enabled: !!tenantId && canView, queryKey: JSON.stringify([tenantId, profile?.roleKey]) });
    const rows = (query.data ?? []).filter(row => (settings.data?.showSystemTemplates === true || row.scope === 'tenant') && (status === 'all' || row.status === status) && (module === 'all' || row.moduleKey === module) && `${row.title} ${row.description ?? ''} ${row.content}`.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE')));
    return <NativeWorkspaceStyleScope css={[`.tw-workspace{display:grid;gap:20px;min-width:0}.tw-workspace .dw-panel{display:flex;flex-direction:column;gap:16px}.tw-workspace .dw-field{font-size:calc(12px * var(--app-font-scale,1));font-weight:600;line-height:1.6}.tw-workspace input[type=checkbox]{accent-color:#1764d4;width:16px;height:16px;vertical-align:middle;margin-right:7px}.tw-workspace .dw-table td:first-child{min-width:220px;max-width:560px;overflow-wrap:anywhere}.tw-workspace .dw-table td:last-child{white-space:nowrap}.tw-workspace .dw-alert{flex-wrap:wrap}.tw-workspace .dw-toolbar h2{flex:1 1 180px}`]}>{<TemplateWorkspaceFrame title={title} description={subtitle} actions={showCreate && can('office.catalogs.edit') ? <NativeButton className="dw-button dw-button--primary" onClick={() => router.push(`/business/templates/create${baseFilters.templateType ? `?type=${baseFilters.templateType}` : ''}` as never)}>Vorlage anlegen</NativeButton> : undefined}>
    {!canView ? <TemplateAccessMessage /> : !tenantId ? <NativeDiv className="dw-alert" role="status">Bitte zuerst ein Unternehmen auswählen.</NativeDiv> : <>
      <NativeDiv className="dw-toolbar"><NativeLabel className="dw-field" style={{ flex: '1 1 260px' }}>Suche<NativeInput className="dw-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Titel oder Inhalt suchen" type="search"/></NativeLabel><NativeLabel className="dw-field">Status<NativeSelect className="dw-select" value={status} onChange={e => setStatus(e.target.value as TemplateStatus | 'all')}><NativeOption value="all">Alle Status</NativeOption>{Object.entries(TEMPLATE_STATUS_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel>{!baseFilters.moduleKey ? <NativeLabel className="dw-field">Bereich<NativeSelect className="dw-select" value={module} onChange={e => setModule(e.target.value as TemplateModuleKey | 'all')}><NativeOption value="all">Alle Bereiche</NativeOption>{Object.entries(TEMPLATE_MODULE_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel> : null}<NativeButton className="dw-button" disabled={query.loading || query.refreshing} onClick={() => void query.refresh()}>Aktualisieren</NativeButton></NativeDiv>
      {query.error || query.refreshError ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{query.error || query.refreshError}</NativeDiv> : null}{settings.error ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">Ihre Anzeigeeinstellungen konnten nicht geladen werden.<NativeButton className="dw-button" onClick={() => void settings.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
      {query.loading && !query.data ? <NativeDiv className="dw-empty" role="status">Vorlagen werden geladen …</NativeDiv> : <><NativeP className="dw-muted" aria-live="polite">{rows.length} {rows.length === 1 ? 'Vorlage' : 'Vorlagen'}</NativeP>{rows.length ? <NativeDiv className="dw-table-wrap"><NativeTable className="dw-table"><NativeThead><NativeTr><NativeTh>Vorlage</NativeTh><NativeTh>Bereich</NativeTh><NativeTh>Status</NativeTh><NativeTh><NativeSpan className="dw-sr">Aktion</NativeSpan></NativeTh></NativeTr></NativeThead><NativeTbody>{rows.map(row => <NativeTr key={row.id}><NativeTd><NativeStrong>{row.title}</NativeStrong>{row.description ? <NativeP className="dw-muted">{row.description}</NativeP> : null}<NativeSpan className="dw-muted">{TEMPLATE_TYPE_LABELS[row.templateType] ?? 'Vorlage'} · {row.scope === 'tenant' ? 'Eigene Vorlage' : 'Standardvorlage'}</NativeSpan></NativeTd><NativeTd>{TEMPLATE_MODULE_LABELS[row.moduleKey] ?? 'Allgemein'}</NativeTd><NativeTd><NativeSpan className="dw-status" data-tone={row.status === 'active' ? 'success' : 'neutral'}>{TEMPLATE_STATUS_LABELS[row.status] ?? row.status}</NativeSpan></NativeTd><NativeTd><NativeButton className="dw-button" onClick={() => router.push(`/business/templates/${row.id}` as never)} aria-label={`${row.title} öffnen`}>Öffnen</NativeButton></NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv> : <NativeDiv className="dw-empty"><NativeH2>Keine passenden Vorlagen</NativeH2><NativeP>{search || status !== 'all' || module !== 'all' ? 'Ändern Sie die Suche oder die Filter.' : 'Hier erscheinen Ihre gespeicherten Vorlagen.'}</NativeP>{search || status !== 'all' || module !== 'all' ? <NativeButton className="dw-button" onClick={() => { setSearch(''); setStatus('all'); setModule('all'); }}>Filter zurücksetzen</NativeButton> : null}</NativeDiv>}</>}
    </>}
  </TemplateWorkspaceFrame>}</NativeWorkspaceStyleScope>;
}
function TemplateContentPreview({ content }: {
    content: string;
}) {
    const [samples, setSamples] = useState(false);
    return <NativeWorkspaceStyleScope css={[`.tw-workspace{display:grid;gap:20px;min-width:0}.tw-workspace .dw-panel{display:flex;flex-direction:column;gap:16px}.tw-workspace .dw-field{font-size:calc(12px * var(--app-font-scale,1));font-weight:600;line-height:1.6}.tw-workspace input[type=checkbox]{accent-color:#1764d4;width:16px;height:16px;vertical-align:middle;margin-right:7px}.tw-workspace .dw-table td:first-child{min-width:220px;max-width:560px;overflow-wrap:anywhere}.tw-workspace .dw-table td:last-child{white-space:nowrap}.tw-workspace .dw-alert{flex-wrap:wrap}.tw-workspace .dw-toolbar h2{flex:1 1 180px}`]}>{<NativeSection className="dw-panel"><NativeDiv className="dw-toolbar"><NativeH2>Textvorschau</NativeH2><NativeLabel><NativeInput type="checkbox" checked={samples} onChange={e => setSamples(e.target.checked)}/> Beispieldaten einsetzen</NativeLabel></NativeDiv>{samples ? <NativeP className="dw-muted">Die Namen und Angaben in dieser Vorschau sind fiktiv.</NativeP> : null}<NativeDiv style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.7 }}>{samples ? renderTemplateWithVariables(content, getSampleVariableValues()) : content || 'Noch kein Text eingegeben.'}</NativeDiv></NativeSection>}</NativeWorkspaceStyleScope>;
}
export function TemplateDetailWorkspace() {
    const router = useFlowRouter();
    const params = useLocalSearchParams<{
        id: string;
    }>();
    const id = scalar(params.id);
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can } = usePermissions();
    const canView = can('office.catalogs.view');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const query = useAsyncQuery(() => getTemplate(tenantId!, id, profile?.roleKey), [tenantId, id, profile?.roleKey], { enabled: !!tenantId && !!id && canView, queryKey: JSON.stringify([tenantId, id, profile?.roleKey]) });
    const template = query.data;
    const settings = useAsyncQuery(() => getTenantTemplateSettings(tenantId!, profile?.roleKey), [tenantId, profile?.roleKey], { enabled: !!tenantId && canView, queryKey: JSON.stringify([tenantId, profile?.roleKey]) });
    const canCopy = settings.data?.allowTenantOverrides === true;
    const activeScope = useRef(`${tenantId}:${id}:${profile?.roleKey}`);
    activeScope.current = `${tenantId}:${id}:${profile?.roleKey}`;
    const writeLock = useRef<string | null>(null);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { writeLock.current = null; setPending(false); setError(''); }, [tenantId, id, profile?.roleKey]);
    async function duplicate() { if (!tenantId || !template || pending || !can('office.catalogs.edit') || !canCopy || writeLock.current === activeScope.current)
        return; const scope = activeScope.current; writeLock.current = scope; setPending(true); setError(''); try {
        const result = await duplicateSystemTemplateForTenant(tenantId, template.id, profile?.roleKey, profile?.id);
        if (!mounted.current || activeScope.current !== scope)
            return;
        if (result.ok)
            router.push(`/business/templates/${result.data.id}/edit` as never);
        else
            setError(result.error);
    }
    catch {
        if (mounted.current && activeScope.current === scope)
            setError('Die Vorlage konnte nicht kopiert werden. Bitte erneut versuchen.');
    }
    finally {
        if (writeLock.current === scope)
            writeLock.current = null;
        if (mounted.current && activeScope.current === scope)
            setPending(false);
    } }
    return <NativeWorkspaceStyleScope css={[`.tw-workspace{display:grid;gap:20px;min-width:0}.tw-workspace .dw-panel{display:flex;flex-direction:column;gap:16px}.tw-workspace .dw-field{font-size:calc(12px * var(--app-font-scale,1));font-weight:600;line-height:1.6}.tw-workspace input[type=checkbox]{accent-color:#1764d4;width:16px;height:16px;vertical-align:middle;margin-right:7px}.tw-workspace .dw-table td:first-child{min-width:220px;max-width:560px;overflow-wrap:anywhere}.tw-workspace .dw-table td:last-child{white-space:nowrap}.tw-workspace .dw-alert{flex-wrap:wrap}.tw-workspace .dw-toolbar h2{flex:1 1 180px}`]}>{<TemplateWorkspaceFrame title={template?.title ?? 'Vorlage'} description={template?.description ?? 'Gespeicherten Text ansehen und als eigene Vorlage bearbeiten.'} actions={canView && template && can('office.catalogs.edit') ? (template.scope === 'tenant' ? <NativeButton className="dw-button dw-button--primary" onClick={() => router.push(`/business/templates/${id}/edit` as never)}>Bearbeiten</NativeButton> : <NativeButton className="dw-button dw-button--primary" disabled={pending || !canCopy} onClick={() => void duplicate()}>{pending ? 'Wird kopiert …' : settings.loading ? 'Einstellung wird geladen …' : canCopy ? 'Eigene Kopie anlegen' : 'Kopieren nicht freigegeben'}</NativeButton>) : undefined}>
    {!canView ? <TemplateAccessMessage /> : !tenantId ? <NativeDiv className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</NativeDiv> : query.loading && !template ? <NativeDiv className="dw-empty" role="status">Vorlage wird geladen …</NativeDiv> : query.error && !template ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{query.error}<NativeButton className="dw-button" onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : template ? <><NativeDiv className="dw-toolbar"><NativeSpan className="dw-chip">{TEMPLATE_MODULE_LABELS[template.moduleKey]}</NativeSpan><NativeSpan className="dw-chip">{TEMPLATE_TYPE_LABELS[template.templateType]}</NativeSpan><NativeSpan className="dw-status">{TEMPLATE_STATUS_LABELS[template.status]}</NativeSpan></NativeDiv>{error ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{error}</NativeDiv> : null}{settings.error ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">Vorlageneinstellungen konnten nicht geladen werden.<NativeButton className="dw-button" onClick={() => void settings.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}<TemplateContentPreview content={template.content}/>{template.variables.length ? <NativeSection className="dw-panel"><NativeH2>Automatisch eingesetzte Angaben</NativeH2><NativeDiv className="dw-toolbar">{template.variables.map(key => <NativeSpan className="dw-chip" key={key}>{TEMPLATE_VARIABLES.find(v => v.key === key)?.label ?? key}</NativeSpan>)}</NativeDiv></NativeSection> : null}</> : <NativeDiv className="dw-empty">Vorlage nicht gefunden.</NativeDiv>}
  </TemplateWorkspaceFrame>}</NativeWorkspaceStyleScope>;
}
type TemplateForm = {
    title: string;
    description: string;
    content: string;
    status: TemplateStatus;
    moduleKey: TemplateModuleKey;
    templateType: TemplateType;
};
const emptyForm: TemplateForm = { title: '', description: '', content: '', status: 'draft', moduleKey: 'office', templateType: 'documentation_text' };
export function TemplateEditorWorkspace({ create = false }: {
    create?: boolean;
}) {
    const window = useNativeWorkflowWindow();
    const router = useFlowRouter();
    const params = useLocalSearchParams<{
        id: string;
        type?: string;
    }>();
    const id = scalar(params.id);
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can } = usePermissions();
    const canEdit = can('office.catalogs.edit');
    const [form, setForm] = useState<TemplateForm>({ ...emptyForm, templateType: scalar(params.type) === 'message' ? 'message' : 'documentation_text', moduleKey: scalar(params.type) === 'message' ? 'communication' : 'office' });
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [insertKey, setInsertKey] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const query = useAsyncQuery(() => getTemplate(tenantId!, id, profile?.roleKey), [tenantId, id, profile?.roleKey], { enabled: !create && !!tenantId && !!id && canEdit, queryKey: JSON.stringify([tenantId, id, profile?.roleKey]) });
    const activeScope = useRef(`${tenantId}:${id}:${profile?.roleKey}:${create}:${scalar(params.type)}`);
    activeScope.current = `${tenantId}:${id}:${profile?.roleKey}:${create}:${scalar(params.type)}`;
    const writeLock = useRef<string | null>(null);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const loadedKey = useRef('');
    useEffect(() => { const key = `${tenantId}:${id}:${profile?.roleKey}:${create}:${scalar(params.type)}`; if (loadedKey.current !== key) {
        loadedKey.current = key;
        writeLock.current = null;
        setDirty(false);
        setSaving(false);
        setError('');
        setSuccess('');
        setArchiveOpen(false);
        setForm({ ...emptyForm, templateType: scalar(params.type) === 'message' ? 'message' : 'documentation_text', moduleKey: scalar(params.type) === 'message' ? 'communication' : 'office' });
    } }, [tenantId, id, params.type, profile?.roleKey, create]);
    useEffect(() => { if (!query.data || dirty)
        return; const t = query.data; setForm({ title: t.title, description: t.description ?? '', content: t.content, status: t.status, moduleKey: t.moduleKey, templateType: t.templateType }); }, [query.data, dirty]);
    useEffect(() => { if (!dirty)
        return; const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent); }, [dirty]);
    const patch = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => { setForm(prev => ({ ...prev, [key]: value })); setDirty(true); setSuccess(''); };
    const isEditable = create || query.data?.scope === 'tenant';
    async function save() { if (!tenantId || !canEdit || saving || !isEditable || !form.title.trim() || !form.content.trim() || writeLock.current === activeScope.current)
        return; const scope = activeScope.current; writeLock.current = scope; setSaving(true); setError(''); setSuccess(''); try {
        const shared = { title: form.title.trim(), description: form.description.trim() || null, content: form.content, variables: extractTemplateVariables(form.content), status: form.status };
        const result = create ? await createTemplate(tenantId, { ...shared, moduleKey: form.moduleKey, templateType: form.templateType }, profile?.roleKey, profile?.id) : await updateTemplate(tenantId, id, shared, profile?.roleKey);
        if (!mounted.current || activeScope.current !== scope)
            return;
        if (result.ok) {
            setDirty(false);
            if (create)
                router.replace(`/business/templates/${result.data.id}/edit` as never);
            else {
                query.setData(result.data);
                setSuccess('Änderungen gespeichert.');
            }
        }
        else
            setError(result.error);
    }
    catch {
        if (mounted.current && activeScope.current === scope)
            setError('Speichern fehlgeschlagen. Ihre Eingaben bleiben erhalten.');
    }
    finally {
        if (writeLock.current === scope)
            writeLock.current = null;
        if (mounted.current && activeScope.current === scope)
            setSaving(false);
    } }
    async function archive() { if (!tenantId || !canEdit || saving || create || !isEditable || writeLock.current === activeScope.current)
        return; const scope = activeScope.current; writeLock.current = scope; setSaving(true); setError(''); try {
        const result = await archiveTemplate(tenantId, id, profile?.roleKey);
        if (!mounted.current || activeScope.current !== scope)
            return;
        if (result.ok) {
            setDirty(false);
            query.setData(result.data);
            setArchiveOpen(false);
            setSuccess('Vorlage archiviert. Sie bleibt in der Vorlagenliste erreichbar.');
        }
        else
            setError(result.error);
    }
    catch {
        if (mounted.current && activeScope.current === scope)
            setError('Archivieren fehlgeschlagen. Bitte erneut versuchen.');
    }
    finally {
        if (writeLock.current === scope)
            writeLock.current = null;
        if (mounted.current && activeScope.current === scope)
            setSaving(false);
    } }
    function insertVariable() { if (!insertKey)
        return; const input = inputRef.current; const start = input?.selectionStart ?? form.content.length; const end = input?.selectionEnd ?? start; const token = `{{${insertKey}}}`; patch('content', form.content.slice(0, start) + token + form.content.slice(end)); setInsertKey(''); requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + token.length, start + token.length); }); }
    const beforeNavigate = async () => !writeLock.current && !saving && (!dirty || await confirmNativeWorkspaceAction('Ungespeicherte Änderungen verwerfen?'));
    async function cancel() { if (!await beforeNavigate())
        return; router.push((create ? '/business/templates/tenant' : `/business/templates/${id}`) as never); }
    const showForm = canEdit && !!tenantId && (create || !!query.data) && isEditable;
    return <NativeWorkspaceStyleScope css={[`.tw-workspace{display:grid;gap:20px;min-width:0}.tw-workspace .dw-panel{display:flex;flex-direction:column;gap:16px}.tw-workspace .dw-field{font-size:calc(12px * var(--app-font-scale,1));font-weight:600;line-height:1.6}.tw-workspace input[type=checkbox]{accent-color:#1764d4;width:16px;height:16px;vertical-align:middle;margin-right:7px}.tw-workspace .dw-table td:first-child{min-width:220px;max-width:560px;overflow-wrap:anywhere}.tw-workspace .dw-table td:last-child{white-space:nowrap}.tw-workspace .dw-alert{flex-wrap:wrap}.tw-workspace .dw-toolbar h2{flex:1 1 180px}`]}>{<TemplateWorkspaceFrame beforeNavigate={beforeNavigate} title={create ? 'Eigene Textvorlage anlegen' : 'Textvorlage bearbeiten'} description="Wiederkehrende Texte vorbereiten und passende Angaben automatisch einsetzen." actions={showForm ? <NativeButton className="dw-button dw-button--primary" disabled={saving || !form.title.trim() || !form.content.trim() || (!create && !dirty)} onClick={() => void save()}>{saving ? 'Wird gespeichert …' : 'Speichern'}</NativeButton> : undefined}>
    {!canEdit ? <TemplateAccessMessage edit/> : !tenantId ? <NativeDiv className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</NativeDiv> : !create && query.loading && !query.data ? <NativeDiv className="dw-empty" role="status">Vorlage wird geladen …</NativeDiv> : !create && query.error && !query.data ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{query.error}<NativeButton className="dw-button" onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : !isEditable ? <NativeDiv className="dw-empty">Standardvorlagen können über eine eigene Kopie bearbeitet werden.</NativeDiv> : showForm ? <>
      {error ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{error}</NativeDiv> : null}{success ? <NativeDiv className="dw-alert" data-tone="success" role="status">{success}</NativeDiv> : null}
      <NativeSection className="dw-panel"><NativeDiv className="dw-grid"><NativeLabel className="dw-field">Titel<NativeInput className="dw-input" value={form.title} onChange={e => patch('title', e.target.value)} disabled={saving} maxLength={180} required/></NativeLabel><NativeLabel className="dw-field">Status<NativeSelect className="dw-select" value={form.status} onChange={e => patch('status', e.target.value as TemplateStatus)} disabled={saving}>{Object.entries(TEMPLATE_STATUS_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel>{create ? <><NativeLabel className="dw-field">Verwendung<NativeSelect className="dw-select" value={form.templateType} onChange={e => { patch('templateType', e.target.value as TemplateType); if (e.target.value === 'message' || e.target.value === 'email')
            patch('moduleKey', 'communication'); }} disabled={saving}>{(['documentation_text', 'message', 'email', 'invoice_text', 'dunning_text', 'checklist'] as const).map(key => <NativeOption key={key} value={key}>{TEMPLATE_TYPE_LABELS[key]}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="dw-field">Bereich<NativeSelect className="dw-select" value={form.moduleKey} onChange={e => patch('moduleKey', e.target.value as TemplateModuleKey)} disabled={saving}>{Object.entries(TEMPLATE_MODULE_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel></> : null}</NativeDiv><NativeLabel className="dw-field">Kurzbeschreibung<NativeInput className="dw-input" value={form.description} onChange={e => patch('description', e.target.value)} disabled={saving} maxLength={400}/></NativeLabel><NativeDiv className="dw-toolbar"><NativeLabel className="dw-field" style={{ flex: '1 1 240px' }}>Angabe einfügen<NativeSelect className="dw-select" value={insertKey} onChange={e => setInsertKey(e.target.value)} disabled={saving}><NativeOption value="">Angabe auswählen</NativeOption>{TEMPLATE_VARIABLES.map(v => <NativeOption key={v.key} value={v.key}>{v.label}</NativeOption>)}</NativeSelect></NativeLabel><NativeButton className="dw-button" disabled={!insertKey || saving} onClick={insertVariable}>In Text einsetzen</NativeButton></NativeDiv><NativeLabel className="dw-field">Vorlagentext<NativeTextarea ref={inputRef} className="dw-input" value={form.content} rows={14} onChange={e => patch('content', e.target.value)} disabled={saving} required style={{ resize: 'vertical', lineHeight: 1.65 }}/></NativeLabel></NativeSection>
      <TemplateContentPreview content={form.content}/><NativeDiv className="dw-toolbar"><NativeButton className="dw-button" disabled={saving} onClick={cancel}>Abbrechen</NativeButton>{!create && form.status !== 'archived' ? <NativeButton className="dw-button dw-button--danger" disabled={saving} onClick={() => setArchiveOpen(true)}>Archivieren</NativeButton> : null}<NativeSpan className="dw-muted" role="status">{dirty ? 'Ungespeicherte Änderungen' : ''}</NativeSpan></NativeDiv>
      {archiveOpen ? <NativeSection className="dw-panel" aria-label="Archivierung bestätigen"><NativeH2>Vorlage archivieren?</NativeH2><NativeP>Sie bleibt gespeichert und kann später wieder aktiviert werden.{dirty ? ' Ungespeicherte Änderungen werden dabei verworfen.' : ''}</NativeP><NativeDiv className="dw-toolbar"><NativeButton className="dw-button dw-button--danger" disabled={saving} onClick={() => void archive()}>Archivierung bestätigen</NativeButton><NativeButton className="dw-button" disabled={saving} onClick={() => setArchiveOpen(false)}>Zurück</NativeButton></NativeDiv></NativeSection> : null}
    </> : null}
  </TemplateWorkspaceFrame>}</NativeWorkspaceStyleScope>;
}
