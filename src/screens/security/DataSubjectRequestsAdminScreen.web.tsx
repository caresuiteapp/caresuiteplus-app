import { useCallback, useEffect, useRef, useState } from 'react';
import { ScreenShell } from '@/components/layout/ScreenShell';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { DATA_REQUEST_TYPE_LABELS, DATA_SUBJECT_REQUEST_STATUS_LABELS } from '@/lib/privacy/dataSubjectRequestLabels';
import {
  downloadDataRequestAdminCsv, listDataRequestsForAdmin, prepareDataRequestAdminCsv, updateDataRequestForAdmin,
  type DataRequestAdminAccess, type DataRequestAdminScope,
} from '@/lib/privacy/dataSubjectRequestAdminWeb.web';
import type { DataSubjectRequest, DataSubjectRequestStatus } from '@/lib/privacy/dataSubjectRequest.types';

const STATUSES: DataSubjectRequestStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled'];
const CSS = `
.cs-dsr-admin{--dsr-ink:#24334b;--dsr-muted:#566579;--dsr-line:#dce4ee;--dsr-orange:#ae4a0b;container-type:inline-size;color:var(--dsr-ink);width:100%;min-width:0;max-width:1280px;margin:0 auto;padding:4px 0 24px;font-family:inherit;font-size:1rem;line-height:1.55}
.cs-dsr-admin *{box-sizing:border-box}
.cs-dsr-admin button,.cs-dsr-admin input,.cs-dsr-admin select{font:inherit}
.cs-dsr-admin button{min-height:44px;border:1px solid var(--dsr-line);border-radius:12px;padding:9px 15px;background:#fff;color:var(--dsr-ink);font-weight:650;cursor:pointer;transition:border-color .16s,box-shadow .16s,background .16s}
.cs-dsr-admin button:hover:not(:disabled){border-color:#e69e66;background:#fff8f1;box-shadow:0 4px 14px #a35b1520}
.cs-dsr-admin button:disabled{opacity:.55;cursor:default}
.cs-dsr-admin button:focus-visible,.cs-dsr-admin input:focus-visible,.cs-dsr-admin select:focus-visible,.cs-dsr-admin summary:focus-visible{outline:3px solid #bd5a13;outline-offset:3px}
.cs-dsr-admin h2,.cs-dsr-admin h3,.cs-dsr-admin p{margin:0}
.cs-dsr-admin h2{font-size:1.3rem;line-height:1.3;font-weight:750}
.cs-dsr-admin h3{font-size:1.05rem}
.cs-dsr-admin header{display:flex;flex-wrap:wrap;align-items:center;gap:16px;background:linear-gradient(120deg,#fff8ee,#fff 70%);border:1px solid #eadfce;border-radius:22px;padding:24px;box-shadow:0 8px 26px #24334b08}
.cs-dsr-admin-icon{display:grid;place-items:center;width:54px;height:54px;flex:0 0 54px;border-radius:17px;background:#ffe5c9;color:#aa4c0e}
.cs-dsr-admin header>div:nth-child(2){flex:1 1 260px;min-width:0}
.cs-dsr-admin header p{color:var(--dsr-muted);margin-top:5px;max-width:64ch}
.cs-dsr-admin-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:20px 0 12px}
.cs-dsr-admin-toolbar label{display:grid;gap:6px;font-size:.9rem;font-weight:650;flex:1 1 220px;min-width:0}
.cs-dsr-admin input,.cs-dsr-admin select{min-height:44px;width:100%;min-width:0;border:1px solid #bccadb;border-radius:11px;padding:9px 12px;color:var(--dsr-ink);background:#fff}
.cs-dsr-admin-meta{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0;color:var(--dsr-muted);font-size:.9rem}
.cs-dsr-admin-notice{padding:14px 18px;margin:14px 0;border-radius:13px;background:#edf5fc;border:1px solid #cbdff0;color:#244c72;overflow-wrap:anywhere}
.cs-dsr-admin-notice[data-kind=error]{background:#fff0f0;border-color:#edc1c1;color:#902a31}
.cs-dsr-admin-notice[data-kind=success]{background:#edf8f0;border-color:#badbc5;color:#22663d}
.cs-dsr-admin-list{display:grid;gap:12px}
.cs-dsr-admin-request{border:1px solid var(--dsr-line);border-radius:17px;background:#fff;box-shadow:0 3px 13px #24334b05;overflow:hidden}
.cs-dsr-admin-request summary{cursor:pointer;display:flex;flex-wrap:wrap;gap:12px;padding:18px 20px;align-items:center;list-style:none;min-height:68px}
.cs-dsr-admin-request summary::-webkit-details-marker{display:none}
.cs-dsr-admin-request summary::after{content:'+';font-size:1.3rem;color:var(--dsr-muted)}
.cs-dsr-admin-request[open] summary::after{content:'−'}
.cs-dsr-admin-request summary>div{flex:1 1 200px;min-width:0}
.cs-dsr-admin-request summary strong{display:block;overflow-wrap:anywhere;font-size:1rem}
.cs-dsr-admin-request summary small{color:var(--dsr-muted);font-size:.88rem}
.cs-dsr-admin-badge{display:inline-flex;align-items:center;gap:7px;background:#fff0d7;color:#805000;border:1px solid #eecb8b;border-radius:999px;padding:4px 11px;font-size:.84rem;font-weight:700}
.cs-dsr-admin-badge::before{content:'';height:7px;width:7px;border-radius:50%;background:currentColor}
.cs-dsr-admin-badge[data-status=running]{background:#e8f3fc;color:#205b87;border-color:#b9d7ee}
.cs-dsr-admin-badge[data-status=completed]{background:#eaf6ed;color:#24653b;border-color:#b8d8c2}
.cs-dsr-admin-badge[data-status=failed]{background:#fff0f0;color:#9e2c33;border-color:#e9bbc0}
.cs-dsr-admin-badge[data-status=cancelled]{background:#f1f3f6;color:#576475;border-color:#d4dbe4}
.cs-dsr-admin-detail{border-top:1px solid #e8edf3;padding:18px 20px;display:grid;gap:16px}
.cs-dsr-admin-detail dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:14px 24px;margin:0}
.cs-dsr-admin-detail dt{color:var(--dsr-muted);font-size:.85rem}
.cs-dsr-admin-detail dd{margin:3px 0 0;overflow-wrap:anywhere}
.cs-dsr-admin-notes{background:#f6f8fb;border-radius:10px;padding:12px 15px;white-space:pre-wrap;overflow-wrap:anywhere}
.cs-dsr-admin-notes strong{display:block;font-size:.85rem;color:var(--dsr-muted);margin-bottom:4px}
.cs-dsr-admin-status{display:flex;flex-wrap:wrap;gap:10px;align-items:end}
.cs-dsr-admin-status label{display:grid;gap:5px;font-size:.9rem;font-weight:650;flex:1 1 230px;max-width:380px}
.cs-dsr-admin button[data-primary=true]{background:#b4500c;border-color:#b4500c;color:white}
.cs-dsr-admin button[data-primary=true]:hover:not(:disabled){background:#953f08;color:white}
.cs-dsr-admin-footnote{font-size:.88rem;color:var(--dsr-muted)}
.cs-dsr-admin-empty{text-align:center;border:1px dashed #c9d4e0;background:#fff;border-radius:17px;padding:32px 20px}
.cs-dsr-admin-empty p{color:var(--dsr-muted);margin-top:8px}
.cs-dsr-admin-more{display:flex;justify-content:center;margin:18px 0}
@container(max-width:540px){.cs-dsr-admin header{padding:18px}.cs-dsr-admin-request summary,.cs-dsr-admin-detail{padding:16px}.cs-dsr-admin-toolbar{align-items:stretch}.cs-dsr-admin-toolbar button{flex:1 1 160px}.cs-dsr-admin-status button{width:100%}.cs-dsr-admin-status label{max-width:none}.cs-dsr-admin-badge{max-width:100%;white-space:normal}}
@media(prefers-reduced-motion:reduce){.cs-dsr-admin button{transition:none}}
`;

