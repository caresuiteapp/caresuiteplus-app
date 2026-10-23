import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { CatalogIcon } from '@/components/catalog/CatalogWorkspace.web';
import { QmSectionShell } from '@/components/qm/QmSectionShell.web';
import { QmDocumentBadge, QmDocumentRefresh, QmDocumentState } from '@/components/qm/QmDocumentUi.web';
import { qmDocumentWorkspaceCss } from '@/components/qm/qmDocumentWorkspaceCss.web';
import { usePermissions } from '@/hooks/usePermissions';
import { useQmTenantQuery } from '@/hooks/qm/useQmBase';
import { fetchQmChapters } from '@/lib/qm/qmHandbookService';
import { fetchOptionalQmHandbook } from '@/lib/qm/qmHandbookRead.web';
import { qmChapterParentPath, qmDisplayDate, qmMatchesSearch, QM_DOCUMENT_STATUS_LABELS } from '@/lib/qm/qmDocumentWorkspace.web';

export function QmHandbookScreen() {
  const router = useRouter();
  const { can, check } = usePermissions();
  const handbook = useQmTenantQuery((tenant, role) => fetchOptionalQmHandbook(tenant, role));
  const query = useQmTenantQuery((tenant, role) => fetchQmChapters(tenant, role));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const chapters = query.data ?? [];
  const visible = useMemo(() => [...chapters].filter(chapter => (!status || chapter.status === status)
    && qmMatchesSearch(`${chapter.title} ${chapter.content} ${qmChapterParentPath(chapter, chapters)}`, search))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'de-DE')), [chapters, search, status]);
  const busy = query.loading || query.refreshing || handbook.loading || handbook.refreshing;
  const refresh = async () => { await Promise.all([query.refresh(), handbook.refresh()]); };
  const templates = <button className="qm-button" type="button" onClick={() => router.push('/business/office/qm/templates' as never)}>QM-Vorlagen öffnen <CatalogIcon kind="arrow"/></button>;
  const canView = can('qm.view');
  return <QmSectionShell title="QM-Handbuch" subtitle="Kapitel, Verfahrensbeschreibungen und gespeicherte Fassungsstände Ihres Unternehmens." actions={canView ? <QmDocumentRefresh busy={busy} refresh={refresh}/> : undefined}>
    <style>{qmDocumentWorkspaceCss}</style>
    {!canView ? <QmDocumentState title="Zugriff nicht freigegeben" message={check('qm.view').reason ?? 'Für das Handbuch fehlt die Berechtigung.'}/> : query.loading && !query.data ? <QmDocumentState title="Handbuch wird geladen" message="Die gespeicherten Kapitel werden abgerufen …"/> : query.error && !query.data ? <QmDocumentState title="Kapitel konnten nicht geladen werden" message={query.error} error><QmDocumentRefresh busy={busy} refresh={refresh}/></QmDocumentState> : <>
      {query.refreshError ? <QmDocumentState title="Aktualisierung fehlgeschlagen" message={`${query.refreshError} Die zuletzt geladenen Kapitel bleiben sichtbar.`} error/> : null}
      {handbook.refreshError ? <QmDocumentState title="Handbuchangaben konnten nicht aktualisiert werden" message={`${handbook.refreshError} Titel und Fassungsstand zeigen weiterhin die zuletzt geladenen Handbuchangaben.`} error/> : null}
      {handbook.data ? <section className="qm-panel"><div className="qm-panel-head"><div><span className="qm-eyebrow">Aktives Handbuch</span><h2>{handbook.data.title}</h2></div><span className="qm-status">Version {handbook.data.version}</span></div><div className="qmd-meta"><span><strong>{chapters.filter(chapter => chapter.handbookId === handbook.data?.id).length}</strong> geladene Kapitel in diesem Handbuch</span><span>Zuletzt geändert: <strong>{qmDisplayDate(handbook.data.updatedAt)}</strong></span></div></section> : handbook.error ? <div className="qm-notice" data-tone="warning"><div><strong>Handbuchübersicht nicht verfügbar</strong><p>{handbook.error} Vorhandene Kapitel können Sie unten unabhängig davon öffnen.</p></div></div> : !handbook.loading ? <div className="qm-notice"><div><strong>Kein aktives Handbuch hinterlegt</strong><p>Bereits gespeicherte Kapitel bleiben unten erreichbar. Vorlagen für Ihr Handbuch finden Sie im QM-Vorlagenbereich.</p></div></div> : null}
      <section className="qm-panel" aria-label="Kapitelübersicht">
        <div className="qmd-toolbar"><label className="qmd-field qmd-field--search">Kapitel durchsuchen<input className="qmd-input" type="search" placeholder="Titel, Inhalt oder übergeordnetes Kapitel" value={search} onChange={event => setSearch(event.target.value)}/></label><label className="qmd-field">Status<select className="qmd-input" value={status} onChange={event => setStatus(event.target.value)}><option value="">Alle Status</option>{Object.entries(QM_DOCUMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        <div className="qmd-result"><span role="status">{visible.length} von {chapters.length} geladenen Kapiteln</span>{search || status ? <button type="button" className="qm-button" onClick={() => { setSearch(''); setStatus(''); }}>Filter zurücksetzen</button> : templates}</div>
        {visible.length ? <ul className="qmd-list">{visible.map(chapter => <li key={chapter.id}><button type="button" className="qmd-row" onClick={() => router.push(`/business/office/qm/handbook/${encodeURIComponent(chapter.id)}` as never)}><span className="qmd-mark" aria-hidden="true"><CatalogIcon kind="book"/></span><span className="qmd-row-body"><strong>{chapter.title}</strong><small>{qmChapterParentPath(chapter, chapters) || 'Hauptkapitel'} · Version {chapter.version} · Geändert {qmDisplayDate(chapter.updatedAt)}</small></span><QmDocumentBadge status={chapter.status}/><span className="qmd-arrow" aria-hidden="true"><CatalogIcon kind="arrow"/></span></button></li>)}</ul> : <QmDocumentState title={chapters.length ? 'Keine passenden Kapitel' : 'Noch keine Kapitel gespeichert'} message={chapters.length ? 'Ändern Sie die Suchbegriffe oder den Statusfilter.' : 'Im QM-Handbuch sind noch keine Kapitel hinterlegt. Im Vorlagenbereich finden Sie vorhandene Vorlagen für Prozesse und Arbeitsanweisungen.'}>{!chapters.length ? templates : null}</QmDocumentState>}
      </section>
    </>}
  </QmSectionShell>;
}
