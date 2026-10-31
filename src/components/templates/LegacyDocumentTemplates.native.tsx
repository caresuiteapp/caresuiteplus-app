// Generated native presentation from src/components/templates/LegacyDocumentTemplates.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeDiv,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeTable,NativeThead,NativeTr,NativeTh,NativeSpan,NativeTbody,NativeTd,NativeStrong,NativeP,NativeH2,NativeSection,NativeIframe} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter } from "../../hooks/useFlowRouter.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { listDocumentTemplates, getDocumentTemplateDetail } from '@/lib/documents';
import { sanitizeTemplateHtml } from '@/features/documents/templateEngine/sanitizeTemplateHtml';
import { TemplateAccessMessage, TemplateWorkspaceFrame } from "./TemplateWorkspace.native.tsx";
const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';
const statusLabels: Record<string, string> = { draft: 'Entwurf', active: 'Aktiv', inactive: 'Inaktiv', archived: 'Archiviert', deprecated: 'Abgelöst' };
export function StoredDocumentTemplates() {
    const router = useFlowRouter();
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can } = usePermissions();
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState('tenant');
    const query = useAsyncQuery(() => listDocumentTemplates(tenantId!, profile?.roleKey), [tenantId, profile?.roleKey], { enabled: !!tenantId && can('office.catalogs.view'), queryKey: JSON.stringify([tenantId, profile?.roleKey]) });
    const rows = (query.data ?? []).filter(t => (scope === 'all' || (!t.isSystemTemplate && !!t.tenantId)) && `${t.title} ${t.description ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
    return <TemplateWorkspaceFrame title="Vorhandene Dokumentvorlagen" description="Bisher gespeicherte Vorlagen und ihre Versionen einsehen." actions={<NativeButton className="dw-button dw-button--primary" onClick={() => router.push('/business/office/document-catalog' as never)}>Zum Dokumentenkatalog</NativeButton>}>
    {!can('office.catalogs.view') ? <TemplateAccessMessage /> : !tenantId ? <NativeDiv className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</NativeDiv> : <><NativeDiv className="dw-toolbar"><NativeLabel className="dw-field" style={{ flex: '1 1 260px' }}>Suche<NativeInput className="dw-input" type="search" placeholder="Vorlage suchen" value={search} onChange={e => setSearch(e.target.value)}/></NativeLabel><NativeLabel className="dw-field">Herkunft<NativeSelect className="dw-select" value={scope} onChange={e => setScope(e.target.value)}><NativeOption value="tenant">Eigene Dokumentvorlagen</NativeOption><NativeOption value="all">Alle bisherigen Vorlagen</NativeOption></NativeSelect></NativeLabel><NativeButton className="dw-button" onClick={() => void query.refresh()} disabled={query.loading || query.refreshing}>Aktualisieren</NativeButton></NativeDiv>{query.error || query.refreshError ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{query.error || query.refreshError}</NativeDiv> : null}{query.loading && !query.data ? <NativeDiv className="dw-empty" role="status">Dokumentvorlagen werden geladen …</NativeDiv> : rows.length ? <NativeDiv className="dw-table-wrap"><NativeTable className="dw-table"><NativeThead><NativeTr><NativeTh>Vorlage</NativeTh><NativeTh>Status</NativeTh><NativeTh><NativeSpan className="dw-sr">Aktion</NativeSpan></NativeTh></NativeTr></NativeThead><NativeTbody>{rows.map(t => <NativeTr key={t.id}><NativeTd><NativeStrong>{t.title}</NativeStrong>{t.description ? <NativeP className="dw-muted">{t.description}</NativeP> : null}<NativeSpan className="dw-muted">{t.isSystemTemplate || !t.tenantId ? 'Standardvorlage' : 'Eigene Vorlage'}</NativeSpan></NativeTd><NativeTd><NativeSpan className="dw-status">{statusLabels[t.templateStatus] ?? 'Gespeichert'}</NativeSpan></NativeTd><NativeTd><NativeButton className="dw-button" aria-label={`${t.title} ansehen`} onClick={() => router.push(`/business/templates/document-editor/${t.id}` as never)}>Ansehen</NativeButton></NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv> : <NativeDiv className="dw-empty"><NativeH2>Keine passenden Vorlagen</NativeH2><NativeP>{scope === 'tenant' ? 'Hier erscheinen bisher gespeicherte eigene Dokumentvorlagen. Neue Dokumente erstellen Sie im Katalog.' : 'Ändern Sie die Suche oder wählen Sie eine Vorlage im Katalog.'}</NativeP></NativeDiv>}</>}
  </TemplateWorkspaceFrame>;
}
export function StoredDocumentPreview({ choose = false }: {
    choose?: boolean;
}) {
    const router = useFlowRouter();
    const params = useLocalSearchParams<{
        id?: string;
        templateId?: string;
    }>();
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can } = usePermissions();
    const allowed = can('office.catalogs.view');
    const requestedId = scalar(params.id) || scalar(params.templateId);
    const [selectedId, setSelectedId] = useState(requestedId);
    const [versionId, setVersionId] = useState('');
    const [width, setWidth] = useState('full');
    useEffect(() => { setSelectedId(requestedId); setVersionId(''); }, [requestedId, tenantId]);
    const list = useAsyncQuery(() => listDocumentTemplates(tenantId!, profile?.roleKey), [tenantId, profile?.roleKey], { enabled: choose && !!tenantId && allowed, queryKey: JSON.stringify([tenantId, profile?.roleKey]) });
    const query = useAsyncQuery(() => getDocumentTemplateDetail(tenantId!, selectedId, profile?.roleKey), [tenantId, selectedId, profile?.roleKey], { enabled: !!tenantId && !!selectedId && allowed, queryKey: JSON.stringify([tenantId, selectedId, profile?.roleKey]) });
    const detail = query.data;
    const version = detail?.versions.find(v => v.id === versionId) ?? detail?.activeVersion ?? detail?.draftVersion ?? detail?.versions[0];
    const preview = useMemo(() => { if (!version?.htmlTemplate)
        return ''; const html = sanitizeTemplateHtml(version.htmlTemplate).html; const css = version.cssTemplate.replace(/<\/style/gi, ''); return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{background:white;color:#14243a;font:15px/1.6 Arial,sans-serif}body{padding:24px;margin:0;overflow-wrap:anywhere}img,table{max-width:100%}*{box-sizing:border-box}${css}</style></head><body>${html}</body></html>`; }, [version]);
    return <TemplateWorkspaceFrame title={detail?.title ?? 'Gespeicherte Dokumentvorlage'} description="Vorhandene Versionen ansehen. Neue Dokumente und Anpassungen erstellen Sie im Dokumentenkatalog." actions={<NativeButton className="dw-button dw-button--primary" onClick={() => router.push('/business/office/document-catalog' as never)}>Dokument im Katalog erstellen</NativeButton>}>
    {!allowed ? <TemplateAccessMessage /> : !tenantId ? <NativeDiv className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</NativeDiv> : <>
      {choose ? <NativeSection className="dw-panel"><NativeLabel className="dw-field">Vorlage auswählen<NativeSelect className="dw-select" value={selectedId} onChange={e => { setSelectedId(e.target.value); setVersionId(''); }} disabled={list.loading}><NativeOption value="">Vorlage auswählen</NativeOption>{(list.data ?? []).map(t => <NativeOption value={t.id} key={t.id}>{t.title}</NativeOption>)}</NativeSelect></NativeLabel>{list.error ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{list.error}<NativeButton className="dw-button" onClick={() => void list.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}{!list.loading && !list.error && !list.data?.length ? <NativeP className="dw-muted">Keine bisherigen Dokumentvorlagen vorhanden.</NativeP> : null}</NativeSection> : null}
      {query.error || query.refreshError ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{query.error || query.refreshError}<NativeButton className="dw-button" onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
      {query.loading && !detail ? <NativeDiv className="dw-empty" role="status">Vorlage wird geladen …</NativeDiv> : !selectedId ? <NativeDiv className="dw-empty">Wählen Sie eine gespeicherte Vorlage aus.</NativeDiv> : detail ? <>
        <NativeSection className="dw-panel"><NativeDiv className="dw-toolbar"><NativeLabel className="dw-field" style={{ flex: '1 1 240px' }}>Gespeicherte Version<NativeSelect className="dw-select" value={version?.id ?? ''} onChange={e => setVersionId(e.target.value)} disabled={!detail.versions.length}>{detail.versions.map(v => <NativeOption key={v.id} value={v.id}>Version {v.versionNumber} · {statusLabels[v.versionStatus] ?? 'Gespeichert'}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="dw-field">Ansicht<NativeSelect className="dw-select" value={width} onChange={e => setWidth(e.target.value)}><NativeOption value="full">Verfügbare Breite</NativeOption><NativeOption value="paper">Papierbreite</NativeOption><NativeOption value="narrow">Schmale Ansicht</NativeOption></NativeSelect></NativeLabel></NativeDiv><NativeP className="dw-muted">Die Ansicht zeigt den gespeicherten Stand mit seinen Platzhaltern. Es werden keine Akten- oder Beispieldaten eingesetzt.</NativeP></NativeSection>
        {preview ? <NativeSection className="dw-panel" style={{ background: '#eaf0f6', padding: 16 }}><NativeIframe title={`Gespeicherte Vorlage ${detail.title}`} sandbox="" referrerPolicy="no-referrer" srcDoc={preview} style={{ display: 'block', width: '100%', maxWidth: width === 'narrow' ? 390 : width === 'paper' ? 794 : 'none', height: 720, border: '1px solid #d6e1ed', borderRadius: 12, margin: '0 auto', background: '#fff' }}/></NativeSection> : <NativeDiv className="dw-empty">Zu dieser Vorlage ist keine darstellbare Version gespeichert.</NativeDiv>}
      </> : null}
    </>}
  </TemplateWorkspaceFrame>;
}
