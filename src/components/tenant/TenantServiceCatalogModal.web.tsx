import type { PermissionKey } from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { usePermissions } from '@/hooks/usePermissions';
import { isUnreleasedModuleKey } from '@/lib/modules/constants';
import { fetchTenantServiceCatalog, fetchTenantServicePriceHistory, saveTenantServiceCatalogItem, type TenantServicePriceVersion } from '@/lib/tenant/tenantServiceCatalogService';
import { filterCompanyCatalog, formatCatalogPrice, parseCatalogAmount, type CatalogCategoryFilter } from '@/lib/tenant/tenantServiceCatalogEditor';
import { formatServiceTaxMode, SERVICE_TAX_MODE_OPTIONS } from '@/lib/tenant/serviceCatalogLabels';
import { ALL_TRAVEL_ROUTE_TYPES, createTravelPolicyFromPreset, DEFAULT_TRAVEL_COMPENSATION_POLICY } from '@/lib/travel/travelCompensationPolicy';
import { TRAVEL_POLICY_PRESET_LABELS, TRAVEL_ROUTE_TYPE_LABELS, type TravelCompensationPolicy, type TravelPolicyPreset, type TravelRouteType } from '@/types/modules/travelCompensation';
import type { ServiceCatalogCategory, ServicePriceUnit, ServiceTaxMode, TenantModuleKey, TenantServiceCatalogItem } from '@/types/tenant/tenantCenter';

export type TenantServiceCatalogModalProps = {
  visible: boolean;
  tenantId: string;
  effectivePermissions?: readonly PermissionKey[];
  initialModuleKey?: TenantModuleKey;
  initialCategory?: ServiceCatalogCategory;
  onClose: () => void;
  onSaved?: () => void;
};

type Draft = { item: TenantServiceCatalogItem; price: string };
const CATEGORIES: { key: CatalogCategoryFilter; label: string }[] = [
  { key: 'all', label: 'Alle' }, { key: 'service', label: 'Leistungen' },
  { key: 'travel', label: 'Fahrtkosten' }, { key: 'surcharge', label: 'Zuschläge' },
];
const CATEGORY_NAMES = { service: 'Leistung', travel: 'Fahrtkosten', surcharge: 'Zuschlag' };
const UNIT_OPTIONS: { key: ServicePriceUnit; label: string }[] = [
  { key: 'hour', label: 'Stunde' }, { key: 'visit', label: 'Besuch' }, { key: 'day', label: 'Tag' },
  { key: 'flat', label: 'Pauschale' }, { key: 'km', label: 'Kilometer' }, { key: 'percent', label: 'Prozent' },
];
const toDraft = (item: TenantServiceCatalogItem): Draft => ({ item, price: item.defaultPriceNet == null ? '' : item.defaultPriceNet.toFixed(2).replace('.', ',') });
const dateLabel = (date: string) => new Date(date).toLocaleDateString('de-DE');

type RouteListKey = keyof Pick<TravelCompensationPolicy, 'logbookRouteTypes' | 'payrollRouteTypes' | 'workTimeRouteTypes' | 'clientBillingRouteTypes'>;
const TRAVEL_ROWS: { key: RouteListKey; label: string }[] = [
  { key: 'logbookRouteTypes', label: 'Im Fahrtenbuch dokumentieren' },
  { key: 'payrollRouteTypes', label: 'Kilometer an Mitarbeitende vergüten' },
  { key: 'workTimeRouteTypes', label: 'Fahrzeit als Arbeitszeit berücksichtigen' },
  { key: 'clientBillingRouteTypes', label: 'Klient:innen in Rechnung stellen' },
];

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="tscm-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

