import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { QmSectionShell } from '@/components/qm/QmSectionShell.web';
import { useQmTenantQuery } from '@/hooks/qm/useQmBase.web';
import { fetchQmRegister } from '@/lib/qm/qmRegisterService.web';
import { filterQmRegister, qmRegisterDate, QM_REGISTER_LABELS, type QmRegisterKind } from '@/lib/qm/qmRegisterDomain.web';

export const QM_REGISTER_SCREEN_CONFIG: Record<QmRegisterKind, { title: string; subtitle: string; empty: string; dateLabel: string; ownerLabel: string; note: string }> = {
  audits: { title: 'Audits', subtitle: 'Geplante Prüfungen, Ergebnisse und anstehende Nacharbeit im Überblick.', empty: 'Noch keine Audits erfasst', dateLabel: 'Prüftermin', ownerLabel: 'Prüfer:in', note: 'Gespeicherte Audits können hier geprüft werden. Das Anlegen und Abschließen von Audits ist noch nicht freigeschaltet.' },
  measures: { title: 'Maßnahmen', subtitle: 'Gespeicherte Maßnahmen mit Zuständigkeiten, Fristen und Status.', empty: 'Noch keine Maßnahmen erfasst', dateLabel: 'Frist', ownerLabel: 'Verantwortlich', note: 'Diese Übersicht zeigt das Maßnahmenregister. Neue Maßnahmen und Änderungen an diesem Register sind noch nicht freigeschaltet.' },
  compliance: { title: 'Compliance', subtitle: 'Anforderungen, Fristen und zugeordnete Nachweisdokumente.', empty: 'Noch keine Anforderungen erfasst', dateLabel: 'Frist', ownerLabel: 'Verantwortung', note: 'Die Übersicht gibt den gespeicherten Bearbeitungsstand wieder. Das Bearbeiten und Freigeben von Anforderungen ist noch nicht freigeschaltet.' },
  changes: { title: 'Änderungen', subtitle: 'Dokumentierte Korrekturen, Verbesserungen und ihre Bearbeitungsstände.', empty: 'Noch keine Änderungen erfasst', dateLabel: 'Erfasst am', ownerLabel: 'Angefragt von', note: 'Vorhandene Änderungsvorgänge sind einsehbar. Das Anlegen und Bearbeiten ist noch nicht freigeschaltet.' },
  legal: { title: 'Rechtsgrundlagen', subtitle: 'Hinterlegte Referenzen und ihre zugeordneten Dokumente.', empty: 'Noch keine Rechtsgrundlagen hinterlegt', dateLabel: 'Gültig ab', ownerLabel: 'Quelle', note: 'Die Einträge zeigen gespeicherte Referenzen. Eine automatische Prüfung ihrer Aktualität ist nicht eingerichtet.' },
  md: { title: 'MD-Prüfung', subtitle: 'Gespeicherte Prüfungsmappen und zugehörige Dokumentreferenzen.', empty: 'Noch keine Prüfungsmappen erfasst', dateLabel: 'Erstellt am', ownerLabel: 'Freigabe gespeichert durch', note: 'Vorhandene Mappen und ihre Inhalte sind lesbar. Erstellen, Freigeben, Exportieren und externe Zugriffslinks sind noch nicht freigeschaltet.' },
};

