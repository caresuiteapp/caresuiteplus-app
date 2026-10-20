import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { ClientCareGradeBudgetsPanel } from '@/components/office/ClientCareGradeBudgetsPanel.web';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { fetchClientList } from '@/lib/office/clientListService';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { confirmAction } from '@/lib/platform/confirmAction';
import type { RoleKey } from '@/types';
import type { ClientListItem } from '@/types/modules/office';

const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de-DE').replace(/ß/g, 'ss');
const clientName = (client: ClientListItem) => `${client.firstName} ${client.lastName}`.trim();
const careLabel = (client: ClientListItem) => formatCareLevel(client.careLevel)?.replace(/^PG /, 'Pflegegrad ') || 'Pflegegrad nicht hinterlegt';

/** The account boundary also clears the selected person and every unfinished editor. */
export function AssistBudgetOverviewScreen() {
  const tenantId = useServiceTenantId()?.trim() ?? '';
  const { user } = useAuth();
  const { roleKey, permissions, can } = usePermissions();
  const userId = user?.id?.trim() ?? '';
  const permissionKey = [...new Set(permissions)].sort().join(',');
  const allowed = Boolean(tenantId && userId && roleKey && !isPortalOnlyRole(roleKey) && can('office.clients.view'));
  const scope = JSON.stringify([tenantId, userId, roleKey, permissionKey]);

  return <ScreenShell title="Budgets" contentOwnsHeader>
    <style>{budgetOverviewCss}</style>
    {allowed && roleKey ? <BudgetClientWorkspace key={scope} scope={scope} tenantId={tenantId} roleKey={roleKey} /> :
      <section className="abo abo-denied" role="status"><h1>Budgets</h1>
        <p>Für diese Übersicht benötigen Sie eine Anmeldung und die Freigabe zum Anzeigen von Klient:innen.</p>
      </section>}
  </ScreenShell>;
}