function date(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Nicht hinterlegt';
  return new Date(value).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}
function RequestCard({ item, canManage, disabled, saving, onSave }: {
  item: DataSubjectRequest; canManage: boolean; disabled: boolean; saving: boolean;
  onSave: (item: DataSubjectRequest, status: DataSubjectRequestStatus) => void;
}) {
  const [status, setStatus] = useState(item.status);
  useEffect(() => { setStatus(item.status); }, [item.status, item.updatedAt]);
  return <details className="cs-dsr-admin-request">
    <summary><div><strong>{item.requestNumber || item.id.slice(0, 8).toUpperCase()} · {DATA_REQUEST_TYPE_LABELS[item.requestType]}</strong>
      <small>{item.requesterName || 'Name nicht hinterlegt'} · {date(item.receivedAt ?? item.createdAt)}</small></div>
      <span className="cs-dsr-admin-badge" data-status={item.status}>{DATA_SUBJECT_REQUEST_STATUS_LABELS[item.status]}</span>
    </summary>
    <div className="cs-dsr-admin-detail">
      <dl><div><dt>Anfragende Person</dt><dd>{item.requesterName || 'Nicht hinterlegt'}</dd></div>
        <div><dt>Kontaktadresse</dt><dd>{item.requesterEmail || 'Nicht hinterlegt'}</dd></div>
        <div><dt>Eingang</dt><dd>{date(item.receivedAt ?? item.createdAt)}</dd></div>
        <div><dt>Zuletzt geändert</dt><dd>{date(item.updatedAt)}</dd></div></dl>
      {item.verificationNotes ? <div className="cs-dsr-admin-notes"><strong>Hinweise zur Anfrage</strong>{item.verificationNotes}</div> : null}
      {canManage ? <form className="cs-dsr-admin-status" onSubmit={event => { event.preventDefault(); if (!disabled && status !== item.status) onSave(item, status); }}>
        <label>Status für {item.requestNumber || item.id.slice(0, 8).toUpperCase()}
          <select value={status} disabled={disabled} onChange={event => setStatus(event.target.value as DataSubjectRequestStatus)}>
            {STATUSES.map(value => <option key={value} value={value}>{DATA_SUBJECT_REQUEST_STATUS_LABELS[value]}</option>)}
          </select></label>
        <button type="submit" data-primary="true" disabled={disabled || status === item.status}>{saving ? 'Wird gespeichert…' : 'Status speichern'}</button>
      </form> : <p className="cs-dsr-admin-footnote">Sie können diese Anfrage einsehen. Für Statusänderungen ist eine weitere Berechtigung erforderlich.</p>}
      <p className="cs-dsr-admin-footnote">Der Status dokumentiert die Bearbeitung. Eine Statusänderung verschickt keine Antwort und stellt keine Auskunftsdatei bereit.</p>
    </div>
  </details>;
}

