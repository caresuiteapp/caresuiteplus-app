import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ConsoleBadge, ConsoleDialog, ConsolePanel, ConsoleStats, ConsoleStyle } from '@/components/platformConsole/ConsoleWorkspaceUi.web';
import { consoleDate, consoleLabel } from '@/lib/platformConsole/consoleWorkspaceModel';
import { platformActionLabel } from '@/lib/platformConsole/platformLanguage';
import { getTenantDossier, getTenantDossierPage, type DossierQuery } from '@/lib/platformConsole/tenantDossierService.web';
import { buildTenantSetup, dossierChangedFields, dossierFieldLabel, dossierPersonCompleteness, dossierRowName, safeDossierLogo, visibleDossierFields, type DossierPage, type DossierRow, type DossierScope, type TenantDossier } from '@/lib/platformConsole/tenantDossierModel';

export const TENANT_DOSSIER_CSS = `
.cs-dossier{container-type:inline-size;min-width:0;width:100%;gap:20px}.cs-dossier h4{margin:0;font-size:16px;line-height:1.5}.cs-dossier p{margin:0;line-height:1.6}.cs-dossier small{line-height:1.55}.cs-dossier-header{display:grid;grid-template-columns:86px minmax(0,1fr) minmax(180px,240px);align-items:center;gap:22px;padding:25px;border:1px solid #c4d9f6;border-radius:21px;background:linear-gradient(120deg,#fff,#edf5ff)}.cs-dossier-logo{width:86px;height:86px;background:#fff;border:1px solid #d4e1f2;border-radius:18px;display:flex;align-items:center;justify-content:center;padding:10px;overflow:hidden;flex-shrink:0}.cs-dossier-logo img{max-width:100%;max-height:100%;object-fit:contain}.cs-dossier-logo span{font-size:29px;font-weight:800;color:#075dd5}.cs-dossier-heading{min-width:0}.cs-dossier-heading h3{font-size:23px;line-height:1.3;margin:5px 0 8px;overflow-wrap:anywhere}.cs-dossier-meter strong{font-size:32px;line-height:1.4;letter-spacing:-1px}.cs-dossier-meter small{display:block}.cs-dossier-progress{height:8px;overflow:hidden;background:#dce8f7;border-radius:30px;margin:8px 0}.cs-dossier-progress>span{display:block;height:100%;background:linear-gradient(90deg,#075dd5,#49a4f4);border-radius:30px}.cs-dossier-shortcuts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:14px}.cs-dossier-shortcut{display:flex;align-items:center;gap:13px;padding:18px;border:1px solid #cdddf1;border-radius:14px;background:#fff;color:#193657;text-align:left;font-weight:700;min-width:0}.cs-dossier-shortcut:hover{background:#f0f6ff}.cs-dossier-shortcut svg{width:30px;height:30px;color:#075dd5;flex-shrink:0}.cs-dossier-shortcut small{display:block;font-size:12px;font-weight:400;color:#586e88;margin-top:3px}.cs-dossier-group{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:12px}.cs-dossier-group>div{padding:15px;background:#f6f9fe;border:1px solid #d4e1f2;border-radius:13px}.cs-dossier-group strong{font-size:21px}.cs-dossier-step{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:14px;align-items:start;padding:18px 0;border-bottom:1px solid #e1eaf6}.cs-dossier-step:last-child{border-bottom:0}.cs-dossier-step-icon{width:30px;height:30px;border-radius:9px;background:#edf3fd;display:grid;place-items:center;color:#3d658b;font-size:16px;font-weight:800}.cs-dossier-step-icon.complete{background:#e5f6ed;color:#146443}.cs-dossier-step-icon.open{background:#fff2d9;color:#8b5714}.cs-dossier-step p{font-size:14px;color:#526984;margin:5px 0}.cs-dossier-step ul{padding-left:20px;margin:7px 0;font-size:13px;color:#825115}.cs-dossier-field-tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.cs-dossier-field-tools input[type=checkbox],.cs-dossier-check input{width:18px;min-height:18px;margin:0;accent-color:#075dd5}.cs-dossier-check{display:flex;gap:9px;align-items:center;font-size:13px}.cs-dossier-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0}.cs-dossier-fields>div{padding:14px 16px;border:1px solid #e0e8f3;border-radius:11px;background:#fbfdff;min-width:0}.cs-dossier-fields dt{font-size:12px;font-weight:700;color:#526984;margin-bottom:6px}.cs-dossier-fields dd{margin:0;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}.cs-dossier-fields details{max-width:100%}.cs-dossier-fields summary{cursor:pointer;color:#075dd5;font-weight:700}.cs-dossier-nested{margin:10px 0 0;padding:0 0 0 12px;border-left:2px solid #d7e5f8}.cs-dossier-nested dt{margin-top:9px}.cs-dossier-nested dd{margin:3px 0 0}.cs-dossier-empty-value{color:#8492a5;font-size:13px}.cs-dossier-person-cards{display:none;padding:16px;gap:12px}.cs-dossier-person-card{padding:17px;border:1px solid #d7e4f4;border-radius:13px;min-width:0}.cs-dossier-person-card strong{display:block;overflow-wrap:anywhere;line-height:1.5}.cs-dossier-person-card .cs-actions{margin-top:12px}.cs-dossier-event{padding:19px 22px;border-bottom:1px solid #e4ecf6}.cs-dossier-event:last-child{border-bottom:0}.cs-dossier-event header{display:flex;gap:15px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.cs-dossier-event h4{margin:5px 0}.cs-dossier-event p{font-size:14px;color:#526984;margin:9px 0}.cs-dossier-event details{margin-top:12px}.cs-dossier-event summary{color:#075dd5;cursor:pointer;font-size:14px;font-weight:700}.cs-dossier-change{display:grid;grid-template-columns:minmax(100px,1fr) minmax(0,2fr) minmax(0,2fr);gap:12px;padding:12px 0;border-top:1px solid #e4ecf6;font-size:13px;overflow-wrap:anywhere}.cs-dossier-change-label{color:#526984;font-weight:700}.cs-dossier-inventory{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,225px),1fr));gap:12px}.cs-dossier-inventory button{display:flex;align-items:start;justify-content:space-between;gap:12px;text-align:left;border:1px solid #d6e3f4;border-radius:12px;background:#f9fbff;color:#24476e;padding:15px;min-width:0}.cs-dossier-inventory strong{font-size:14px;line-height:1.5}.cs-dossier-inventory span{font-size:21px;font-weight:800;white-space:nowrap}.cs-dossier-inventory small{display:block;margin-top:5px;font-size:11px}.cs-dossier-inventory button:disabled{cursor:default;opacity:.6}.cs-dossier-source{font-size:12px;color:#637c9d}.cs-dossier-data-title{display:flex;gap:10px;align-items:center}.cs-dossier-data-title svg{height:25px;width:25px;color:#075dd5}.cs-dossier-loading{padding:24px}.cs-dossier a{color:#075dd5}.cs-dossier button:focus-visible,.cs-dossier summary:focus-visible{outline:3px solid #8db6f1;outline-offset:3px}
@container(max-width:780px){.cs-dossier-header{grid-template-columns:64px minmax(0,1fr);gap:16px;padding:20px}.cs-dossier-logo{width:64px;height:64px;border-radius:13px}.cs-dossier-meter{grid-column:1/-1;display:grid;grid-template-columns:80px 1fr;gap:0 15px;align-items:center}.cs-dossier-meter strong{grid-row:1/3}.cs-dossier-heading h3{font-size:20px}.cs-dossier-fields{grid-template-columns:1fr}.cs-dossier-step{grid-template-columns:30px minmax(0,1fr)}.cs-dossier-step>.cs-btn{grid-column:2;justify-self:start}.cs-dossier-table{display:none}.cs-dossier-person-cards{display:grid}.cs-dossier-change{grid-template-columns:1fr}.cs-dossier-change-label{margin-bottom:3px}}
@media(max-width:680px){.cs-dossier-header{grid-template-columns:64px minmax(0,1fr);padding:18px}.cs-dossier-logo{width:64px;height:64px}.cs-dossier-meter{grid-column:1/-1}.cs-dossier-fields{grid-template-columns:1fr}.cs-dossier-table{display:none}.cs-dossier-person-cards{display:grid}.cs-dossier-step{grid-template-columns:30px minmax(0,1fr)}.cs-dossier-step>.cs-btn{grid-column:2;justify-self:start}.cs-dossier-change{grid-template-columns:1fr}}
`;