function BudgetClientWorkspace({ scope, tenantId, roleKey }: { scope: string; tenantId: string; roleKey: RoleKey }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ clientId?: string | string[] }>();
  const requestedClientId = (Array.isArray(params.clientId) ? params.clientId[0] : params.clientId)?.trim() ?? '';
  const [search, setSearch] = useState('');
  const [chooserOpen, setChooserOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectionNotice, setSelectionNotice] = useState('');
  const [switching, setSwitching] = useState(false);
  const dirty = useRef(false);
  const busy = useRef(false);
  const selectedRef = useRef<string | null>(null);
  const appliedParam = useRef<string | null>(null);
  const alive = useRef(true);
  const switchSequence = useRef(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const chooserButton = useRef<HTMLButtonElement>(null);
  const chooserId = useId();
  const onDirtyChange = useCallback((value: boolean) => { dirty.current = value; }, []);
  const onBusyChange = useCallback((value: boolean) => { busy.current = value; }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; switchSequence.current += 1; }; }, []);

  const clientsQuery = useAsyncQuery<ClientListItem[]>(
    () => fetchClientList(tenantId, roleKey, { lifecycleFilter: 'active' }),
    [scope],
    { enabled: true, queryKey: `assist-budget-clients:${scope}` },
  );
  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);
  const selectedClient = clients.find(client => client.id === selectedClientId) ?? null;
  const visibleClients = useMemo(() => {
    const words = normalizeSearch(search.trim()).split(/\s+/).filter(Boolean);
    return clients.filter(client => {
      const haystack = normalizeSearch(`${clientName(client)} ${careLabel(client)} ${client.city ?? ''}`);
      return words.every(word => haystack.includes(word));
    });
  }, [clients, search]);

  const selectClient = useCallback(async (id: string | null, syncUrl = true, restoreFocus = false) => {
    if (selectedRef.current === id) {
      setChooserOpen(false); setSearch('');
      if (restoreFocus) chooserButton.current?.focus();
      return;
    }
    if (busy.current) {
      setSelectionNotice('Bitte schließen Sie zuerst die geöffnete Bearbeitung oder warten Sie, bis das Speichern beendet ist.');
      if (!syncUrl) router.setParams({ clientId: selectedRef.current ?? undefined });
      return;
    }
    const sequence = ++switchSequence.current;
    if (dirty.current) {
      setSwitching(true);
      const discard = await confirmAction({ title: 'Klient:in wechseln?', message: 'Die Abrechnungsquellen wurden noch nicht gespeichert. Möchten Sie die Änderungen verwerfen und wechseln?', confirmLabel: 'Verwerfen und wechseln', cancelLabel: 'Weiter bearbeiten' });
      if (!alive.current || sequence !== switchSequence.current) return;
      setSwitching(false);
      if (!discard) {
        if (!syncUrl) router.setParams({ clientId: selectedRef.current ?? undefined });
        return;
      }
    }
    if (!alive.current || sequence !== switchSequence.current) return;
    if (busy.current) {
      setSelectionNotice('Bitte warten Sie, bis das Speichern beendet ist.');
      if (!syncUrl) router.setParams({ clientId: selectedRef.current ?? undefined });
      return;
    }
    selectedRef.current = id; dirty.current = false; busy.current = false;
    setSelectedClientId(id); setSelectionNotice(''); setChooserOpen(!id); setSearch('');
    if (syncUrl) router.setParams({ clientId: id ?? undefined });
    if (restoreFocus) chooserButton.current?.focus();
  }, [router]);

  useEffect(() => {
    if (clientsQuery.data === null) return;
    // Apply deep links once per actual parameter change. A data refresh must never
    // restore an older URL selection after the user chose another person.
    if (appliedParam.current !== requestedClientId) {
      appliedParam.current = requestedClientId;
      if (requestedClientId && !clients.some(client => client.id === requestedClientId)) {
        setSelectionNotice('Die verlinkte Klient:in ist in dieser Übersicht nicht verfügbar. Bitte wählen Sie eine aktive Klient:in aus.');
        setChooserOpen(true);
      } else {
        void selectClient(requestedClientId || clients[0]?.id || null, !requestedClientId);
      }
      return;
    }
    if (selectedRef.current && !clients.some(client => client.id === selectedRef.current)) {
      switchSequence.current += 1;
      selectedRef.current = null; dirty.current = false; busy.current = false;
      setSelectedClientId(null); setSwitching(false); setChooserOpen(true);
      setSelectionNotice('Die bisher ausgewählte Klient:in ist nicht mehr in der aktiven Liste. Bitte wählen Sie eine andere Person aus.');
      appliedParam.current = '';
      router.setParams({ clientId: undefined });
    }
  }, [clients, clientsQuery.data, requestedClientId, router, selectClient]);

  useEffect(() => { if (chooserOpen) searchInput.current?.focus(); }, [chooserOpen]);
  const staleError = clientsQuery.refreshError || clientsQuery.error;

  return <section className="abo" data-testid="assist-budget-workspace" data-budget-workspace="light-v1">
    <header className="abo-heading">
      <div className="abo-title"><span className="abo-title-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 6l13-3v3M16 11h4v5h-4a2.5 2.5 0 0 1 0-5Z"/><path d="M16 13.5h.01"/></svg></span>
        <div><span className="abo-eyebrow">ASSIST</span><h1>Budgets</h1><p>Ansprüche und Abrechnungsquellen im Blick.</p></div>
      </div>
      <button className="abo-button" type="button" disabled={clientsQuery.loading || clientsQuery.refreshing} onClick={() => void clientsQuery.refresh()} aria-label="Klientenliste aktualisieren">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M19 16a8 8 0 0 1-13 3l-2-3"/></svg>
        {clientsQuery.refreshing ? 'Wird aktualisiert …' : 'Liste aktualisieren'}
      </button>
    </header>

    <section className="abo-chooser" aria-label="Klientenauswahl" data-testid="assist-budget-client-selector">
      <div className="abo-selected">
        <span className="abo-avatar" aria-hidden="true">{selectedClient ? `${selectedClient.firstName.charAt(0)}${selectedClient.lastName.charAt(0)}` : '—'}</span>
        <div className="abo-person"><span className="abo-eyebrow">AUSGEWÄHLTE PERSON</span><h2>{selectedClient ? clientName(selectedClient) : 'Klient:in auswählen'}</h2>
          <p>{selectedClient ? <>{careLabel(selectedClient)}{selectedClient.city ? ` · ${selectedClient.city}` : ''}</> : 'Öffnen Sie das persönliche Budgetprofil.'}</p>
        </div>
        <button className="abo-button abo-change" type="button" ref={chooserButton} aria-expanded={chooserOpen} aria-controls={chooserId} disabled={clients.length === 0 || switching} onClick={() => setChooserOpen(open => !open)}>{chooserOpen ? 'Auswahl schließen' : 'Klient:in wechseln'}<span aria-hidden="true">{chooserOpen ? '⌃' : '⌄'}</span></button>
      </div>

      {clientsQuery.loading && clientsQuery.data === null ? <p className="abo-message" role="status">Klient:innen werden geladen …</p> : null}
      {staleError ? <div className="abo-message abo-error" role="alert"><p>{clientsQuery.data !== null ? 'Die Liste konnte nicht aktualisiert werden. Der zuletzt geladene Stand bleibt sichtbar.' : 'Die Klientenliste konnte nicht geladen werden.'}</p><p>{staleError}</p><button type="button" className="abo-button" disabled={clientsQuery.refreshing} onClick={() => void clientsQuery.refresh()}>Erneut laden</button></div> : null}
      {!clientsQuery.loading && clientsQuery.data !== null && clients.length === 0 ? <div className="abo-message" role="status"><strong>Keine aktiven Klient:innen</strong><p>Sobald eine aktive Klient:in vorhanden ist, können Sie hier das Budget öffnen.</p></div> : null}
      {selectionNotice ? <p className="abo-message abo-notice" role="status">{selectionNotice}</p> : null}

      {chooserOpen && clients.length > 0 ? <div className="abo-picker" id={chooserId} onKeyDown={event => { if (event.key === 'Escape' && selectedClient) { setChooserOpen(false); chooserButton.current?.focus(); } }}>
        <div className="abo-search-row"><label className="abo-search"><span>Klient:in suchen</span><input ref={searchInput} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, Pflegegrad oder Ort" autoComplete="off" /></label><span className="abo-count" role="status">{visibleClients.length} von {clients.length}</span></div>
        {visibleClients.length ? <ul className="abo-results" aria-label="Aktive Klient:innen">{visibleClients.map(client => <li key={client.id}><button type="button" className="abo-result" aria-pressed={client.id === selectedClientId} disabled={switching} onClick={() => void selectClient(client.id, true, true)}>
          <span className="abo-result-avatar" aria-hidden="true">{client.firstName.charAt(0)}{client.lastName.charAt(0)}</span><span className="abo-result-copy"><strong>{clientName(client)}</strong><span>{careLabel(client)}{client.city ? ` · ${client.city}` : ''}</span></span><span className="abo-result-action" aria-hidden="true">{client.id === selectedClientId ? '✓' : '→'}</span>
        </button></li>)}</ul> : <p className="abo-message" role="status">Kein Suchtreffer. Prüfen Sie den Namen, Pflegegrad oder Ort.</p>}
      </div> : null}
    </section>

    {selectedClient ? <div data-testid="assist-budget-live-panel"><ClientCareGradeBudgetsPanel key={`${scope}:${selectedClient.id}`} clientId={selectedClient.id} clientName={clientName(selectedClient)} onRecordRefresh={clientsQuery.refresh} onDirtyChange={onDirtyChange} onBusyChange={onBusyChange} /></div> : null}
  </section>;
}