export function TenantServiceCatalogModal({ visible, tenantId, initialModuleKey = 'assist', initialCategory, onClose, onSaved, effectivePermissions }: TenantServiceCatalogModalProps) {
  const { roleKey, can } = usePermissions();
  const allowed = effectivePermissions ? effectivePermissions.includes('business.tenant.manage') : can('business.tenant.manage');
  const [items, setItems] = useState<TenantServiceCatalogItem[]>([]);
  const [category, setCategory] = useState<CatalogCategoryFilter>(initialCategory ?? 'all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [history, setHistory] = useState<TenantServicePriceVersion[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const sequence = useRef(0);
  const savePending = useRef(false);
  const historySequence = useRef(0);
  const promptRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const dirty = draft !== null && JSON.stringify(draft) !== baseline;
  const filtered = useMemo(() => filterCompanyCatalog(items, category, query), [items, category, query]);
  const available = useMemo(() => filterCompanyCatalog(items, 'all', ''), [items]);

  const selectDraft = useCallback((next: TenantServiceCatalogItem | null) => {
    const value = next ? toDraft(next) : null;
    setDraft(value);
    setBaseline(JSON.stringify(value));
    setError('');
    historySequence.current += 1;
    setHistoryLoading(false);
    setHistory(null);
    setHistoryError('');
  }, []);

  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const result = await fetchTenantServiceCatalog(tenantId, roleKey);
      if (request !== sequence.current) return;
      if (!result.ok) { setError(result.error); return; }
      setItems(result.data.items);
    } catch {
      if (request === sequence.current) setError('Der Katalog konnte nicht geladen werden. Bitte erneut versuchen.');
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [tenantId, roleKey]);

  useEffect(() => {
    if (!visible) return;
    savePending.current = false;
    setSaving(false);
    setCategory(initialCategory ?? 'all');
    setQuery('');
    setSuccess('');
    setPendingAction(null);
    setItems([]);
    selectDraft(null);
    void load();
    return () => { sequence.current += 1; };
  }, [visible, initialCategory, load, selectDraft]);

  useEffect(() => {
    if (!visible || !dirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty, visible]);

  useEffect(() => {
    if (pendingAction) { promptRef.current?.scrollIntoView({ block: 'nearest' }); promptRef.current?.focus(); }
  }, [pendingAction]);

  useEffect(() => {
    if (error) { errorRef.current?.scrollIntoView({ block: 'nearest' }); errorRef.current?.focus(); }
  }, [error]);

  const guard = (action: () => void) => {
    if (savePending.current) return;
    if (dirty) setPendingAction(() => action);
    else action();
  };
  const changeItem = (patch: Partial<TenantServiceCatalogItem>) => setDraft((old) => old ? { ...old, item: { ...old.item, ...patch } } : old);
  const selectItem = (item: TenantServiceCatalogItem) => guard(() => {
    selectDraft(item); setSuccess('');
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  });
  const createItem = () => guard(() => {
    const nextCategory = category === 'all' ? 'service' : category;
    const moduleKey = isUnreleasedModuleKey(initialModuleKey) ? 'assist' : initialModuleKey;
    const item: TenantServiceCatalogItem = {
      id: '', moduleKey, serviceKey: `${moduleKey}.${nextCategory}.custom_${crypto.randomUUID()}`, name: '', description: '',
      unit: nextCategory === 'travel' ? 'km' : nextCategory === 'surcharge' ? 'percent' : 'hour',
      category: nextCategory, isActive: true, sortOrder: Math.max(0, ...available.map((value) => value.sortOrder)) + 10,
      defaultPriceNet: null, defaultTaxMode: nextCategory === 'surcharge' ? 'none' : 'exempt_4_16',
      travelPolicy: nextCategory === 'travel' ? DEFAULT_TRAVEL_COMPENSATION_POLICY : null,
    };
    selectDraft(item); setBaseline(''); setSuccess('');
    requestAnimationFrame(() => { editorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); editorRef.current?.querySelector('input')?.focus(); });
  });

  const save = async () => {
    if (!draft || savePending.current) return;
    if (!allowed) { setError('Sie haben keine Berechtigung, den Katalog zu ändern.'); return; }
    const amount = parseCatalogAmount(draft.price);
    if (!draft.item.name.trim()) { setError('Bitte eine Bezeichnung für diese Position eingeben.'); return; }
    if (amount === 'invalid') { setError('Bitte einen gültigen Betrag mit höchstens zwei Nachkommastellen eingeben, zum Beispiel 32,75.'); return; }
    if (amount === null && draft.item.defaultPriceNet != null) { setError('Bitte den bisherigen Preis ersetzen. Für eine kostenlose Position 0,00 eintragen.'); return; }
    const request = sequence.current;
    savePending.current = true;
    setSaving(true); setError(''); setSuccess('');
    try {
      const result = await saveTenantServiceCatalogItem(tenantId, {
        ...draft.item, id: draft.item.id || undefined,
        priceNet: amount ?? undefined, taxMode: draft.item.defaultTaxMode ?? 'none',
        taxRate: draft.item.defaultTaxMode === 'standard_19' ? 19 : 0,
        travelPolicy: draft.item.category === 'travel' ? draft.item.travelPolicy ?? DEFAULT_TRAVEL_COMPENSATION_POLICY : null,
      }, roleKey);
      if (request !== sequence.current) return;
      if (!result.ok) { setError(result.error); return; }
      setItems(result.data.items);
      const updated = result.data.items.find((item) => item.serviceKey === draft.item.serviceKey);
      selectDraft(updated ?? null);
      setCategory(draft.item.category);
      setSuccess(`„${draft.item.name.trim()}“ wurde gespeichert.`);
      onSaved?.();
    } catch {
      if (request === sequence.current) setError('Das Speichern konnte nicht bestätigt werden. Bitte die Verbindung prüfen und erneut speichern.');
    } finally { if (request === sequence.current) { savePending.current = false; setSaving(false); } }
  };

  const loadHistory = async () => {
    if (!draft?.item.id || history !== null || historyLoading) return;
    const id = draft.item.id;
    const request = ++historySequence.current;
    setHistoryLoading(true); setHistoryError('');
    try {
      const result = await fetchTenantServicePriceHistory(tenantId, id, roleKey);
      if (request !== historySequence.current) return;
      if (!result.ok) { setHistoryError(result.error); return; }
      setHistory(result.data);
    } catch { if (request === historySequence.current) setHistoryError('Die Preishistorie konnte nicht geladen werden.'); }
    finally { if (request === historySequence.current) setHistoryLoading(false); }
  };

  const updateRoutes = (key: RouteListKey, route: TravelRouteType) => {
    if (!draft) return;
    const policy = draft.item.travelPolicy ?? DEFAULT_TRAVEL_COMPENSATION_POLICY;
    changeItem({ travelPolicy: { ...policy, preset: 'custom', [key]: policy[key].includes(route) ? policy[key].filter((item) => item !== route) : [...policy[key], route] } });
  };

  const current = draft?.item;
  const footer = <div className="tscm tscm-footer"><button type="button" className="tscm-button" disabled={saving} onClick={() => guard(onClose)}>{dirty ? 'Abbrechen' : 'Schließen'}</button>{draft ? <button type="button" className="tscm-button tscm-primary" disabled={!dirty || saving || loading || !!pendingAction || !allowed} onClick={() => void save()}>{saving ? 'Wird gespeichert…' : current?.id ? 'Änderungen speichern' : 'Position anlegen'}</button> : null}</div>;
  return <PlatformModal surfaceScope="company" visible={visible} title="Leistungen & Preise" subtitle="Leistungen, Fahrtkosten und Zuschläge für Ihr Unternehmen verwalten." onClose={() => guard(onClose)} maxWidth={1120} minWidth={260} maxHeightRatio={0.93}
    dismissOnBackdrop={!saving} footerContent={footer} bodyStyle={{ backgroundColor: '#f4f8fd', padding: 20 }} sheetStyle={{ backgroundColor: '#f4f8fd' }}>
    <div className="tscm">
      <style>{CATALOG_CSS}</style>
      {pendingAction ? <div className="tscm-confirm" role="alertdialog" aria-label="Ungespeicherte Änderungen" tabIndex={-1} ref={promptRef}>
        <strong>Änderungen verwerfen?</strong><p>Die aktuelle Position enthält ungespeicherte Änderungen.</p>
        <div className="tscm-actions"><button type="button" className="tscm-button" onClick={() => setPendingAction(null)}>Weiter bearbeiten</button><button type="button" className="tscm-button tscm-danger" onClick={() => { const action = pendingAction; setPendingAction(null); action(); }}>Änderungen verwerfen</button></div>
      </div> : null}
      {error ? <div className="tscm-feedback tscm-error" role="alert" tabIndex={-1} ref={errorRef}>{error}{!draft ? <button type="button" className="tscm-button" onClick={() => void load()} disabled={loading}>Erneut laden</button> : null}</div> : null}
      {success ? <div className="tscm-feedback tscm-success" role="status">{success}</div> : null}
      <div className="tscm-toolbar">
        <Field label="Katalog durchsuchen"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bezeichnung oder Beschreibung" /></Field>
        <button type="button" className="tscm-button tscm-primary" disabled={loading || saving || !allowed} onClick={createItem}>+ Neue Position</button>
      </div>
      <div className="tscm-filters" aria-label="Kategorien">{CATEGORIES.map((entry) => <button type="button" key={entry.key} aria-pressed={category === entry.key} onClick={() => setCategory(entry.key)}>{entry.label}<span>{entry.key === 'all' ? available.length : available.filter((item) => item.category === entry.key).length}</span></button>)}</div>
      <div className={`tscm-layout${draft ? '' : ' tscm-layout-empty'}`}>
        <section className="tscm-list" aria-label="Katalogpositionen" aria-busy={loading}>
          {loading ? <div className="tscm-empty" role="status">Katalog wird geladen…</div> : filtered.length ? filtered.map((item) => <button type="button" key={item.id} className={`tscm-position${current?.id === item.id ? ' is-selected' : ''}`} onClick={() => selectItem(item)} disabled={saving} aria-pressed={current?.id === item.id}>
            <span className="tscm-position-top"><span className="tscm-category">{CATEGORY_NAMES[item.category]}</span><span className={`tscm-status${item.isActive ? '' : ' is-inactive'}`}>{item.isActive ? 'Aktiv' : 'Inaktiv'}</span></span>
            <strong>{item.name}</strong>{item.description ? <span className="tscm-description">{item.description}</span> : null}<span className="tscm-price">{formatCatalogPrice(item)}</span>
          </button>) : <div className="tscm-empty"><strong>{query ? 'Keine passende Position gefunden' : 'Noch keine Positionen'}</strong><p>{query ? 'Versuchen Sie eine andere Bezeichnung oder wählen Sie eine andere Kategorie.' : 'Legen Sie Ihre Leistungen mit den vereinbarten Preisen an.'}</p>{query ? <button type="button" className="tscm-button" onClick={() => { setQuery(''); setCategory('all'); }}>Filter zurücksetzen</button> : null}</div>}
        </section>
        {draft && current ? <section className="tscm-editor" ref={editorRef} aria-label="Position bearbeiten">
          <div className="tscm-editor-heading"><div><span className="tscm-eyebrow">{current.id ? 'Katalogposition bearbeiten' : 'Neue Katalogposition'}</span><h3>{current.name.trim() || CATEGORY_NAMES[current.category]}</h3></div><span className="tscm-draft-state">{dirty ? 'Ungespeichert' : 'Gespeichert'}</span></div>
          <fieldset disabled={saving || !allowed}>
            <Field label="Bezeichnung *"><input value={current.name} onChange={(event) => changeItem({ name: event.target.value })} placeholder={current.category === 'travel' ? 'z. B. Fahrtkosten pro Kilometer' : current.category === 'surcharge' ? 'z. B. Wochenendzuschlag' : 'z. B. Alltagsbegleitung'} maxLength={180} /></Field>
            <Field label="Beschreibung"><textarea value={current.description} onChange={(event) => changeItem({ description: event.target.value })} rows={3} placeholder="Was umfasst diese Position?" maxLength={2000} /></Field>
            <div className="tscm-field-grid">
              <Field label="Kategorie"><select value={current.category} onChange={(event) => changeItem({ category: event.target.value as ServiceCatalogCategory })}>{Object.entries(CATEGORY_NAMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Abrechnungseinheit"><select value={current.unit} onChange={(event) => changeItem({ unit: event.target.value as ServicePriceUnit })}>{UNIT_OPTIONS.map((unit) => <option key={unit.key} value={unit.key}>{unit.label}</option>)}</select></Field>
              <Field label={current.unit === 'percent' ? 'Zuschlag (%)' : 'Nettopreis (€)'} hint={current.unit === 'percent' ? 'Prozentualer Zuschlag auf die zugehörige Leistung.' : current.defaultPriceNet != null ? 'Für eine kostenlose Position 0,00 eintragen.' : 'Leer lassen, wenn noch kein Preis vereinbart ist.'}><input inputMode="decimal" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="0,00" /></Field>
              <Field label="Steuerregel" hint={parseCatalogAmount(draft.price) === null ? 'Die Steuerregel wird mit einem Preis gespeichert.' : undefined}><select disabled={parseCatalogAmount(draft.price) === null} value={current.defaultTaxMode ?? 'none'} onChange={(event) => changeItem({ defaultTaxMode: event.target.value as ServiceTaxMode })}>{SERVICE_TAX_MODE_OPTIONS.map((mode) => <option key={mode.key} value={mode.key}>{mode.label}</option>)}</select></Field>
            </div>
            <label className="tscm-check tscm-active"><input type="checkbox" checked={current.isActive} onChange={(event) => changeItem({ isActive: event.target.checked })} /><span><strong>Position aktiv verwenden</strong><small>Inaktive Positionen bleiben erhalten und können später wieder aktiviert werden.</small></span></label>
            {current.category === 'travel' ? <div className="tscm-travel"><h4>Fahrtkostenregel</h4><p>Wählen Sie, welche Fahrten dokumentiert, vergütet oder abgerechnet werden.</p><Field label="Voreinstellung"><select value={(current.travelPolicy ?? DEFAULT_TRAVEL_COMPENSATION_POLICY).preset} onChange={(event) => {
              const preset = event.target.value as TravelPolicyPreset;
              changeItem({ travelPolicy: preset === 'custom' ? { ...(current.travelPolicy ?? DEFAULT_TRAVEL_COMPENSATION_POLICY), preset } : createTravelPolicyFromPreset(preset) });
            }}>{Object.entries(TRAVEL_POLICY_PRESET_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              {TRAVEL_ROWS.map((row) => <div key={row.key} className="tscm-travel-row"><strong>{row.label}</strong><div>{ALL_TRAVEL_ROUTE_TYPES.map((route) => <label className="tscm-check" key={route}><input type="checkbox" checked={(current.travelPolicy ?? DEFAULT_TRAVEL_COMPENSATION_POLICY)[row.key].includes(route)} onChange={() => updateRoutes(row.key, route)} /><span>{TRAVEL_ROUTE_TYPE_LABELS[route]}</span></label>)}</div></div>)}
            </div> : null}
          </fieldset>
          {current.id ? <details key={current.id} className="tscm-history" onToggle={(event) => { if (event.currentTarget.open) void loadHistory(); }}><summary>Preishistorie ansehen</summary><p className="tscm-history-current">Aktuell: {formatCatalogPrice(current)}</p>
            {historyLoading ? <p role="status">Preishistorie wird geladen…</p> : historyError ? <div role="alert"><p>{historyError}</p><button type="button" className="tscm-button" onClick={() => void loadHistory()}>Erneut laden</button></div> : history?.length ? history.map((entry) => <div className="tscm-history-row" key={entry.id}><strong>Preiswert: {new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entry.priceNet)}</strong><span>{formatServiceTaxMode(entry.taxMode)}</span><small>Gültig ab {dateLabel(entry.validFrom)} · ersetzt am {dateLabel(entry.changedAt)}</small></div>) : history ? <p>Es sind noch keine früheren Preise gespeichert.</p> : null}
          </details> : null}
        </section> : !loading && available.length ? <section className="tscm-editor-hint"><span aria-hidden="true">€</span><h3>Preise klar hinterlegt</h3><p>Wählen Sie eine Position, um Bezeichnung, Preis, Steuerregel oder Fahrtkosten zu bearbeiten.</p></section> : null}
      </div>
    </div>
  </PlatformModal>;
}

const CATALOG_CSS = `
.tscm{container-type:inline-size;color:#15304e;font-family:inherit;font-size:14px;line-height:1.5;min-width:0}.tscm-footer{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;width:100%}.tscm *{box-sizing:border-box}.tscm p{margin:0}.tscm button,.tscm input,.tscm select,.tscm textarea{font:inherit}.tscm button{cursor:pointer}.tscm button:disabled{cursor:wait;opacity:.5}.tscm button:focus-visible,.tscm input:focus-visible,.tscm select:focus-visible,.tscm textarea:focus-visible,.tscm summary:focus-visible{outline:2px solid #1764d4;outline-offset:3px}.tscm-toolbar{display:flex;gap:14px;align-items:flex-end;margin-bottom:16px}.tscm-toolbar>.tscm-field{flex:1}.tscm-field{display:flex;flex-direction:column;gap:7px;min-width:0;color:#15304e;font-weight:600}.tscm-field input,.tscm-field select,.tscm-field textarea{width:100%;min-width:0;border:1px solid #c5d6e9;border-radius:11px;background:#ffffff;color:#15304e;padding:11px 12px;line-height:1.4;box-shadow:inset 0 1px 2px #ffffffa6}.tscm-field textarea{resize:vertical;min-height:84px}.tscm-field input::placeholder,.tscm-field textarea::placeholder{color:#59708c}.tscm-field select{color-scheme:light}.tscm-field small{font-size:12px;line-height:1.5;font-weight:400;color:#59708c}.tscm-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:43px;padding:10px 14px;border:1px solid #c5d6e9;border-radius:12px;background:#ffffff;color:#15304e;font-weight:650;white-space:normal;text-align:center}.tscm-button:hover{background:#e6f0ff}.tscm-primary{background:linear-gradient(135deg,#1764d4,#1558ba);border-color:#2269cd;color:#ffffff;box-shadow:0 5px 18px #12325014}.tscm-primary:hover{background:#1558ba}.tscm-filters{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:20px}.tscm-filters button{display:flex;gap:9px;align-items:center;padding:8px 13px;border-radius:999px;border:1px solid #c5d6e9;background:#ffffff;color:#59708c}.tscm-filters button[aria-pressed=true]{background:#e6f0ff;border-color:#8cb4e7;color:#1859b3}.tscm-filters span{border-radius:30px;padding:0 6px;background:#f4f8fd;font-size:12px;font-variant-numeric:tabular-nums}.tscm-layout{display:grid;grid-template-columns:minmax(230px,.8fr) minmax(0,1.45fr);gap:20px;align-items:start}.tscm-list{display:flex;flex-direction:column;gap:10px;min-width:0;max-height:min(58vh,620px);overflow:auto;padding:2px;scrollbar-width:thin;scrollbar-color:#9bb3ce transparent}.tscm-position{display:flex;flex-direction:column;gap:7px;width:100%;border:1px solid #d7e3f1;border-radius:16px;text-align:left;background:linear-gradient(145deg,#ffffff,#f7faff);padding:15px;color:#15304e;transition:border-color .15s,background .15s}.tscm-position:hover{border-color:#8cb4e7;background:#e6f0ff}.tscm-position.is-selected{border-color:#8cb4e7;box-shadow:inset 3px 0 #3684ed26;background:linear-gradient(135deg,#e6f0ff,#e6f0ff)}.tscm-position strong{font-size:15px;line-height:1.45;overflow-wrap:anywhere}.tscm-position-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.tscm-category{font-size:11px;color:#59708c;letter-spacing:.055em;text-transform:uppercase}.tscm-status{color:#176c50;font-size:11px}.tscm-status.is-inactive{color:#59708c}.tscm-description{color:#59708c;font-size:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.tscm-price{color:#1764d4;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:3px}.tscm-editor{min-width:0;border:1px solid #d7e3f1;border-radius:20px;padding:20px;background:linear-gradient(135deg,#ffffff,#f7faff)}.tscm-editor-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:21px}.tscm-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#1764d4}.tscm-editor h3{font-size:20px;line-height:1.3;margin:6px 0 0;overflow-wrap:anywhere}.tscm-draft-state{color:#59708c;font-size:11px;white-space:nowrap;padding-top:4px}.tscm-editor fieldset{display:flex;flex-direction:column;gap:17px;border:0;padding:0;margin:0;min-width:0}.tscm-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px 14px}.tscm-check{display:flex;align-items:flex-start;gap:9px;cursor:pointer;color:#15304e;font-size:13px}.tscm-check input{appearance:auto;accent-color:#1764d4;width:17px;height:17px;flex:none;margin:3px 0 0}.tscm-check span{min-width:0}.tscm-check small{display:block;margin-top:3px;font-size:12px;font-weight:400;color:#59708c}.tscm-active{padding:13px;border:1px solid #d7e3f1;border-radius:12px;background:#f4f8fd}.tscm-travel{border-top:1px solid #d7e3f1;padding-top:20px}.tscm-travel h4{font-size:16px;margin:0 0 6px}.tscm-travel>p{font-size:12px;color:#59708c;margin-bottom:15px}.tscm-travel-row{padding-top:16px}.tscm-travel-row>strong{font-size:13px}.tscm-travel-row>div{display:flex;flex-wrap:wrap;gap:10px 14px;margin-top:9px}.tscm-history{margin-top:22px;border-top:1px solid #d7e3f1;padding-top:16px;font-size:13px;color:#1764d4}.tscm-history summary{cursor:pointer;color:#1764d4;font-weight:600}.tscm-history-current{margin-top:14px!important;color:#15304e}.tscm-history-row{display:flex;flex-direction:column;gap:4px;padding:12px 0;border-bottom:1px solid #d7e3f1}.tscm-history-row small{color:#59708c}.tscm-empty{padding:28px 20px;border:1px dashed #d7e3f1;border-radius:16px;color:#59708c;line-height:1.6}.tscm-empty strong{color:#15304e}.tscm-empty p{margin:8px 0 14px}.tscm-editor-hint{padding:40px 28px;text-align:center;color:#59708c;border:1px solid #d7e3f1;border-radius:20px;background:#ffffff}.tscm-editor-hint>span{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:17px;background:#eaf2ff;color:#1764d4;font-size:27px;border:1px solid #d7e3f1}.tscm-editor-hint h3{color:#15304e;font-size:19px;font-weight:650;margin:16px 0 8px}.tscm-feedback,.tscm-confirm{padding:15px;border-radius:13px;margin-bottom:16px;overflow-wrap:anywhere}.tscm-feedback .tscm-button{margin-left:10px}.tscm-error{color:#a33b35;background:#fff4f3;border:1px solid #e7c2c0}.tscm-success{color:#176c50;background:#edf8f3;border:1px solid #b7ddcc}.tscm-confirm{background:#fff8ea;border:1px solid #ead4a6;color:#86570f}.tscm-confirm p{margin:5px 0 12px}.tscm-actions{display:flex;flex-wrap:wrap;gap:8px}.tscm-danger{border-color:#e7c2c0;background:#fff4f3}.tscm-layout-empty .tscm-empty{min-height:180px}
@container (max-width:740px){.tscm-layout{grid-template-columns:minmax(0,1fr)}.tscm-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.tscm-editor-hint{display:none}.tscm-empty{grid-column:1/-1}.tscm-position{padding:13px}.tscm-editor{padding:17px}}
@container (max-width:460px){.tscm-toolbar{flex-direction:column;align-items:stretch}.tscm-toolbar>.tscm-field{width:100%}.tscm-list,.tscm-field-grid{grid-template-columns:minmax(0,1fr)}.tscm-editor-heading{flex-direction:column;gap:5px}.tscm-filters{gap:6px}.tscm-filters button{padding:7px 10px}.tscm-editor{padding:14px}}
@media(prefers-reduced-motion:reduce){.tscm *{scroll-behavior:auto!important;transition:none!important}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