export function TenantDossierStyle() { return <><ConsoleStyle /><style>{TENANT_DOSSIER_CSS}</style></>; }
export type DossierView = 'overview' | 'company' | 'clients' | 'employees' | 'setup' | 'history';
type OpenView = (view: DossierView) => void;

export function useTenantDossier(tenantId: string, enabled: boolean, revision: unknown) {
  const [state, setState] = useState<{ data: TenantDossier | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: false });
  const [retry, setRetry] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const current = ++request.current;
    setState({ data: null, error: null, loading: enabled });
    if (!enabled) return;
    void getTenantDossier(tenantId).then(result => {
      if (current !== request.current) return;
      setState(result.ok ? { data: result.data, error: null, loading: false } : { data: null, error: result.error, loading: false });
    }).catch(error => { if (current === request.current) setState({ data: null, loading: false, error: error instanceof Error ? error.message : 'Die Mandantenakte konnte nicht geladen werden.' }); });
    return () => { request.current++; };
  }, [tenantId, enabled, revision, retry]);
  return { ...state, data: enabled && state.data?.tenantId === tenantId ? state.data : null, reload: () => setRetry(value => value + 1) };
}

function Icon({ kind }: { kind: 'people' | 'company' | 'check' | 'history' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'people' ? <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a5 5 0 0 0-4-5" /></> : kind === 'company' ? <><path d="M4 21V3h12v18M16 10h4v11M2 21h20M8 7h4M8 11h4M8 15h4M9 21v-3h2v3" /></> : kind === 'check' ? <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="m8 9 2 2 5-5M8 16h8" /></> : <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l4 2" /></>}
  </svg>;
}