const budgetOverviewCss = `
.abo{box-sizing:border-box;min-width:0;width:100%;color:#193953;font:inherit;font-size:calc(14px * var(--app-font-scale,1));line-height:1.5;color-scheme:light;container-type:inline-size}.abo *{box-sizing:border-box}.abo h1,.abo h2,.abo p{margin:0}.abo button,.abo input{font:inherit}.abo button{cursor:pointer}.abo button:disabled{opacity:.55;cursor:default}.abo :focus-visible{outline:3px solid #248bd2;outline-offset:3px}.abo-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;padding:6px 4px}.abo-title{display:flex;align-items:center;gap:13px;min-width:0}.abo-title-icon{display:grid;place-items:center;flex-shrink:0;width:52px;height:52px;border-radius:17px;color:#fff;background:linear-gradient(135deg,#126fbd,#3997df);box-shadow:0 7px 18px #126fbd28}.abo-eyebrow{display:block;font-size:calc(9px * var(--app-font-scale,1));font-weight:750;letter-spacing:1.2px;color:#56738a;margin-bottom:3px}.abo h1{font-size:calc(26px * var(--app-font-scale,1));line-height:1.2;letter-spacing:-.6px}.abo-title p{font-size:calc(12px * var(--app-font-scale,1));color:#567189;margin-top:4px}.abo-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:38px;border:1px solid #c6d9e8;border-radius:11px;padding:8px 12px;color:#245981;background:#fff;font-size:calc(12px * var(--app-font-scale,1))!important;font-weight:650!important;line-height:1.4!important;transition:background .18s,border-color .18s,box-shadow .18s}.abo-button:hover:not(:disabled){background:#eff7ff;border-color:#78b5e0;box-shadow:0 4px 12px #175b8e12}.abo-button svg{flex-shrink:0}.abo-chooser{margin-bottom:20px;border:1px solid #d6e3ee;border-radius:20px;background:linear-gradient(115deg,#fff,#f5faff);box-shadow:0 5px 18px #19395308;overflow:hidden}.abo-selected{display:flex;align-items:center;gap:13px;padding:17px 20px;flex-wrap:wrap}.abo-avatar{display:grid;place-items:center;flex-shrink:0;height:46px;width:46px;border:1px solid #c5dceb;border-radius:15px;background:#e5f2fc;color:#246fa9;font-size:calc(16px * var(--app-font-scale,1));font-weight:750}.abo-person{flex:1;min-width:150px}.abo-person h2{font-size:calc(18px * var(--app-font-scale,1));line-height:1.4;overflow-wrap:anywhere;letter-spacing:-.2px}.abo-person p{font-size:calc(12px * var(--app-font-scale,1));color:#567189;margin-top:2px;overflow-wrap:anywhere}.abo-change>span{font-size:18px;line-height:1}.abo-picker{border-top:1px solid #d9e7f1;background:#fff;padding:16px 18px}.abo-search-row{display:flex;align-items:flex-end;gap:12px;margin-bottom:12px}.abo-search{display:grid;gap:5px;flex:1;min-width:0;color:#49657a;font-size:calc(11px * var(--app-font-scale,1));font-weight:650}.abo-search input{display:block;width:100%;min-width:0;border:1px solid #c6dcea;border-radius:10px;padding:10px 12px;background:#f8fbfe;color:#193953;font-size:calc(13px * var(--app-font-scale,1));font-weight:400}.abo-search input::placeholder{color:#6c8191}.abo-count{font-size:calc(11px * var(--app-font-scale,1));color:#536d82;padding-bottom:11px;white-space:nowrap}.abo-results{list-style:none;margin:0;padding:2px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));align-content:start;gap:5px;max-height:320px;overflow-y:auto;scrollbar-gutter:stable}.abo-results li{min-width:0}.abo-result{display:flex;gap:10px;align-items:center;text-align:left;min-height:64px;width:100%;min-width:0;border:1px solid transparent;border-radius:12px;padding:9px;background:#fff;color:#193953;transition:background .15s,border-color .15s,box-shadow .15s}.abo-result:hover:not(:disabled){background:#f0f7ff;border-color:#c3dced;box-shadow:0 2px 8px #12578e10}.abo-result[aria-pressed=true]{background:#eaf4ff;border-color:#a6cde9;box-shadow:inset 3px 0 #217fcd}.abo-result-avatar{display:grid;place-items:center;flex-shrink:0;width:32px;height:32px;border-radius:10px;background:#edf5fc;color:#52728b;font-size:calc(11px * var(--app-font-scale,1));font-weight:700}.abo-result-copy{display:grid;gap:2px;flex:1;min-width:0;overflow-wrap:anywhere}.abo-result-copy strong{font-size:calc(13px * var(--app-font-scale,1));font-weight:650}.abo-result-copy>span{font-size:calc(11px * var(--app-font-scale,1));color:#5a7388}.abo-result-action{flex-shrink:0;color:#2379bb;font-weight:700}.abo-message{padding:15px 20px;color:#4c677b;font-size:calc(12px * var(--app-font-scale,1))}.abo-message p+p{margin-top:6px}.abo-message .abo-button{margin-top:10px}.abo-error{background:#fff3f0;border-top:1px solid #ecd0c6;color:#8c3832}.abo-notice{background:#fff8e9;border-top:1px solid #ead8ad;color:#77541e}.abo-denied{padding:26px;background:#fff;border:1px solid #d6e3ee;border-radius:20px}.abo-denied p{margin-top:10px}
@container(max-width:620px){.abo-heading{gap:12px;padding:2px}.abo-title-icon{width:42px;height:42px;border-radius:14px}.abo h1{font-size:calc(23px * var(--app-font-scale,1))}.abo-selected{padding:14px;gap:10px}.abo-change{margin-left:auto}.abo-person h2{font-size:calc(16px * var(--app-font-scale,1))}.abo-picker{padding:13px 10px}.abo-results{grid-template-columns:1fr;max-height:290px}.abo-heading>.abo-button{margin-left:auto}.abo-title p{font-size:calc(11px * var(--app-font-scale,1))}}
@container(max-width:360px){.abo-selected .abo-change{width:100%}.abo-search-row{align-items:stretch;flex-direction:column;gap:5px}.abo-count{padding-bottom:0}.abo-title{gap:9px}.abo-person{min-width:130px}.abo-avatar{width:38px;height:38px}.abo-title p{max-width:230px}}
@media(prefers-reduced-motion:reduce){.abo *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;
