// Generated native presentation from src/screens/qm/QmDocumentsScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeStyle,NativeSection,NativeDiv,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeSpan,NativeButton,NativeUl,NativeLi,NativeStrong,NativeSmall,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CatalogIcon } from "../../components/catalog/CatalogWorkspace.native.tsx";
import { QmSectionShell } from "../../components/qm/QmSectionShell.native.tsx";
import { QmDocumentBadge, QmDocumentRefresh, QmDocumentState } from "../../components/qm/QmDocumentUi.native.tsx";
import { qmDocumentWorkspaceCss } from "../../components/qm/qmDocumentWorkspaceCss.native.ts";
import { usePermissions } from '@/hooks/usePermissions';
import { useQmDocuments } from '@/hooks/qm/useQmDocuments';
import { filterQmDocuments, qmDisplayDate, QM_DOCUMENT_STATUS_LABELS, QM_DOCUMENT_TYPE_LABELS } from "../../lib/qm/qmDocumentWorkspace.native.ts";
export function QmDocumentsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        status?: string | string[];
    }>();
    const requestedStatus = typeof params.status === 'string' && (params.status === 'pending' || Object.hasOwn(QM_DOCUMENT_STATUS_LABELS, params.status)) ? params.status : '';
    const { can, check } = usePermissions();
    const query = useQmDocuments();
    const [search, setSearch] = useState('');
    const status = requestedStatus;
    const setStatus = (value: string) => router.setParams({ status: value });
    const [type, setType] = useState('');
    const items = query.data ?? [];
    const visible = useMemo(() => filterQmDocuments(items, search, status === 'pending' ? '' : status, type)
        .filter(document => status !== 'pending' || document.status === 'draft' || document.status === 'in_review'), [items, search, status, type]);
    const busy = query.loading || query.refreshing;
    const canView = can('qm.view');
    return <NativeWorkspaceStyleScope css={[qmDocumentWorkspaceCss, qmDocumentWorkspaceCss]}>{<QmSectionShell title="QM-Dokumente" subtitle="Arbeitsanweisungen und QM-Unterlagen finden. Gespeicherte Fassungen und Lesebelege im Detail öffnen." actions={canView ? <QmDocumentRefresh busy={busy} refresh={query.refresh}/> : undefined}>
    <NativeStyle>{qmDocumentWorkspaceCss}</NativeStyle>
    {!canView ? <QmDocumentState title="Zugriff nicht freigegeben" message={check('qm.view').reason ?? 'Für QM-Dokumente fehlt die Berechtigung.'}/> : query.loading && !query.data ? <QmDocumentState title="Dokumente werden geladen" message="Die gespeicherten QM-Dokumente werden abgerufen …"/> : query.error && !query.data ? <QmDocumentState title="Dokumente konnten nicht geladen werden" message={query.error} error><QmDocumentRefresh busy={busy} refresh={query.refresh}/></QmDocumentState> : <>
      {query.refreshError ? <QmDocumentState title="Aktualisierung fehlgeschlagen" message={`${query.refreshError} Die zuletzt geladenen Dokumente bleiben sichtbar.`} error/> : null}
      <NativeSection className="qm-panel" aria-label="Dokumentenregister"><NativeDiv className="qmd-toolbar"><NativeLabel className="qmd-field qmd-field--search">Dokumente durchsuchen<NativeInput className="qmd-input" type="search" placeholder="Titel, Nummer, Schlagwort oder Verantwortung" value={search} onChange={event => setSearch(event.target.value)}/></NativeLabel><NativeLabel className="qmd-field">Status<NativeSelect className="qmd-input" value={status} onChange={event => setStatus(event.target.value)}><NativeOption value="">Alle Status</NativeOption><NativeOption value="pending">Entwurf oder in Prüfung</NativeOption>{Object.entries(QM_DOCUMENT_STATUS_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="qmd-field">Dokumentart<NativeSelect className="qmd-input" value={type} onChange={event => setType(event.target.value)}><NativeOption value="">Alle Dokumentarten</NativeOption>{Object.entries(QM_DOCUMENT_TYPE_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel></NativeDiv>
        <NativeDiv className="qmd-result"><NativeSpan role="status">{visible.length} von {items.length} geladenen Dokumenten</NativeSpan>{search || status || type ? <NativeButton className="qm-button" type="button" onClick={() => { setSearch(''); setStatus(''); setType(''); }}>Filter zurücksetzen</NativeButton> : <NativeButton className="qm-button" type="button" onClick={() => router.push('/business/office/qm/templates' as never)}>QM-Vorlagen öffnen <CatalogIcon kind="arrow"/></NativeButton>}</NativeDiv>
        {visible.length ? <NativeUl className="qmd-list">{visible.map(document => <NativeLi key={document.id}><NativeButton className="qmd-row" type="button" onClick={() => router.push(`/business/office/qm/documents/${encodeURIComponent(document.id)}` as never)}><NativeSpan className="qmd-mark" aria-hidden="true"><CatalogIcon kind="layers"/></NativeSpan><NativeSpan className="qmd-row-body"><NativeStrong>{document.title}</NativeStrong><NativeSmall>{document.documentNumber || 'Ohne Dokumentnummer'} · {QM_DOCUMENT_TYPE_LABELS[document.documentType] ?? 'Dokumentart ungeklärt'}{document.ownerRole ? ` · ${document.ownerRole}` : ''}</NativeSmall><NativeSmall>Überprüfung: {qmDisplayDate(document.reviewDueAt)}{document.tags.length ? ` · ${document.tags.join(' · ')}` : ''}</NativeSmall></NativeSpan><QmDocumentBadge status={document.status}/><NativeSpan className="qmd-arrow" aria-hidden="true"><CatalogIcon kind="arrow"/></NativeSpan></NativeButton></NativeLi>)}</NativeUl> : <QmDocumentState title={items.length ? 'Keine passenden Dokumente' : 'Noch keine QM-Dokumente gespeichert'} message={items.length ? 'Ändern Sie die Suche oder setzen Sie die Filter zurück.' : 'Hier erscheinen die QM-Dokumente Ihres Unternehmens. Vorlagen für neue Unterlagen finden Sie im QM-Vorlagenbereich.'}>{!items.length ? <NativeButton className="qm-button qm-button--primary" type="button" onClick={() => router.push('/business/office/qm/templates' as never)}>Vorlagen ansehen</NativeButton> : null}</QmDocumentState>}
      </NativeSection>
    </>}
  </QmSectionShell>}</NativeWorkspaceStyleScope>;
}