function AdminWorkspace({ scope }: { scope: DataRequestAdminScope }) {
  const [items, setItems] = useState<DataSubjectRequest[]>([]);
  const [access, setAccess] = useState<DataRequestAdminAccess>({ view: false, manage: false });
  const [operation, setOperation] = useState<'load' | 'more' | 'export' | 'update' | null>('load');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DataSubjectRequestStatus | 'all'>('all');
  const alive = useRef(true);
  const active = useRef<object | null>(null);
  const current = useRef({ items, offset, access });
  current.current = { items, offset, access };
  const { authUserId, tenantId, profileId } = scope;

  const load = useCallback(async (more = false) => {
    if (active.current) return;
    const token = {}; active.current = token; setOperation(more ? 'more' : 'load'); setError(null); setMessage(null);
    try {
      const result = await listDataRequestsForAdmin({ authUserId, tenantId, profileId }, more ? current.current.offset : 0);
      if (!alive.current || active.current !== token) return;
      if (!result.ok) { setError(result.error); setItems([]); setAccess({ view: false, manage: false }); setHasMore(false); return; }
      setItems(previous => more ? [...new Map([...previous, ...result.data.items].map(item => [item.id, item])).values()] : result.data.items);
      setAccess(result.data.access); setHasMore(result.data.hasMore); setOffset(result.data.nextOffset);
    } catch { if (alive.current && active.current === token) setError('Die Liste konnte nicht geladen werden. Bitte versuchen Sie es erneut.'); }
    finally { if (alive.current && active.current === token) { active.current = null; setOperation(null); } }
  }, [authUserId, tenantId, profileId]);

  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; active.current = null; }; }, [load]);

  async function save(item: DataSubjectRequest, status: DataSubjectRequestStatus) {
    if (active.current || !current.current.access.manage || status === item.status) return;
    if ((status === 'completed' || status === 'cancelled') && !window.confirm(status === 'completed'
      ? 'Bearbeitung als abgeschlossen kennzeichnen? Bitte bestätigen Sie dies erst, wenn die Anfrage tatsächlich bearbeitet und die erforderliche Antwort bereitgestellt wurde.'
      : 'Bearbeitung als abgebrochen kennzeichnen? Die anfragende Person sieht diesen Status.')) return;
    const token = {}; active.current = token; setOperation('update'); setUpdatingId(item.id); setError(null); setMessage(null);
    try {
      const result = await updateDataRequestForAdmin(scope, item, status);
      if (!alive.current || active.current !== token) return;
      if (!result.ok) { setError(result.error); setItems([]); setAccess({ view: false, manage: false }); setHasMore(false); return; }
      setItems(previous => previous.map(row => row.id === result.data.id ? result.data : row));
      setMessage('Der Status wurde gespeichert.');
    } catch { if (alive.current && active.current === token) setError('Der Status konnte nicht bestätigt werden. Bitte aktualisieren Sie die Liste.'); }
    finally { if (alive.current && active.current === token) { active.current = null; setOperation(null); setUpdatingId(null); } }
  }

  async function exportCsv() {
    if (active.current || !current.current.access.view || current.current.items.length === 0) return;
    const token = {}; active.current = token; setOperation('export'); setError(null); setMessage(null);
    try {
      const result = await prepareDataRequestAdminCsv(scope, current.current.items);
      if (!alive.current || active.current !== token) return;
      if (!result.ok) { setError(result.error); setItems([]); setAccess({ view: false, manage: false }); setHasMore(false); return; }
      downloadDataRequestAdminCsv(result.data.csv);
      setMessage('CSV-Download gestartet: ' + result.data.rowCount + ' geladene Anfragen.');
    } catch { if (alive.current && active.current === token) setError('Der CSV-Download konnte nicht gestartet werden. Bitte versuchen Sie es erneut.'); }
    finally { if (alive.current && active.current === token) { active.current = null; setOperation(null); } }
  }

  const needle = search.trim().toLocaleLowerCase('de-DE');
  const visible = items.filter(item => (filter === 'all' || item.status === filter) &&
    (!needle || [item.requestNumber, item.id, item.requesterName, item.requesterEmail, DATA_REQUEST_TYPE_LABELS[item.requestType]]
      .some(value => value?.toLocaleLowerCase('de-DE').includes(needle))));
  const open = items.filter(item => item.status === 'queued' || item.status === 'running' || item.status === 'failed').length;
  const busy = operation !== null;
  return <>
    <header><div className="cs-dsr-admin-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg></div>
      <div><h2>Anfragen im Blick behalten</h2><p>Auskunft, Berichtigung und weitere Betroffenenanfragen Ihres Unternehmens prüfen und den Bearbeitungsstand dokumentieren.</p></div>
      <button type="button" disabled={busy} onClick={() => void load()}> {operation === 'load' ? 'Wird geladen…' : 'Aktualisieren'}</button>
    </header>
    <div className="cs-dsr-admin-notice"><strong>Regelfrist: ein Monat ab Eingang</strong><p>Eine erforderliche Verlängerung muss innerhalb dieses Monats mit Begründung mitgeteilt werden. Prüfen Sie die Frist für die jeweilige Anfrage.</p></div>
    {error ? <p role="alert" className="cs-dsr-admin-notice" data-kind="error">{error}</p> : null}
    {message ? <p role="status" className="cs-dsr-admin-notice" data-kind="success">{message}</p> : null}
    <div className="cs-dsr-admin-toolbar">
      <label>Geladene Anfragen durchsuchen<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, E-Mail oder Anfragenummer" /></label>
      <label>Status filtern<select value={filter} onChange={event => setFilter(event.target.value as DataSubjectRequestStatus | 'all')}>
        <option value="all">Alle Status</option>{STATUSES.map(status => <option key={status} value={status}>{DATA_SUBJECT_REQUEST_STATUS_LABELS[status]}</option>)}
      </select></label>
      <button type="button" disabled={busy || !access.view || items.length === 0} onClick={() => void exportCsv()}>{operation === 'export' ? 'Wird vorbereitet…' : 'Geladene Anfragen (CSV)'}</button>
    </div>
    <div className="cs-dsr-admin-meta"><span>{items.length} geladen · {open} offen einschließlich fehlgeschlagener Bearbeitungen · {visible.length} angezeigt</span></div>
    <p className="cs-dsr-admin-footnote">Die CSV enthält die geladenen Anfragen mit Nummer, Art, Status, Kontakt und Zeitangaben. Hinweise zur Anfrage sind nicht enthalten. Such- und Statusfilter ändern den Download nicht.</p>
    {operation === 'load' && items.length === 0 ? <p role="status" className="cs-dsr-admin-notice">Betroffenenanfragen werden geladen…</p> : null}
    <div className="cs-dsr-admin-list" aria-busy={busy}>
      {visible.map(item => <RequestCard key={item.id} item={item} disabled={busy} saving={updatingId === item.id}
        canManage={access.manage} onSave={(row, status) => void save(row, status)} />)}
      {!busy && !error && visible.length === 0 ? <div className="cs-dsr-admin-empty"><h3>{items.length ? 'Keine passenden Anfragen' : 'Noch keine Betroffenenanfragen'}</h3>
        <p>{items.length ? 'Ändern Sie die Suche oder den Statusfilter.' : 'Eingereichte Anfragen erscheinen hier mit ihrem Bearbeitungsstand.'}</p></div> : null}
    </div>
    {hasMore ? <div className="cs-dsr-admin-more"><button type="button" disabled={busy} onClick={() => void load(true)}>{operation === 'more' ? 'Wird geladen…' : 'Weitere Anfragen laden'}</button></div> : null}
  </>;
}