function Logo({ value, name }: { value: unknown; name: string }) {
  const url = safeDossierLogo(value);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return <div className="cs-dossier-logo">{url && !failed ? <img src={url} alt={`Logo ${name}`} referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span aria-label={failed ? 'Logo konnte nicht geladen werden' : 'Kein Logo hinterlegt'}>{name.slice(0, 2).toUpperCase()}</span>}</div>;
}

function Progress({ value, label }: { value: number; label: string }) {
  return <div className="cs-dossier-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={{ width: `${value}%` }} /></div>;
}

export function TenantDossierHeader({ dossier, onOpen }: { dossier: TenantDossier; onOpen: OpenView }) {
  const setup = buildTenantSetup(dossier);
  const name = String(dossier.company.name ?? dossier.platform.tenant_name ?? 'Unternehmen');
  const address = [dossier.company.street, dossier.company.house_number, dossier.company.postal_code, dossier.company.city].filter(Boolean).join(' ');
  return <div className="cs-console cs-dossier"><TenantDossierStyle /><section className="cs-dossier-header">
    <Logo value={dossier.branding?.logo_url} name={name} />
    <div className="cs-dossier-heading"><div className="cs-eyebrow">Vollständige Mandantenakte</div><h3>{name}</h3><small>{address || 'Geschäftsanschrift noch nicht vollständig hinterlegt'}</small><div className="cs-actions" style={{ marginTop: 9 }}><ConsoleBadge value={dossier.company.status} label={consoleLabel(dossier.company.status)} /><small>{dossier.counts.clients.total} Klient:innen · {dossier.counts.employees.total} Mitarbeitende · {dossier.counts.accounts} Konten</small></div></div>
    <div className="cs-dossier-meter"><strong>{setup.percentage}%</strong><small>Grundkonfiguration eingerichtet</small><Progress value={setup.percentage} label="Einrichtungsstand der Grundkonfiguration" /><button className="cs-link" onClick={() => onOpen('setup')}>{setup.complete} von {setup.applicable} Prüfschritten vollständig</button></div>
  </section></div>;
}