export function QmRegisterScreen({ kind }: { kind: QmRegisterKind }) {
  const router = useRouter();
  const config = QM_REGISTER_SCREEN_CONFIG[kind];
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const query = useQmTenantQuery((tenantId, roleKey) => fetchQmRegister(kind, tenantId, roleKey), [kind]);
  const entries = query.data ?? [];
  const items = useMemo(() => filterQmRegister(entries, search, status), [entries, search, status]);
  const statuses = useMemo(() => [...new Set(entries.map(entry => entry.status).filter(Boolean))].sort(), [entries]);
  const retry = <button type="button" className="qm-button" disabled={query.loading || query.refreshing} onClick={() => void query.refresh()}>{query.loading || query.refreshing ? 'Wird aktualisiert…' : 'Aktualisieren'}</button>;

  return <QmSectionShell title={config.title} subtitle={config.subtitle} actions={retry}>
    <style>{qmRegisterCss}</style>
    <>
      <div className="qm-notice" role="note">{config.note}</div>
      {query.error ? <div className="qm-notice" data-tone="error" role="alert"><strong>Daten konnten nicht geladen werden.</strong><p>{query.error}</p>{retry}</div> : null}
      {query.refreshError ? <div className="qm-notice" data-tone="warning" role="alert"><strong>Aktualisieren nicht möglich.</strong><p>{query.refreshError} Die bisher geladenen Einträge werden weiterhin angezeigt.</p>{retry}</div> : null}
      {query.loading && query.data === null ? <div className="qm-empty" role="status">{config.title} werden geladen…</div> : null}
      {query.data !== null ? <>
        <section className="qm-panel qm-register-toolbar" aria-label={`${config.title} filtern`}>
          <label className="qm-register-field"><span>Suchen</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Titel, Zuständigkeit oder Inhalt" /></label>
          {statuses.length ? <label className="qm-register-field qm-register-status"><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Alle Status</option>{statuses.map(value => <option key={value} value={value}>{QM_REGISTER_LABELS[value] ?? value}</option>)}</select></label> : null}
          {(search || status !== 'all') ? <button className="qm-button" type="button" onClick={() => { setSearch(''); setStatus('all'); }}>Filter zurücksetzen</button> : null}
          <p className="qm-register-count" role="status">{items.length} von {entries.length} Einträgen</p>
        </section>
        {items.length === 0 ? <div className="qm-panel qm-empty"><h2>{entries.length ? 'Keine passenden Einträge' : config.empty}</h2><p>{entries.length ? 'Passe die Suche oder den Statusfilter an.' : 'Für diesen Mandanten wurden in diesem Register keine Einträge geliefert.'}</p></div> : <div className="qm-register-list">{items.map(entry => <article className="qm-panel qm-register-entry" key={entry.id}>
          <header className="qm-register-entry-header"><div>{entry.category ? <span className="qm-eyebrow">{QM_REGISTER_LABELS[entry.category] ?? entry.category}</span> : null}<h2>{entry.title}</h2></div>{entry.status ? <span className="qm-status" data-tone={entry.status === 'overdue' ? 'warning' : 'neutral'}>{QM_REGISTER_LABELS[entry.status] ?? entry.status}</span> : null}</header>
          <dl className="qm-register-meta"><div><dt>{config.dateLabel}</dt><dd>{qmRegisterDate(entry.date)}</dd></div><div><dt>{config.ownerLabel}</dt><dd>{entry.owner}</dd></div></dl>
          <details className="qm-register-details"><summary>Details ansehen</summary><div>{entry.summary ? <p className="qm-register-copy">{entry.summary}</p> : <p className="qm-register-copy qm-register-muted">Keine weiteren Angaben hinterlegt.</p>}{entry.details.length ? <dl className="qm-register-meta">{entry.details.map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl> : null}{entry.documentIds.length ? <nav className="qm-actions" aria-label="Zugeordnete Dokumente">{entry.documentIds.map((id, index) => <button key={id} type="button" className="qm-button" onClick={() => router.push(`/business/office/qm/documents/${encodeURIComponent(id)}` as never)}>Dokument {index + 1} öffnen</button>)}</nav> : null}</div></details>
          {kind === 'md' ? <button type="button" className="qm-button qm-button--primary" onClick={() => router.push(`/business/office/qm/md-audit/${encodeURIComponent(entry.id)}` as never)}>Mappeninhalt ansehen</button> : null}
        </article>)}</div>}
      </> : null}
    </>
  </QmSectionShell>;
}

export const qmRegisterCss = `
  .qm-workspace .qm-register-toolbar{display:flex;align-items:end;gap:14px;flex-wrap:wrap;padding:20px}
  .qm-workspace .qm-register-field{display:grid;gap:7px;flex:1 1 260px;color:var(--qm-ink);font-size:calc(13px * var(--app-font-scale,1));font-weight:700;min-width:0}
  .qm-workspace .qm-register-field input,.qm-workspace .qm-register-field select{width:100%;min-width:0;border:1px solid #b9cde0;border-radius:12px;background:#fff;padding:12px 14px;color:var(--qm-ink);font:inherit;font-size:calc(15px * var(--app-font-scale,1));font-weight:400;box-sizing:border-box}
  .qm-workspace .qm-register-field input:focus-visible,.qm-workspace .qm-register-field select:focus-visible,.qm-workspace .qm-register-details summary:focus-visible{outline:3px solid #079ad5;outline-offset:3px}
  .qm-workspace .qm-register-status{flex:0 1 230px}.qm-workspace .qm-register-count{margin:0;padding-bottom:10px;font-size:calc(13px * var(--app-font-scale,1));color:var(--qm-muted)}
  .qm-workspace .qm-register-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:16px}
  .qm-workspace .qm-register-entry{padding:22px;min-width:0;display:flex;flex-direction:column;gap:18px;align-self:start}
  .qm-workspace .qm-register-entry-header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
  .qm-workspace .qm-register-entry h2{font-size:calc(19px * var(--app-font-scale,1));line-height:1.4;margin:5px 0 0;color:var(--qm-ink);overflow-wrap:anywhere}
  .qm-workspace .qm-register-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:16px;margin:0}
  .qm-workspace .qm-register-meta dt{font-size:calc(12px * var(--app-font-scale,1));line-height:1.4;color:var(--qm-muted);margin-bottom:5px}.qm-workspace .qm-register-meta dd{font-size:calc(14px * var(--app-font-scale,1));line-height:1.6;color:var(--qm-ink);margin:0;overflow-wrap:anywhere}
  .qm-workspace .qm-register-details{border-top:1px solid var(--qm-border);padding-top:14px}.qm-workspace .qm-register-details summary{cursor:pointer;color:#075bbf;font-weight:700;font-size:calc(14px * var(--app-font-scale,1));padding:3px 0}.qm-workspace .qm-register-details>div{display:grid;gap:18px;padding-top:14px}
  .qm-workspace .qm-register-copy{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;color:var(--qm-ink)}.qm-workspace .qm-register-muted{color:var(--qm-muted)}
  .qm-workspace .qm-register-entry .qm-button{align-self:flex-start}.qm-workspace .qm-notice p{margin:7px 0;line-height:1.6}
  @container(max-width:640px){.qm-workspace .qm-register-toolbar,.qm-workspace .qm-register-entry{padding:17px}.qm-workspace .qm-register-status{flex:1 1 100%}}
`;