export function DataSubjectRequestsAdminScreen() {
  const auth = useAuth();
  const portal = Boolean(auth.portalSession) || [auth.profile?.roleKey, auth.user?.roleKey].some(role => role ? isPortalOnlyRole(role) : false);
  const loading = auth.isLoading || !auth.authReady;
  const ready = auth.authMode === 'supabase' && auth.isAuthenticated && auth.user && auth.profile?.tenantId && auth.profile.id &&
    auth.session?.user.id === auth.user.id && Boolean(auth.session.accessToken);
  const identity = [auth.authMode, auth.user?.id, auth.profile?.id, auth.profile?.tenantId, auth.profile?.roleKey].join(':');
  return <ScreenShell title="Betroffenenanfragen" subtitle="Anfragen prüfen und Bearbeitungsstände dokumentieren" showBack>
    <section className="cs-dsr-admin" aria-label="Verwaltung der Betroffenenanfragen"><style>{CSS}</style>
      {loading ? <p role="status" className="cs-dsr-admin-notice">Ihr Zugang wird geprüft…</p> :
        !ready ? <p role="alert" className="cs-dsr-admin-notice" data-kind="error">Für die Bearbeitung ist ein angemeldetes Verwaltungskonto erforderlich.</p> :
        portal ? <p role="alert" className="cs-dsr-admin-notice" data-kind="error">Sie haben keine Berechtigung, Betroffenenanfragen des Unternehmens einzusehen.</p> :
        <AdminWorkspace key={identity} scope={{ authUserId: auth.user!.id, profileId: auth.profile!.id, tenantId: auth.profile!.tenantId! }} />}
    </section>
  </ScreenShell>;
}
