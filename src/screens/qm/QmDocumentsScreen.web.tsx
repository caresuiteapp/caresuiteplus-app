import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CatalogIcon } from '@/components/catalog/CatalogWorkspace.web';
import { QmSectionShell } from '@/components/qm/QmSectionShell.web';
import { QmDocumentBadge, QmDocumentRefresh, QmDocumentState } from '@/components/qm/QmDocumentUi.web';
import { qmDocumentWorkspaceCss } from '@/components/qm/qmDocumentWorkspaceCss.web';
import { usePermissions } from '@/hooks/usePermissions';
import { useQmDocuments } from '@/hooks/qm';
import { filterQmDocuments, qmDisplayDate, QM_DOCUMENT_STATUS_LABELS, QM_DOCUMENT_TYPE_LABELS } from '@/lib/qm/qmDocumentWorkspace.web';

export function QmDocumentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string | string[] }>();
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
  return <QmSectionShell title="QM-Dokumente" subtitle="Arbeitsanweisungen und QM-Unterlagen finden. Gespeicherte Fassungen und Lesebelege im Detail öffnen." actions={canView ? <QmDocumentRefresh busy={busy} refresh={query.refresh}/> : undefined}>
    <style>{qmDocumentWorkspaceCss}</style>
    {!canView ? <QmDocumentState title="Zugriff nicht freigegeben" message={check('qm.view').reason ?? 'Für QM-Dokumente fehlt die Berechtigung.'}/> : query.loading && !query.data ? <QmDocumentState title="Dokumente werden geladen" message="Die gespeicherten QM-Dokumente werden abgerufen …"/> : query.error && !query.data ? <QmDocumentState title="Dokumente konnten nicht geladen werden" message={query.error} error><QmDocumentRefresh busy={busy} refresh={query.refresh}/></QmDocumentState> : <>
      {query.refreshError ? <QmDocumentState title="Aktualisierung fehlgeschlagen" message={`${query.refreshError} Die zuletzt geladenen Dokumente bleiben sichtbar.`} error/> : null}
      <section className="qm-panel" aria-label="Dokumentenregister"><div className="qmd-toolbar"><label className="qmd-field qmd-field--search">Dokumente durchsuchen<input className="qmd-input" type="search" placeholder="Titel, Nummer, Schlagwort oder Verantwortung" value={search} onChange={event => setSearch(event.target.value)}/></label><label className="qmd-field">Status<select className="qmd-input" value={status} onChange={event => setStatus(event.target.value)}><option value="">Alle Status</option><option value="pending">Entwurf oder in Prüfung</option>{Object.entries(QM_DOCUMENT_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="qmd-field">Dokumentart<select className="qmd-input" value={type} onChange={event => setType(event.target.value)}><option value="">Alle Dokumentarten</option>{Object.entries(QM_DOCUMENT_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
        <div className="qmd-result"><span role="status">{visible.length} von {items.length} geladenen Dokumenten</span>{search || status || type ? <button className="qm-button" type="button" onClick={() => { setSearch(''); setStatus(''); setType(''); }}>Filter zurücksetzen</button> : <button className="qm-button" type="button" onClick={() => router.push('/business/office/qm/templates' as never)}>QM-Vorlagen öffnen <CatalogIcon kind="arrow"/></button>}</div>
        {visible.length ? <ul className="qmd-list">{visible.map(document => <li key={document.id}><button className="qmd-row" type="button" onClick={() => router.push(`/business/office/qm/documents/${encodeURIComponent(document.id)}` as never)}><span className="qmd-mark" aria-hidden="true"><CatalogIcon kind="layers"/></span><span className="qmd-row-body"><strong>{document.title}</strong><small>{document.documentNumber || 'Ohne Dokumentnummer'} · {QM_DOCUMENT_TYPE_LABELS[document.documentType] ?? 'Dokumentart ungeklärt'}{document.ownerRole ? ` · ${document.ownerRole}` : ''}</small><small>Überprüfung: {qmDisplayDate(document.reviewDueAt)}{document.tags.length ? ` · ${document.tags.join(' · ')}` : ''}</small></span><QmDocumentBadge status={document.status}/><span className="qmd-arrow" aria-hidden="true"><CatalogIcon kind="arrow"/></span></button></li>)}</ul> : <QmDocumentState title={items.length ? 'Keine passenden Dokumente' : 'Noch keine QM-Dokumente gespeichert'} message={items.length ? 'Ändern Sie die Suche oder setzen Sie die Filter zurück.' : 'Hier erscheinen die QM-Dokumente Ihres Unternehmens. Vorlagen für neue Unterlagen finden Sie im QM-Vorlagenbereich.'}>{!items.length ? <button className="qm-button qm-button--primary" type="button" onClick={() => router.push('/business/office/qm/templates' as never)}>Vorlagen ansehen</button> : null}</QmDocumentState>}
      </section>
    </>}
  </QmSectionShell>;
}
