// Generated native presentation from src/screens/office/OfficeDocumentsListScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeDiv,NativeStrong,NativeSpan,NativeStyle,NativeA,NativeSection,NativeH2,NativeP,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeH3,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeSmall,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { DocumentsWorkspaceShell, DocumentWorkspaceIcon } from "../../components/documents/DocumentsWorkspaceShell.native.tsx";
import { PortalUploadsOfficePanel } from "../../components/office/PortalUploadsOfficePanel.native.tsx";
import { officeDocumentWorkspaceCss, documentDate, documentSize, pendingDocument } from "../../components/office/officeDocumentWorkspace.native.ts";
import { fetchOfficeDocumentList } from "../../lib/office/officeDocumentsService.ts";
import { PORTAL_DOCUMENT_CATEGORY_LABELS, type PortalDocumentListItem } from '@/types/portal/documents';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
export function OfficeDocumentsListScreen() {
    const router = useRouter();
    const { profile } = useAuth();
    const tenantId = useServiceTenantId();
    const { can } = usePermissions();
    const [items, setItems] = useState<PortalDocumentListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [status, setStatus] = useState('all');
    const [sort, setSort] = useState('newest');
    const [count, setCount] = useState(25);
    const generation = useRef(0);
    const abort = useRef<AbortController | null>(null);
    const canView = can('office.documents.view');
    const canUpload = canView && can('office.clients.edit');
    const refresh = useCallback(async () => { const run = ++generation.current; abort.current?.abort(); const controller = new AbortController(); abort.current = controller; if (!tenantId || !canView) {
        setItems([]);
        setLoading(false);
        return;
    } setLoading(true); setError(null); try {
        const result = await fetchOfficeDocumentList(tenantId, profile?.roleKey, profile, { signal: controller.signal });
        if (run !== generation.current)
            return;
        if (result.ok)
            setItems(result.data);
        else
            setError(result.error);
    }
    catch {
        if (run === generation.current)
            setError('Die Ablage konnte nicht geladen werden.');
    }
    finally {
        if (run === generation.current)
            setLoading(false);
    } }, [tenantId, profile, canView]);
    useEffect(() => { setItems([]); void refresh(); return () => { generation.current += 1; abort.current?.abort(); }; }, [refresh]);
    useEffect(() => setCount(25), [search, category, status, sort]);
    const filtered = useMemo(() => items.filter(item => (category === 'all' || item.category === category) && (status === 'all' || (status === 'signature' ? pendingDocument(item) : item.status === status)) && [item.title, item.displayFileName ?? item.fileName, item.clientName].filter(Boolean).join(' ').toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'))).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'de') : sort === 'oldest' ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt)), [items, category, status, search, sort]);
    const reset = () => { setSearch(''); setCategory('all'); setStatus('all'); setSort('newest'); };
    const hasFilters = Boolean(search || category !== 'all' || status !== 'all');
    return <NativeWorkspaceStyleScope css={[officeDocumentWorkspaceCss, officeDocumentWorkspaceCss]}>{<DocumentsWorkspaceShell active="library" title="Dokumentenablage" description="Unterlagen in Klientenakten finden, Portal-Eingänge prüfen und Dateien sicher ablegen." actions={<>{canUpload ? <NativeButton type="button" className="dw-button dw-button--primary" onClick={() => router.push('/business/office/documents/upload' as never)}><DocumentWorkspaceIcon name="upload"/>In Klientenakte hochladen</NativeButton> : null}<NativeButton type="button" className="dw-button" onClick={() => void refresh()} disabled={loading}><DocumentWorkspaceIcon name="refresh"/>Aktualisieren</NativeButton></>} stats={canView ? <NativeDiv className="dw-library-stats"><NativeDiv className="dw-metric"><NativeStrong>{loading ? '—' : items.length}</NativeStrong><NativeSpan>Aktenunterlagen</NativeSpan></NativeDiv><NativeDiv className="dw-metric"><NativeStrong>{loading ? '—' : items.filter(pendingDocument).length}</NativeStrong><NativeSpan>Unterschriften offen</NativeSpan></NativeDiv><NativeDiv className="dw-metric"><NativeStrong>{loading ? '—' : new Set(items.map(item => item.clientId).filter(Boolean)).size}</NativeStrong><NativeSpan>Klientenakten</NativeSpan></NativeDiv></NativeDiv> : undefined}>
    <NativeStyle>{officeDocumentWorkspaceCss}</NativeStyle>
    {!canView ? <NativeDiv className="dw-empty">Ihre Rolle hat keine Berechtigung für die Dokumentenablage.</NativeDiv> : <>
      <NativeDiv className="dw-library-sources"><NativeA className="dw-library-source" href="/business/office/document-catalog?tab=records" onClick={event => { event.preventDefault(); router.push('/business/office/document-catalog?tab=records' as never); }}><NativeStrong>Katalogdokumente</NativeStrong><NativeSpan>Gespeicherte Fassungen für Unternehmen, Personal und Klienten</NativeSpan></NativeA><NativeA className="dw-library-source" href="/business/office/document-catalog" onClick={event => { event.preventDefault(); router.push('/business/office/document-catalog' as never); }}><NativeStrong>Dokument erstellen</NativeStrong><NativeSpan>Die 450 Vorlagen im zentralen Katalog verwenden</NativeSpan></NativeA>{can('office.employees.view') ? <NativeA className="dw-library-source" href="/business/office/employees" onClick={event => { event.preventDefault(); router.push('/business/office/employees' as never); }}><NativeStrong>Personalunterlagen</NativeStrong><NativeSpan>Dokumente direkt in der jeweiligen Personalakte</NativeSpan></NativeA> : null}</NativeDiv>
      {tenantId ? <PortalUploadsOfficePanel tenantId={tenantId} onReviewed={() => void refresh()}/> : null}
      <NativeSection className="dw-panel"><NativeDiv className="dw-library-heading"><NativeDiv><NativeH2>Unterlagen der Klientenakten</NativeH2><NativeP className="dw-muted">{filtered.length} von {items.length} Dokumenten{loading ? ' · Wird aktualisiert…' : ''}</NativeP></NativeDiv>{hasFilters ? <NativeButton type="button" className="dw-button dw-button--quiet" onClick={reset}>Filter zurücksetzen</NativeButton> : null}</NativeDiv>
        <NativeDiv className="dw-library-filters"><NativeLabel className="dw-field"><NativeSpan className="dw-label">Suchen</NativeSpan><NativeInput className="dw-input" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Titel, Dateiname oder Person"/></NativeLabel><NativeLabel className="dw-field"><NativeSpan className="dw-label">Kategorie</NativeSpan><NativeSelect className="dw-select" value={category} onChange={event => setCategory(event.target.value)}><NativeOption value="all">Alle Kategorien</NativeOption>{Object.entries(PORTAL_DOCUMENT_CATEGORY_LABELS).map(([value, label]) => <NativeOption value={value} key={value}>{label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="dw-field"><NativeSpan className="dw-label">Status</NativeSpan><NativeSelect className="dw-select" value={status} onChange={event => setStatus(event.target.value)}><NativeOption value="all">Alle Status</NativeOption><NativeOption value="signature">Unterschrift ausstehend</NativeOption>{Object.entries(WORKFLOW_STATUS_LABELS).map(([value, label]) => <NativeOption key={value} value={value}>{label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="dw-field"><NativeSpan className="dw-label">Sortierung</NativeSpan><NativeSelect className="dw-select" value={sort} onChange={event => setSort(event.target.value)}><NativeOption value="newest">Neueste zuerst</NativeOption><NativeOption value="oldest">Älteste zuerst</NativeOption><NativeOption value="title">Titel A–Z</NativeOption></NativeSelect></NativeLabel></NativeDiv>
        {error ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{error}<NativeButton type="button" className="dw-button" onClick={() => void refresh()}>Erneut versuchen</NativeButton></NativeDiv> : null}
        {loading && items.length === 0 ? <NativeDiv className="dw-empty" role="status">Dokumente werden geladen…</NativeDiv> : !error && filtered.length === 0 ? <NativeDiv className="dw-empty"><NativeH3>{hasFilters ? 'Keine passenden Dokumente' : 'Noch keine Aktenunterlagen'}</NativeH3><NativeP>{hasFilters ? 'Ändern Sie den Suchbegriff oder setzen Sie die Filter zurück.' : 'Hochgeladene Dateien und erstellte Aufnahmeunterlagen erscheinen hier mit ihrer Aktenzuordnung.'}</NativeP></NativeDiv> : <NativeDiv className="dw-table-wrap" style={{ marginTop: 20 }}><NativeTable className="dw-table dw-library-table"><NativeThead><NativeTr><NativeTh scope="col">Dokument</NativeTh><NativeTh scope="col">Zuordnung</NativeTh><NativeTh scope="col">Status</NativeTh><NativeTh scope="col">Aktualisiert</NativeTh><NativeTh scope="col"><NativeSpan className="dw-sr">Aktion</NativeSpan></NativeTh></NativeTr></NativeThead><NativeTbody>{filtered.slice(0, count).map(item => { const pending = pendingDocument(item); return <NativeWorkspaceStyleScope key={item.id} css={[officeDocumentWorkspaceCss]}>{<NativeTr key={item.id}><NativeTd><NativeDiv className="dw-library-title"><DocumentWorkspaceIcon name={pending ? 'signature' : 'document'} size={24}/><NativeDiv><NativeStrong>{item.title}</NativeStrong><NativeSmall>{PORTAL_DOCUMENT_CATEGORY_LABELS[item.category]} · {pending ? 'Datei nach Unterschrift' : item.sizeLabel || documentSize(item.fileSizeBytes)}</NativeSmall></NativeDiv></NativeDiv></NativeTd><NativeTd>{item.clientName || 'Klientenakte'}</NativeTd><NativeTd><NativeSpan className="dw-status" data-tone={pending ? 'warning' : item.status === 'fehlerhaft' ? 'danger' : item.status === 'abgeschlossen' ? 'success' : 'neutral'}>{pending ? 'Unterschrift offen' : WORKFLOW_STATUS_LABELS[item.status]}</NativeSpan></NativeTd><NativeTd>{documentDate(item.updatedAt)}</NativeTd><NativeTd><NativeButton type="button" className="dw-button" onClick={() => router.push(`/business/office/documents/${item.id}` as never)} aria-label={`${item.title} öffnen`}>Öffnen<DocumentWorkspaceIcon name="arrow" size={16}/></NativeButton></NativeTd></NativeTr>}</NativeWorkspaceStyleScope>; })}</NativeTbody></NativeTable></NativeDiv>}
        {filtered.length > 0 ? <NativeDiv className="dw-library-footer"><NativeSpan className="dw-muted">{Math.min(count, filtered.length)} von {filtered.length} angezeigt</NativeSpan>{count < filtered.length ? <NativeButton type="button" className="dw-button" onClick={() => setCount(value => value + 25)}>Weitere Dokumente anzeigen</NativeButton> : null}</NativeDiv> : null}
      </NativeSection>
    </>}
  </DocumentsWorkspaceShell>}</NativeWorkspaceStyleScope>;
}