export function TenantDossierOverview({ dossier, onOpen }: { dossier: TenantDossier; onOpen: OpenView }) {
  const setup = buildTenantSetup(dossier);
  const available = dossier.sections.filter(section => section.available);
  return <div className="cs-console cs-dossier"><TenantDossierStyle />
    <ConsoleStats items={[
      { label: 'Klient:innen', value: dossier.counts.clients.total, hint: `${dossier.counts.clients.active} aktiv · ${dossier.counts.clients.deleted} gelöscht` },
      { label: 'Mitarbeitende', value: dossier.counts.employees.total, hint: `${dossier.counts.employees.active} aktiv · ${dossier.counts.employees.deleted} gelöscht` },
      { label: 'Benutzerkonten', value: dossier.counts.accounts, hint: `${dossier.counts.loggedInAccounts} mit Anmeldezeitpunkt` },
      { label: 'Einsätze', value: dossier.counts.assignments ?? '—', hint: 'Gespeicherte Einsätze des Unternehmens' },
      { label: 'Dokumente', value: dossier.counts.documents ?? '—', hint: 'Einträge in der Dokumentenübersicht' },
      { label: 'Offene Einrichtung', value: setup.open + setup.partial, hint: `${setup.partial} teilweise erfüllt · ${setup.open} offen` },
    ]} />
    <div className="cs-dossier-shortcuts">{([
      ['clients', 'Klient:innen öffnen', 'Stammdaten, Kontakt, Versorgung und Budgets', 'people'],
      ['employees', 'Mitarbeitende öffnen', 'Personalangaben, Verträge und Qualifikationen', 'people'],
      ['company', 'Alle Unternehmensdaten', 'Logo, Bank, Steuer und Konfiguration', 'company'],
      ['history', 'Schritte nachvollziehen', 'Zeitpunkt, Person und gespeicherte Änderungen', 'history'],
    ] as const).map(([view, label, hint, icon]) => <button className="cs-dossier-shortcut" key={view} onClick={() => onOpen(view)}><Icon kind={icon} /><span>{label}<small>{hint}</small></span></button>)}</div>
    <ConsolePanel title="Was ist eingerichtet?" description={`Datenprüfung vom ${consoleDate(dossier.checkedAt)}. Alle Prüfschritte sind gleich gewichtet; Teilangaben werden anteilig bewertet.`}><div className="cs-panel-body"><div className="cs-dossier-group">{setup.groups.map(group => <div key={group.label}><small>{group.label}</small><div><strong>{group.percentage}%</strong></div><Progress value={group.percentage} label={`Einrichtung ${group.label}`} /><small>{group.complete} von {group.total} Schritten vollständig</small></div>)}</div><div className="cs-actions"><button className="cs-btn primary" onClick={() => onOpen('setup')}>Erledigte und offene Schritte prüfen</button><small>{available.length} verfügbare Datenbereiche · {available.filter(section => (section.count ?? 0) > 0).length} mit Einträgen</small></div></div></ConsolePanel>
  </div>;
}

export function TenantSetupPanel({ dossier, onSection }: { dossier: TenantDossier; onSection: (section: string) => void }) {
  const setup = buildTenantSetup(dossier);
  const [filter, setFilter] = useState('all');
  const steps = setup.steps.filter(step => filter === 'all' || (filter === 'missing' ? ['open', 'partial'].includes(step.state) : step.state === filter));
  return <div className="cs-console cs-dossier"><TenantDossierStyle />
    <div className="cs-notice">{setup.percentage}% der Grundkonfiguration sind anhand der gespeicherten Angaben erfüllt. Berechnung: Durchschnitt der anwendbaren Prüfschritte; Teilangaben und unvollständige Personen werden anteilig gewertet. Optionale Bereiche außerhalb dieser Grundprüfung bleiben in der Unternehmensakte sichtbar.</div>
    <ConsolePanel title="Einrichtung Schritt für Schritt" description={`Stand ${consoleDate(dossier.checkedAt)} · ${setup.complete} vollständig · ${setup.partial} teilweise · ${setup.open} offen`} actions={<label className="cs-field">Ansicht<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Alle Schritte</option><option value="missing">Offen und teilweise</option><option value="complete">Vollständig</option><option value="not_applicable">Nicht anwendbar</option></select></label>}>
      <div className="cs-panel-body">{steps.map((step, index) => <article className="cs-dossier-step" key={step.key}><span className={`cs-dossier-step-icon ${step.state}`}>{step.state === 'complete' ? '✓' : index + 1}</span><div><small>{step.group}</small><h4>{step.label}</h4><p>{step.evidence}</p><ConsoleBadge value={step.state === 'complete' ? 'ready' : step.state === 'not_applicable' ? 'inactive' : 'pending'} label={step.state === 'complete' ? 'Vollständig' : step.state === 'partial' ? `Teilweise · ${Math.round(step.score * 100)}%` : step.state === 'open' ? 'Offen' : 'Nicht anwendbar'} />{step.missing.length > 0 && <ul>{step.missing.map(item => <li key={item}>{item}</li>)}</ul>}<small className="cs-dossier-source">Nachweis: {step.source}</small></div><button className="cs-btn" onClick={() => onSection(step.section)}>Daten prüfen</button></article>)}{!steps.length && <div className="cs-empty">Keine Prüfschritte für diese Ansicht.</div>}</div>
    </ConsolePanel>
  </div>;
}

