// Generated native presentation from src/screens/qm/QmHandbookScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeStyle,NativeSection,NativeDiv,NativeSpan,NativeH2,NativeStrong,NativeP,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeUl,NativeLi,NativeSmall,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { CatalogIcon } from "../../components/catalog/CatalogWorkspace.native.tsx";
import { QmSectionShell } from "../../components/qm/QmSectionShell.native.tsx";
import { QmDocumentBadge, QmDocumentRefresh, QmDocumentState } from "../../components/qm/QmDocumentUi.native.tsx";
import { qmDocumentWorkspaceCss } from "../../components/qm/qmDocumentWorkspaceCss.native.ts";
import { usePermissions } from '@/hooks/usePermissions';
import { useQmTenantQuery } from "../../hooks/qm/useQmBase.native.ts";
import { fetchQmChapters } from '@/lib/qm/qmHandbookService';
import { fetchOptionalQmHandbook } from "../../lib/qm/qmHandbookRead.native.ts";
import { qmChapterParentPath, qmDisplayDate, qmMatchesSearch, QM_DOCUMENT_STATUS_LABELS } from "../../lib/qm/qmDocumentWorkspace.native.ts";
export function QmHandbookScreen() {
    const router = useRouter();
    const { can, check } = usePermissions();
    const handbook = useQmTenantQuery((tenant, role) => fetchOptionalQmHandbook(tenant, role));
    const query = useQmTenantQuery((tenant, role) => fetchQmChapters(tenant, role));
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const chapters = useMemo(() => query.data ?? [], [query.data]);
    const chapterPaths = useMemo(() => {
        const index = new Map(chapters.map(chapter => [chapter.id, chapter]));
        return new Map(chapters.map(chapter => [chapter.id, qmChapterParentPath(chapter, chapters, index)]));
    }, [chapters]);
    const visible = useMemo(() => [...chapters].filter(chapter => (!status || chapter.status === status)
        && qmMatchesSearch(`${chapter.title} ${chapter.content} ${chapterPaths.get(chapter.id) ?? ''}`, search))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'de-DE')), [chapters, chapterPaths, search, status]);
    const busy = query.loading || query.refreshing || handbook.loading || handbook.refreshing;
    const refresh = async () => { await Promise.all([query.refresh(), handbook.refresh()]); };
    const templates = <NativeButton className="qm-button" type="button" onClick={() => router.push('/business/office/qm/templates' as never)}>QM-Vorlagen öffnen <CatalogIcon kind="arrow"/></NativeButton>;
    const canView = can('qm.view');
    return <NativeWorkspaceStyleScope css={[qmDocumentWorkspaceCss, qmDocumentWorkspaceCss]}>{<QmSectionShell title="QM-Handbuch" subtitle="Kapitel, Verfahrensbeschreibungen und gespeicherte Fassungsstände Ihres Unternehmens." actions={canView ? <QmDocumentRefresh busy={busy} refresh={refresh}/> : undefined}>
    <NativeStyle>{qmDocumentWorkspaceCss}</NativeStyle>
    {!canView ? <QmDocumentState title="Zugriff nicht freigegeben" message={check('qm.view').reason ?? 'Für das Handbuch fehlt die Berechtigung.'}/> : query.loading && !query.data ? <QmDocumentState title="Handbuch wird geladen" message="Die gespeicherten Kapitel werden abgerufen …"/> : query.error && !query.data ? <QmDocumentState title="Kapitel konnten nicht geladen werden" message={query.error} error><QmDocumentRefresh busy={busy} refresh={refresh}/></QmDocumentState> : <>
      {query.refreshError ? <QmDocumentState title="Aktualisierung fehlgeschlagen" message={`${query.refreshError} Die zuletzt geladenen Kapitel bleiben sichtbar.`} error/> : null}
      {handbook.refreshError ? <QmDocumentState title="Handbuchangaben konnten nicht aktualisiert werden" message={`${handbook.refreshError} Titel und Fassungsstand zeigen weiterhin die zuletzt geladenen Handbuchangaben.`} error/> : null}
      {handbook.data ? <NativeSection className="qm-panel"><NativeDiv className="qm-panel-head"><NativeDiv><NativeSpan className="qm-eyebrow">Aktives Handbuch</NativeSpan><NativeH2>{handbook.data.title}</NativeH2></NativeDiv><NativeSpan className="qm-status">Version {handbook.data.version}</NativeSpan></NativeDiv><NativeDiv className="qmd-meta"><NativeSpan><NativeStrong>{chapters.filter(chapter => chapter.handbookId === handbook.data?.id).length}</NativeStrong> geladene Kapitel in diesem Handbuch</NativeSpan><NativeSpan>Zuletzt geändert: <NativeStrong>{qmDisplayDate(handbook.data.updatedAt)}</NativeStrong></NativeSpan></NativeDiv></NativeSection> : handbook.error ? <NativeDiv className="qm-notice" data-tone="warning"><NativeDiv><NativeStrong>Handbuchübersicht nicht verfügbar</NativeStrong><NativeP>{handbook.error} Vorhandene Kapitel können Sie unten unabhängig davon öffnen.</NativeP></NativeDiv></NativeDiv> : !handbook.loading ? <NativeDiv className="qm-notice"><NativeDiv><NativeStrong>Kein aktives Handbuch hinterlegt</NativeStrong><NativeP>Bereits gespeicherte Kapitel bleiben unten erreichbar. Vorlagen für Ihr Handbuch finden Sie im QM-Vorlagenbereich.</NativeP></NativeDiv></NativeDiv> : null}
      <NativeSection className="qm-panel" aria-label="Kapitelübersicht">
        <NativeDiv className="qmd-toolbar"><NativeLabel className="qmd-field qmd-field--search">Kapitel durchsuchen<NativeInput className="qmd-input" type="search" placeholder="Titel, Inhalt oder übergeordnetes Kapitel" value={search} onChange={event => setSearch(event.target.value)}/></NativeLabel><NativeLabel className="qmd-field">Status<NativeSelect className="qmd-input" value={status} onChange={event => setStatus(event.target.value)}><NativeOption value="">Alle Status</NativeOption>{Object.entries(QM_DOCUMENT_STATUS_LABELS).map(([value, label]) => <NativeOption key={value} value={value}>{label}</NativeOption>)}</NativeSelect></NativeLabel></NativeDiv>
        <NativeDiv className="qmd-result"><NativeSpan role="status">{visible.length} von {chapters.length} geladenen Kapiteln</NativeSpan>{search || status ? <NativeButton type="button" className="qm-button" onClick={() => { setSearch(''); setStatus(''); }}>Filter zurücksetzen</NativeButton> : templates}</NativeDiv>
        {visible.length ? <NativeUl className="qmd-list">{visible.map(chapter => <NativeLi key={chapter.id}><NativeButton type="button" className="qmd-row" onClick={() => router.push(`/business/office/qm/handbook/${encodeURIComponent(chapter.id)}` as never)}><NativeSpan className="qmd-mark" aria-hidden="true"><CatalogIcon kind="book"/></NativeSpan><NativeSpan className="qmd-row-body"><NativeStrong>{chapter.title}</NativeStrong><NativeSmall>{chapterPaths.get(chapter.id) || 'Hauptkapitel'} · Version {chapter.version} · Geändert {qmDisplayDate(chapter.updatedAt)}</NativeSmall></NativeSpan><QmDocumentBadge status={chapter.status}/><NativeSpan className="qmd-arrow" aria-hidden="true"><CatalogIcon kind="arrow"/></NativeSpan></NativeButton></NativeLi>)}</NativeUl> : <QmDocumentState title={chapters.length ? 'Keine passenden Kapitel' : 'Noch keine Kapitel gespeichert'} message={chapters.length ? 'Ändern Sie die Suchbegriffe oder den Statusfilter.' : 'Im QM-Handbuch sind noch keine Kapitel hinterlegt. Im Vorlagenbereich finden Sie vorhandene Vorlagen für Prozesse und Arbeitsanweisungen.'}>{!chapters.length ? templates : null}</QmDocumentState>}
      </NativeSection>
    </>}
  </QmSectionShell>}</NativeWorkspaceStyleScope>;
}