function Value({ value, field }: { value: unknown; field?: string }): ReactNode {
  if (value == null || value === '') return <span className="cs-dossier-empty-value">Nicht hinterlegt</span>;
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (typeof value === 'number') return value.toLocaleString('de-DE', { maximumFractionDigits: 6 });
  if (Array.isArray(value)) return value.length ? <details><summary>{value.length} Einträge anzeigen</summary>{value.map((item, index) => <div key={index} className="cs-dossier-nested"><Value value={item} /></div>)}</details> : <span className="cs-dossier-empty-value">Keine Einträge</span>;
  if (typeof value === 'object') return <details><summary>Weitere Angaben anzeigen</summary><dl className="cs-dossier-nested">{visibleDossierFields(value as DossierRow).map(([key, item]) => <div key={key}><dt>{dossierFieldLabel(key)}</dt><dd><Value value={item} field={key} /></dd></div>)}</dl></details>;
  if (field && /(_at|_date|date_of_birth|valid_from|valid_to|service_start)$/.test(field) && /^\d{4}-\d{2}-\d{2}/.test(String(value))) return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`).toLocaleDateString('de-DE') : consoleDate(value);
  if (field && ['status', 'role_key', 'employment_type', 'product_key', 'billing_party', 'gender'].includes(field)) return consoleLabel(value);
  if (/^https?:\/\//i.test(String(value)) && safeDossierLogo(value)) return <a href={String(value)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{String(value)}</a>;
  return String(value);
}

export function TenantDossierFields({ row }: { row: DossierRow }) {
  const [search, setSearch] = useState('');
  const [showEmpty, setShowEmpty] = useState(true);
  const all = visibleDossierFields(row);
  const populated = all.filter(([, value]) => value != null && value !== '' && (!Array.isArray(value) || value.length > 0));
  const fields = all.filter(([key, value]) => (showEmpty || populated.some(([name]) => name === key)) && `${dossierFieldLabel(key)} ${key} ${JSON.stringify(value)}`.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE')));
  return <><div className="cs-dossier-field-tools"><label className="cs-field" style={{ flex: 1, minWidth: 150 }}>Angabe suchen<input value={search} onChange={event => setSearch(event.target.value)} placeholder="z. B. Adresse, Pflegegrad, IBAN…" /></label><label className="cs-dossier-check"><input type="checkbox" checked={showEmpty} onChange={event => setShowEmpty(event.target.checked)} />Leere Angaben anzeigen</label><small>{populated.length} von {all.length} Feldern befüllt</small></div><dl className="cs-dossier-fields">{fields.map(([key, value]) => <div key={key}><dt title={`Gespeichertes Feld: ${key}`}>{dossierFieldLabel(key)}</dt><dd><Value value={value} field={key} /></dd></div>)}</dl>{!fields.length && <div className="cs-empty">Keine passenden Angaben.</div>}</>;
}

function useDossierPage(tenantId: string, query: DossierQuery) {
  const queryKey = JSON.stringify([tenantId, query]);
  const [state, setState] = useState<{ key: string; data: DossierPage | null; error: string | null; loading: boolean }>({ key: '', data: null, error: null, loading: true });
  const [retry, setRetry] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const current = ++request.current;
    setState({ key: queryKey, data: null, error: null, loading: true });
    const timer = setTimeout(() => {
      void getTenantDossierPage(tenantId, JSON.parse(queryKey)[1]).then(result => {
        if (current !== request.current) return;
        setState(result.ok ? { key: queryKey, data: result.data, error: null, loading: false } : { key: queryKey, data: null, error: result.error, loading: false });
      }).catch(error => { if (current === request.current) setState({ key: queryKey, data: null, loading: false, error: error instanceof Error ? error.message : 'Die Angaben konnten nicht geladen werden.' }); });
    }, query.search ? 250 : 0);
    return () => { clearTimeout(timer); request.current++; };
  }, [tenantId, queryKey, retry]);
  return { ...state, data: state.key === queryKey ? state.data : null, loading: state.key !== queryKey || state.loading, reload: () => setRetry(value => value + 1) };
}

function PageState({ loading, error, reload }: { loading: boolean; error: string | null; reload: () => void }) {
  if (loading) return <div className="cs-dossier-loading" role="status"><div className="cs-loading" /><p style={{ marginTop: 10 }}>Angaben werden geladen…</p></div>;
  if (error) return <div className="cs-panel-body"><div className="cs-notice error" role="alert">{error}</div><button className="cs-btn" onClick={reload}>Erneut laden</button></div>;
  return null;
}

function Pager({ data, offset, onOffset, loading }: { data: DossierPage | null; offset: number; onOffset: (offset: number) => void; loading: boolean }) {
  const limit = data?.limit ?? 50;
  return <div className="cs-pager"><span>{data?.total != null ? `${data.total} passende Datensätze · ${data.rows.length ? offset + 1 : 0}–${offset + (data?.rows.length ?? 0)}` : 'Seitenweise Datenansicht'} · Seite {Math.floor(offset / limit) + 1}</span><div className="cs-actions"><button className="cs-btn" disabled={loading || offset === 0} onClick={() => onOffset(Math.max(0, offset - limit))}>Zurück</button><button className="cs-btn" disabled={loading || !data?.hasMore} onClick={() => onOffset(offset + limit)}>Weitere Datensätze</button></div></div>;
}

type DataBrowserProps = { dossier: TenantDossier; scope: DossierScope; initialSection?: string; parentId?: string; excludeMain?: boolean };
export function TenantDossierDataBrowser({ dossier, scope, initialSection, parentId, excludeMain = false }: DataBrowserProps) {
  const sections = useMemo(() => dossier.sections.filter(section => (section.scope === scope || (scope === 'company' && section.scope === 'operations')) && (!excludeMain || !['clients', 'employees'].includes(section.key))), [dossier.sections, scope, excludeMain]);
  const firstSection = initialSection && sections.some(section => section.key === initialSection) ? initialSection : sections[0]?.key ?? '';
  const [section, setSection] = useState(firstSection);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [deleted, setDeleted] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<DossierRow | null>(null);
  const current = sections.find(item => item.key === section) ?? sections[0];
  const personKind = section === 'clients' || section === 'employees' ? section : null;
  const page = useDossierPage(dossier.tenantId, { section: section || 'tenants', parentId, search, status, offset, includeDeleted: deleted });
  useEffect(() => { setSection(firstSection); setSearch(''); setStatus(''); setDeleted(false); setOffset(0); setSelected(null); }, [firstSection, dossier.tenantId, parentId]);
  const changeSection = (value: string) => { setSection(value); setSearch(''); setStatus(''); setOffset(0); setSelected(null); };
  if (!sections.length) return <div className="cs-notice">Für diesen Bereich sind keine Datenquellen in der Akte hinterlegt.</div>;
  return <div className="cs-console cs-dossier"><TenantDossierStyle /><ConsolePanel title={current?.label ?? 'Gespeicherte Angaben'} description={parentId ? 'Alle zugeordneten Angaben zu dieser Person, mit vollständiger Seitenzählung.' : 'Alle gespeicherten Angaben dieses Unternehmens. Suche und Seitenzählung berücksichtigen den gesamten ausgewählten Bereich.'} actions={<button className="cs-btn" onClick={page.reload} disabled={page.loading}>Aktualisieren</button>}>
    <div className="cs-panel-body"><div className="cs-toolbar"><label className="cs-field">Datenbereich<select value={section} onChange={event => changeSection(event.target.value)}>{sections.map(item => <option key={item.key} value={item.key}>{item.label}{!parentId ? item.available ? ` (${item.count ?? '—'})` : ' – nicht bereitgestellt' : ''}</option>)}</select></label><label className="cs-field">Suchen<input value={search} maxLength={200} onChange={event => { setSearch(event.target.value); setOffset(0); }} placeholder={personKind ? 'Name, Nummer, Ort oder Angabe…' : 'Gespeicherte Angaben durchsuchen…'} /></label>{personKind && <label className="cs-field">Status<select value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }}><option value="">Alle Status</option>{[...new Set([...(page.data?.statuses ?? []), ...(status ? [status] : [])])].map(value => <option key={value} value={value}>{consoleLabel(value)}</option>)}</select></label>}</div>{personKind && <label className="cs-dossier-check"><input type="checkbox" checked={deleted} onChange={event => { setDeleted(event.target.checked); setOffset(0); }} />Gelöschte Datensätze einbeziehen</label>}</div>
    <PageState loading={page.loading} error={page.error} reload={page.reload} />
    {!page.loading && !page.error && page.data && (!page.data.available ? <div className="cs-empty"><strong>Datenbereich nicht bereitgestellt</strong><p>Diese Datenquelle ist in der aktuellen Datenbank nicht verfügbar.</p></div> : !page.data.rows.length ? <div className="cs-empty"><strong>Keine passenden Datensätze</strong><p>{search || status ? 'Bitte Suchbegriff und Statusfilter prüfen.' : personKind ? `Für dieses Unternehmen sind noch keine ${personKind === 'clients' ? 'Klient:innen' : 'Mitarbeitenden'} in dieser Auswahl angelegt.` : 'Für diesen Datenbereich sind noch keine Angaben hinterlegt.'}</p></div> : <>
      <div className="cs-table-scroll cs-dossier-table"><table className="cs-table"><thead><tr><th>{personKind ? 'Person / Nummer' : 'Datensatz'}</th><th>Status / Zuordnung</th>{personKind && <th>Grundangaben</th>}<th>Geändert</th><th>Aktion</th></tr></thead><tbody>{page.data.rows.map((row, index) => <tr key={String(row.id ?? index)}><td><strong>{dossierRowName(row)}</strong><small>{String(row.client_number ?? row.employee_number ?? row.username ?? row.id ?? '')}</small></td><td>{row.deleted_at ? <ConsoleBadge value="deleted" label="Gelöscht" /> : row.status ? <ConsoleBadge value={row.status} label={consoleLabel(row.status)} /> : <Value value={row.is_active ?? row.role_key ?? row.is_primary} />}{row.portal_enabled != null && <small>Portal {row.portal_enabled ? 'aktiviert' : 'deaktiviert'}</small>}</td>{personKind && <td><strong>{dossierPersonCompleteness(row, personKind).percentage}%</strong><small>{dossierPersonCompleteness(row, personKind).missing.join(', ') || 'Grundangaben vollständig'}</small></td>}<td>{consoleDate(row.updated_at ?? row.created_at)}</td><td><button className="cs-btn" aria-label={`Alle Angaben zu ${dossierRowName(row)} öffnen`} onClick={() => setSelected(row)}>Alle Angaben</button></td></tr>)}</tbody></table></div>
      <div className="cs-dossier-person-cards">{page.data.rows.map((row, index) => <article className="cs-dossier-person-card" key={String(row.id ?? index)}><strong>{dossierRowName(row)}</strong><small>{String(row.client_number ?? row.employee_number ?? row.username ?? '')}</small><div className="cs-actions"><ConsoleBadge value={row.deleted_at ? 'deleted' : row.status ?? 'available'} label={row.deleted_at ? 'Gelöscht' : consoleLabel(row.status ?? 'available')} />{personKind && <small>{dossierPersonCompleteness(row, personKind).percentage}% Grundangaben</small>}</div><small>Geändert {consoleDate(row.updated_at ?? row.created_at)}</small><div className="cs-actions"><button className="cs-btn" aria-label={`Alle Angaben zu ${dossierRowName(row)} öffnen`} onClick={() => setSelected(row)}>Alle Angaben</button></div></article>)}</div>
    </>)}<Pager data={page.data} offset={offset} onOffset={setOffset} loading={page.loading} />
  </ConsolePanel>{selected && <TenantRecordDialog key={`${section}:${String(selected.id ?? 'singleton')}`} dossier={dossier} section={section} row={selected} personKind={personKind} onClose={() => setSelected(null)} />}</div>;
}

function TenantRecordDialog({ dossier, section, row, personKind, onClose }: { dossier: TenantDossier; section: string; row: DossierRow; personKind: 'clients' | 'employees' | null; onClose: () => void }) {
  const [related, setRelated] = useState(false);
  return <ConsoleDialog title={dossierRowName(row)} description={`${dossier.sections.find(item => item.key === section)?.label ?? 'Gespeicherte Angaben'} · Unternehmenszuordnung ${dossier.tenantId}`} onClose={onClose}>
    <div className="cs-console cs-dossier"><TenantDossierStyle />{personKind && <div className="cs-actions"><button className="cs-tab" aria-pressed={!related} onClick={() => setRelated(false)}>Alle Stammdaten</button><button className="cs-tab" aria-pressed={related} onClick={() => setRelated(true)}>Zugehörige Angaben und Akten</button></div>}{personKind && related ? <TenantDossierDataBrowser dossier={dossier} scope={personKind} parentId={String(row.id)} excludeMain /> : <TenantDossierFields row={row} />}</div>
  </ConsoleDialog>;
}

export function TenantDossierHistory({ tenantId }: { tenantId: string }) {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const page = useDossierPage(tenantId, { section: 'history', search, offset });
  return <div className="cs-console cs-dossier"><TenantDossierStyle /><ConsolePanel title="Welche Schritte wurden gemacht?" description="Gespeicherte Unternehmens- und Plattformaktionen mit Zeitpunkt, ausführender Person und Änderungen. Fehlende Protokolle bleiben als fehlende Nachweise erkennbar." actions={<button className="cs-btn" onClick={page.reload} disabled={page.loading}>Aktualisieren</button>}>
    <div className="cs-panel-body"><label className="cs-field">Verlauf durchsuchen<input value={search} maxLength={200} onChange={event => { setSearch(event.target.value); setOffset(0); }} placeholder="Aktion, Person oder Begründung…" /></label></div><PageState loading={page.loading} error={page.error} reload={page.reload} />
    {!page.loading && !page.error && page.data && <>{page.data.rows.map(row => <article className="cs-dossier-event" key={`${row.source}:${String(row.id)}`}><header><div><small>{consoleDate(row.created_at)}</small><h4>{platformActionLabel(row.action)}</h4><small>{String(row.actor_name ?? 'Ausführende Person nicht hinterlegt')} · {String(row.source ?? 'Protokoll')}</small></div><ConsoleBadge value="available" label={String(row.area ?? 'Unternehmensakte')} /></header>{row.reason != null && <p>{String(row.reason)}</p>}<details><summary>Geänderte Angaben anzeigen</summary>{dossierChangedFields(row.before, row.after).map(change => <div className="cs-dossier-change" key={change.key}><span className="cs-dossier-change-label">{dossierFieldLabel(change.key)}</span><div><small>Vorher</small><div><Value value={change.before} field={change.key} /></div></div><div><small>Nachher</small><div><Value value={change.after} field={change.key} /></div></div></div>)}{!dossierChangedFields(row.before, row.after).length && <p>Für diese Aktion sind keine unterschiedlichen Feldwerte gespeichert.</p>}</details></article>)}{!page.data.rows.length && <div className="cs-empty"><strong>Keine protokollierten Schritte in dieser Auswahl</strong><p>Der aktuelle Datenbestand und seine Zeitstempel stehen in den jeweiligen Datenbereichen.</p></div>}</>}
    <Pager data={page.data} offset={offset} onOffset={setOffset} loading={page.loading} />
  </ConsolePanel></div>;
}
