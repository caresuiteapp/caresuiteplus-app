// Generated native presentation from src/screens/platformConsole/PlatformConsoleWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeSection,NativeH2,NativeP,NativeStrong,NativeSmall,NativeButton,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeH3,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeSpan,NativeForm,NativeTextarea,NativeDl,NativeDt,NativeDd,NativeDetails,NativeSummary,NativeA,NativeB} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PlatformShellLayout } from "../../components/platformConsole/PlatformShellLayout.native.tsx";
import { ConsoleBadge, ConsoleDialog, ConsoleJson, ConsolePanel, ConsoleStats, ConsoleStyle, downloadConsoleCsv } from "../../components/platformConsole/ConsoleWorkspaceUi.native.tsx";
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import * as api from '@/lib/platformConsole';
import { platformName, platformActionLabel } from "../../lib/platformConsole/platformLanguage.native.ts";
import { consoleDate, consoleLabel, consoleMoney, consoleText, isSensitiveSetting, redactConsoleValue, type ConsoleRow } from "../../lib/platformConsole/consoleWorkspaceModel.native.ts";
import { CONSOLE_SECTIONS, consoleActions, formatConsoleCell, loadConsoleData, loadConsoleVersions, type ConsoleAction, type ConsoleData, type ConsoleSection } from '@/lib/platformConsole/consoleWorkspaceService';
import type { PlatformCapability, PlatformRoleKey } from '@/types/platformConsole';
import { getServiceMode } from '@/lib/services/mode';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { isRetiredPlatformSection } from '@/lib/platformConsole/platformFreePolicy';
import { PlatformFreeUsagePanel } from "../../components/platformConsole/PlatformFreeUsagePanel.native.tsx";
import { PlatformOperationsPanel } from "../../components/platformConsole/PlatformOperationsPanel.native.tsx";
import { PlatformRuntimeStatus } from "../../components/platformConsole/PlatformRuntimeBoundary.native.tsx";
import { refreshPlatformRuntime } from "../../lib/platformConsole/platformRuntime.native.ts";
const INITIAL: ConsoleData = { rows: [], tenants: [], related: [], warnings: [], hasMore: false };
const STATUS_FILTERS: Partial<Record<ConsoleSection, string[]>> = { tenants: ['active', 'suspended', 'locked', 'terminated', 'deleted_soft'], billing: ['draft', 'open', 'paid', 'past_due', 'partially_paid', 'failed', 'cancelled', 'refunded'], payments: ['pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'chargeback'], modules: ['available', 'beta', 'internal', 'deprecated', 'disabled'], plans: ['active', 'inactive', 'archived'], addons: ['active', 'beta', 'deprecated', 'disabled'], discounts: ['active', 'scheduled', 'expired', 'revoked'], users: ['active', 'disabled', 'revoked'], releases: ['planned', 'building', 'ready', 'failed', 'rolled_back'], 'feature-flags': ['true', 'false'] };
const PAGE_SIZE = 25;
const PRIMARY_KEYS: Partial<Record<ConsoleSection, string>> = { tenants: 'tenantName', plans: 'plan_name', addons: 'addon_name', modules: 'module_name', discounts: 'discount_name', billing: 'invoice_number', payments: 'tenant_label', 'feature-flags': 'flag_name', users: 'email', audit: 'action', system: 'display_name', releases: 'version_label' };
export function PlatformConsoleWorkspace({ section }: {
    section: ConsoleSection;
}) {
    if (isRetiredPlatformSection(section))
        return <PlatformShellLayout title="Kostenlose Nutzung" subtitle="CareSuite HealthOS"><PlatformFreeUsagePanel /></PlatformShellLayout>;
    return <ActivePlatformConsoleWorkspace section={section}/>;
}
function ActivePlatformConsoleWorkspace({ section }: {
    section: ConsoleSection;
}) {
    const router = useRouter();
    const params = useLocalSearchParams<{
        status?: string;
        tenantId?: string;
        action?: string;
    }>();
    const { platformUser } = usePlatformAuth();
    const role = platformUser?.role;
    const info = CONSOLE_SECTIONS[section];
    const [data, setData] = useState<ConsoleData>(INITIAL);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [search, setSearch] = useState(typeof params.action === 'string' ? params.action : '');
    const [status, setStatus] = useState(typeof params.status === 'string' ? params.status : '');
    const [tenantId, setTenantId] = useState(typeof params.tenantId === 'string' ? params.tenantId : '');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [offset, setOffset] = useState(0);
    const [page, setPage] = useState(0);
    const [updated, setUpdated] = useState<string | null>(null);
    const [selected, setSelected] = useState<ConsoleRow | null>(null);
    const [action, setAction] = useState<ConsoleAction | null>(null);
    const [sort, setSort] = useState<{
        key: string;
        desc: boolean;
    } | null>(null);
    const generation = useRef(0);
    const serverPaged = section === 'tenants' || section === 'audit' || section === 'releases';
    const allowed = !info.capability || api.platformRoleHasCapability(role, info.capability);
    const load = useCallback(async () => {
        const request = ++generation.current;
        if (!allowed) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const response = await loadConsoleData(section, { search: serverPaged ? search.trim() : '', status: serverPaged ? status : '', tenantId: serverPaged ? tenantId : '', offset, start, end }, role);
            if (request !== generation.current)
                return;
            setData(response);
            setUpdated(new Date().toISOString());
            setSelected(previous => previous ? response.rows.find(row => row.id === previous.id) ?? null : null);
        }
        catch (cause) {
            if (request === generation.current)
                setError(cause instanceof Error ? cause.message : 'Die Daten konnten nicht geladen werden.');
        }
        finally {
            if (request === generation.current)
                setLoading(false);
        }
    }, [allowed, offset, role, section, serverPaged, search, status, tenantId, start, end]);
    useEffect(() => { const cleanupGeneration = generation; const timer = setTimeout(() => void load(), serverPaged ? 250 : 0); return () => { clearTimeout(timer); cleanupGeneration.current++; }; }, [load, serverPaged]);
    useEffect(() => { setPage(0); }, [search, status, tenantId, start, end, sort]);
    const filtered = useMemo(() => {
        const q = search.trim().toLocaleLowerCase('de-DE');
        let result = data.rows.filter(row => {
            if (!serverPaged && q && !Object.values(redactConsoleValue(row) as ConsoleRow).some(value => consoleText(value).toLocaleLowerCase('de-DE').includes(q)))
                return false;
            if (!serverPaged && status && String(section === 'feature-flags' ? row.enabled : row.status) !== status)
                return false;
            if (tenantId && section !== 'audit' && row.tenant_id !== tenantId)
                return false;
            const date = String(row.created_at ?? row.deployed_at ?? row.updated_at ?? row.createdAt ?? '').slice(0, 10);
            if (!serverPaged) {
                if (start && (!date || date < start))
                    return false;
                if (end && (!date || date > end))
                    return false;
            }
            return true;
        });
        if (sort)
            result = [...result].sort((a, b) => { const av = a[sort.key], bv = b[sort.key]; const comparison = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), 'de', { numeric: true }); return sort.desc ? -comparison : comparison; });
        return result;
    }, [data.rows, search, status, tenantId, start, end, section, serverPaged, sort]);
    const validPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
    const visible = serverPaged ? filtered : filtered.slice(validPage * PAGE_SIZE, (validPage + 1) * PAGE_SIZE);
    const actions = consoleActions(section, null, data).filter(item => api.platformRoleHasCapability(role, item.capability));
    const filtersActive = Boolean(search || status || tenantId || start || end);
    function resetFilters() { setSearch(''); setStatus(''); setTenantId(''); setStart(''); setEnd(''); setOffset(0); setPage(0); }
    function open(row: ConsoleRow) { if (section === 'tenants') {
        const id = String(row.tenantId ?? '');
        if (id)
            router.push(`/platform/tenants/${encodeURIComponent(id)}` as never);
        return;
    } setSelected(row); }
    const afterSave = async () => { setAction(null); setNotice('Änderung gespeichert und protokolliert. Die Übersicht wird aktualisiert.'); await load(); if (section === 'system')
        await refreshPlatformRuntime(); };
    return <PlatformShellLayout title={info.title} subtitle={info.subtitle}>
    <NativeDiv className="cs-console"><ConsoleStyle />
      <NativeSection className="cs-hero"><NativeDiv><NativeDiv className="cs-eyebrow">CareSuite HealthOS · Verwaltung</NativeDiv><NativeH2>{info.subtitle}</NativeH2><NativeP>{info.description}</NativeP></NativeDiv>{['dashboard', 'plans', 'tenants'].includes(section) && <NativeDiv className="cs-price"><NativeStrong>0 €</NativeStrong><NativeSmall>Plattformnutzung</NativeSmall></NativeDiv>}</NativeSection>
      {!allowed ? <NativeDiv className="cs-notice" role="status">Ihre Rolle hat keinen Zugriff auf diesen Bereich.</NativeDiv> : <>
      {getServiceMode() === 'demo' && <NativeDiv className="cs-notice">Demomodus: Beispieldaten. Änderungen sind in dieser Vorschau gesperrt.</NativeDiv>}
      {section === 'feature-flags' && <NativeDiv className="cs-notice">Diese Freigaben werden gespeichert. Ihre Anwendung in den einzelnen Funktionen ist noch nicht vollständig eingerichtet. Freischaltungen für ein Unternehmen verwalten Sie in dessen Akte unter „Funktionen“.</NativeDiv>}
      {section === 'system' && <PlatformRuntimeStatus />}
      {notice && <NativeDiv className="cs-notice success" role="status">{notice}</NativeDiv>}
      {data.warnings.map(warning => <NativeDiv className="cs-notice" role="status" key={warning}>{warning}</NativeDiv>)}
      {error && <NativeDiv className="cs-notice error" role="alert"><NativeStrong>Aktualisierung fehlgeschlagen.</NativeStrong> {error} <NativeButton className="cs-link" onClick={() => void load()} disabled={loading}>Erneut versuchen</NativeButton>{updated && <NativeP>Die angezeigten Daten stammen vom {consoleDate(updated)}.</NativeP>}</NativeDiv>}
      {loading && <><NativeDiv className="cs-loading" role="progressbar" aria-label="Daten werden geladen"/><NativeP className="cs-busy-copy" role="status">Daten werden geladen. Bei langsamer Verbindung kann dies einen Moment dauern.</NativeP></>}
      {section === 'dashboard' ? <ConsoleDashboard data={data} loading={loading} role={role} onRefresh={() => void load()}/> : <>
        {section === 'system' && <PlatformOperationsPanel full/>}
        <ConsoleStats items={pageStats(section, data.rows, data.related)}/>
        <ConsolePanel title={section === 'audit' ? 'Änderungsprotokoll' : section === 'system' ? 'Einstellungen' : section === 'tenants' ? 'Unternehmensverzeichnis' : 'Verzeichnis'} description={updated ? `Zuletzt aktualisiert: ${consoleDate(updated)}` : 'Daten werden aus der Plattform geladen'} actions={<NativeDiv className="cs-actions"><NativeButton className="cs-btn" onClick={() => void load()} disabled={loading}>↻ Aktualisieren</NativeButton>{actions.map(item => <NativeButton className="cs-btn primary" key={item.key} disabled={loading || getServiceMode() === 'demo'} onClick={() => setAction(item)}>＋ {item.title}</NativeButton>)}</NativeDiv>}>
          <NativeDiv className="cs-panel-body"><NativeDiv className="cs-toolbar">
            <NativeLabel className="cs-field">{section === 'audit' ? 'Aktion suchen' : 'Suchen'}<NativeInput type="search" value={search} placeholder={section === 'tenants' ? 'Unternehmen, E-Mail oder Kürzel' : section === 'audit' ? 'z. B. Anmeldung oder Freigabe' : 'Bezeichnung, Status oder Kennung'} onChange={event => { setSearch(event.target.value); setOffset(0); }}/></NativeLabel>
            {STATUS_FILTERS[section] && <NativeLabel className="cs-field">Status<NativeSelect value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }}><NativeOption value="">{section === 'tenants' ? 'Alle bestehenden Unternehmen' : 'Alle Status'}</NativeOption>{STATUS_FILTERS[section]?.map(value => <NativeOption key={value} value={value}>{value === 'true' ? 'Aktiviert' : value === 'false' ? 'Deaktiviert' : consoleLabel(value)}</NativeOption>)}</NativeSelect></NativeLabel>}
            {['billing', 'payments', 'audit', 'feature-flags'].includes(section) && <NativeLabel className="cs-field">Unternehmen<NativeSelect value={tenantId} onChange={event => { setTenantId(event.target.value); setOffset(0); }}><NativeOption value="">Alle Unternehmen</NativeOption>{data.tenants.map(tenant => <NativeOption key={String(tenant.tenantId)} value={String(tenant.tenantId)}>{String(tenant.tenantName)}</NativeOption>)}</NativeSelect></NativeLabel>}
            {['audit', 'billing', 'payments', 'releases'].includes(section) && <><NativeLabel className="cs-field">{section === 'billing' ? 'Erfasst ab' : 'Ab Datum'}<NativeInput type="date" value={start} max={end || undefined} onChange={event => { setStart(event.target.value); setOffset(0); }}/></NativeLabel><NativeLabel className="cs-field">Bis Datum<NativeInput type="date" value={end} min={start || undefined} onChange={event => { setEnd(event.target.value); setOffset(0); }}/></NativeLabel></>}
          </NativeDiv><NativeDiv className="cs-actions"><NativeSmall>{filtered.length} Treffer{serverPaged ? ' auf dieser Datenseite' : ''}{start && end && end < start ? ' · Bitte den Zeitraum korrigieren.' : ''}</NativeSmall>{filtersActive && <NativeButton className="cs-link" onClick={resetFilters}>Filter zurücksetzen</NativeButton>}<NativeButton className="cs-link" disabled={!filtered.length || loading} onClick={async () => await downloadConsoleCsv(`CareSuite-${section}`, info.columns.map(column => column.label), filtered.map(row => info.columns.map(column => formatConsoleCell(row, column))))}>Gefilterte Liste als CSV exportieren</NativeButton></NativeDiv>{(section === 'audit' || section === 'releases') && <NativeSmall>Zeitraum, Status und Suchbegriff werden im gesamten Verlauf gefiltert. Die Tabelle und der Export zeigen jeweils die aktuelle Datenseite.</NativeSmall>}</NativeDiv>
          {!loading && !visible.length ? <NativeDiv className="cs-empty"><NativeH3>{filtersActive ? 'Keine passenden Einträge' : 'Noch keine Einträge'}</NativeH3><NativeP>{filtersActive ? 'Passen Sie die Suche oder die Filter an.' : info.empty}</NativeP>{filtersActive && <NativeButton className="cs-btn" onClick={resetFilters}>Alle anzeigen</NativeButton>}</NativeDiv> : <NativeDiv className="cs-table-scroll"><NativeTable className="cs-table"><NativeThead><NativeTr>{info.columns.map(column => <NativeTh key={column.key} scope="col" aria-sort={sort?.key === column.key ? sort.desc ? 'descending' : 'ascending' : 'none'}><NativeButton className="cs-link" onClick={() => setSort(current => ({ key: column.key, desc: current?.key === column.key ? !current.desc : false }))}>{column.label}{sort?.key === column.key ? (sort.desc ? ' ↓' : ' ↑') : ''}</NativeButton></NativeTh>)}<NativeTh scope="col">Aktion</NativeTh></NativeTr></NativeThead><NativeTbody>{visible.map(row => <NativeTr key={String(row.id ?? row.tenantId ?? row.setting_key ?? row.module_key)}>{info.columns.map((column, index) => <NativeTd key={column.key}>{index === 0 ? <NativeButton className="cs-link" onClick={() => open(row)}>{formatConsoleCell(row, column)}</NativeButton> : column.format === 'status' || column.format === 'boolean' ? <ConsoleBadge value={row[column.key]} label={formatConsoleCell(row, column)}/> : formatConsoleCell(row, column)}</NativeTd>)}<NativeTd><NativeButton className="cs-btn" onClick={() => open(row)}>{section === 'tenants' ? 'Akte öffnen' : 'Details'}</NativeButton></NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv>}
          <NativeDiv className="cs-pager"><NativeSpan>{serverPaged ? `Datenseite ${Math.floor(offset / 50) + 1} · bis zu 50 Einträge` : `Seite ${validPage + 1} von ${Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} · ${filtered.length} gefilterte Einträge`}</NativeSpan><NativeDiv className="cs-actions"><NativeButton className="cs-btn" disabled={loading || (serverPaged ? offset === 0 : validPage === 0)} onClick={() => serverPaged ? setOffset(value => Math.max(0, value - 50)) : setPage(value => Math.max(0, value - 1))}>Zurück</NativeButton><NativeButton className="cs-btn" disabled={loading || (serverPaged ? !data.hasMore : (validPage + 1) * PAGE_SIZE >= filtered.length)} onClick={() => serverPaged ? setOffset(value => value + 50) : setPage(value => value + 1)}>{section === 'audit' ? 'Ältere Einträge' : 'Weiter'}</NativeButton></NativeDiv></NativeDiv>
        </ConsolePanel>
        {section === 'discounts' && <DiscountAssignments data={data} role={role} onAction={setAction}/>}
        {section === 'users' && <RoleMatrix />}
        {section === 'addons' && <AddonAssignments data={data} role={role} onAction={setAction}/>}
      </>}
      </>}
    </NativeDiv>
    {selected && !action && <ConsoleDetail section={section} row={selected} data={data} role={role} onClose={() => setSelected(null)} onAction={setAction}/>}
    {action && <ConsoleActionEditor key={action.key} action={action} onClose={() => setAction(null)} onSaved={afterSave}/>}
  </PlatformShellLayout>;
}
function pageStats(section: ConsoleSection, rows: ConsoleRow[], related: ConsoleRow[]) {
    const count = (key: string, value: unknown) => rows.filter(row => row[key] === value).length;
    const sum = (status: string) => { const amounts = new Map<string, number>(); for (const row of rows.filter(row => row.status === status)) {
        const currency = String(row.currency ?? 'EUR');
        amounts.set(currency, (amounts.get(currency) ?? 0) + Number(row.amount_cents ?? 0));
    } return [...amounts].map(([currency, value]) => consoleMoney(value, currency)).join(' · ') || consoleMoney(0); };
    const base = { label: 'Geladene Einträge', value: rows.length };
    if (section === 'billing')
        return [base, { label: 'Offen / teilbezahlt', value: rows.filter(row => ['open', 'past_due', 'partially_paid'].includes(String(row.status))).length }, { label: 'Überfällig', value: count('status', 'past_due') }, { label: 'Bezahlte Rechnungen', value: count('status', 'paid') }];
    if (section === 'payments')
        return [base, { label: 'Erfolgreiche Zahlungen', value: sum('succeeded') }, { label: 'Ausstehend', value: count('status', 'pending') }, { label: 'Fehlgeschlagen', value: count('status', 'failed') }];
    if (section === 'users')
        return [base, { label: 'Aktive Zugriffe', value: count('status', 'active') }, { label: 'Aktive Inhaber', value: rows.filter(row => row.role === 'platform_owner' && row.status === 'active').length }, { label: 'Deaktiviert / entzogen', value: rows.filter(row => row.status !== 'active').length }];
    if (section === 'tenants')
        return [base, { label: 'Aktiv', value: count('status', 'active'), hint: 'Auf dieser Datenseite' }, { label: 'In Einrichtung', value: count('lifecycleStatus', 'onboarding'), hint: 'Auf dieser Datenseite' }, { label: 'Kostenlose Nutzung', value: rows.length, hint: 'Auf dieser Datenseite' }];
    if (section === 'feature-flags')
        return [base, { label: 'Aktiviert', value: count('enabled', true) }, { label: 'Plattformweit', value: count('scope', 'global') }, { label: 'Mandantenbezogen', value: count('scope', 'tenant') }];
    if (section === 'system')
        return [base, { label: 'Geschützte Werte', value: rows.filter(isSensitiveSetting).length }, { label: 'Wartung', value: rows.find(row => row.setting_key === 'maintenance_mode')?.value === true ? 'Eingeschaltet' : rows.some(row => row.setting_key === 'maintenance_mode') ? 'Ausgeschaltet' : 'Nicht hinterlegt' }];
    if (section === 'releases')
        return [base, { label: 'Bereit', value: count('status', 'ready') }, { label: 'Fehlgeschlagen', value: count('status', 'failed') }, { label: 'Produktion', value: count('environment', 'production') }];
    if (section === 'discounts')
        return [base, { label: 'Aktive Konditionen', value: count('status', 'active') }, { label: 'Zuweisungen', value: related.length }, { label: 'Aktive Zuweisungen', value: related.filter(row => row.status === 'active').length }];
    if (section === 'modules')
        return [base, { label: 'Verfügbar', value: count('status', 'available') }, { label: 'In Beta', value: count('status', 'beta') }, { label: 'Grundfunktionen', value: count('is_core', true) }];
    if (section === 'plans')
        return [base, { label: 'Kostenlose Modelle', value: rows.filter(row => Number(row.monthly_price_cents) === 0 && Number(row.yearly_price_cents) === 0).length }, { label: 'Aktive Modelle', value: count('status', 'active') }];
    if (section === 'audit')
        return [base, { label: 'Verschiedene Aktionen', value: new Set(rows.map(row => row.action)).size }, { label: 'Betroffene Mandanten', value: new Set(rows.filter(row => row.tenant_id).map(row => row.tenant_id)).size }];
    return [base, { label: 'Aktiv', value: count('status', 'active') }, { label: 'Archiviert', value: count('status', 'archived') }];
}
function ConsoleActionEditor({ action, onClose, onSaved }: {
    action: ConsoleAction;
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(action.fields.map(field => [field.key, field.value ?? ''])));
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const lock = useRef(false);
    const saved = useRef(false);
    const dirty = Boolean(reason.trim()) || action.fields.some(field => values[field.key] !== (field.value ?? ''));
    const confirmLeave = useUnsavedWebChanges(dirty && !saved.current, busy);
    const close = async () => { if (await confirmLeave())
        onClose(); };
    const valid = action.fields.every(field => !field.required || Boolean(values[field.key]?.trim())) && reason.trim().length >= 5;
    async function submit() {
        if (lock.current || !valid || saved.current)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            await action.run(values, reason.trim());
            saved.current = true;
            await onSaved();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Die Änderung konnte nicht gespeichert werden.');
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    return <ConsoleDialog title={action.title} description={action.description} busy={busy} onClose={() => void close()} footer={<><NativeSmall>{busy ? 'Speicherung läuft. Bitte warten.' : 'Die Änderung wird mit Ihrer Begründung protokolliert.'}</NativeSmall><NativeDiv className="cs-actions"><NativeButton className="cs-btn" disabled={busy} onClick={() => void close()}>Abbrechen</NativeButton><NativeButton type="submit" form="console-action-form" className={`cs-btn ${action.danger ? 'danger' : 'primary'}`} disabled={busy || !valid || getServiceMode() === 'demo'}>{busy ? 'Wird gespeichert…' : 'Speichern'}</NativeButton></NativeDiv></>}>
    <NativeForm id="console-action-form" onSubmit={event => { event.preventDefault(); void submit(); }}><NativeDiv className="cs-form-grid">{action.fields.map(field => <NativeLabel className={`cs-field ${field.type === 'textarea' ? 'wide' : ''}`} key={field.key}>{field.label}{field.required ? ' *' : ''}{field.type === 'select' ? <NativeSelect required={field.required} disabled={busy} value={values[field.key]} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}><NativeOption value="">Bitte auswählen</NativeOption>{field.options?.map(option => <NativeOption value={option.value} key={option.value}>{option.label === 'not_checked' ? 'Nicht geprüft' : option.label === 'passed' ? 'Bestanden' : option.label === 'true' ? 'Ja' : option.label === 'false' ? 'Nein' : option.label}</NativeOption>)}</NativeSelect> : field.type === 'textarea' ? <NativeTextarea required={field.required} disabled={busy} value={values[field.key]} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}/> : <NativeInput type={field.type ?? 'text'} required={field.required} disabled={busy} min={field.min} max={field.max} step={field.type === 'number' ? 'any' : undefined} value={values[field.key]} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}/>}{field.hint && <NativeSmall>{field.hint}</NativeSmall>}</NativeLabel>)}<NativeLabel className="cs-field wide">Begründung *<NativeTextarea required minLength={5} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} placeholder="Anlass, Vereinbarung oder Grundlage dieser Änderung"/><NativeSmall>Mindestens fünf Zeichen. Die Begründung bleibt im Änderungsprotokoll nachvollziehbar.</NativeSmall></NativeLabel></NativeDiv></NativeForm>
    {error && <NativeDiv className="cs-notice error" role="alert">{error}<NativeP>Die Eingaben bleiben erhalten. Prüfen Sie bei einem Verbindungsabbruch zunächst den tatsächlichen Datenstand, bevor Sie erneut speichern.</NativeP></NativeDiv>}
  </ConsoleDialog>;
}
const DETAIL_FIELDS: Partial<Record<ConsoleSection, [
    string,
    string
][]>> = {
    modules: [['module_key', 'Technischer Schlüssel'], ['description', 'Beschreibung'], ['category', 'Kategorie'], ['status', 'Freigabe'], ['is_core', 'Grundfunktion'], ['is_beta', 'Beta'], ['is_internal', 'Intern'], ['default_enabled', 'Standardmäßig aktiviert'], ['requires_module_keys', 'Voraussetzungen'], ['incompatible_module_keys', 'Unvereinbare Funktionen']],
    billing: [['invoice_number', 'Rechnungsnummer'], ['tenant_label', 'Unternehmen'], ['status', 'Status'], ['currency', 'Währung'], ['due_at', 'Fälligkeit'], ['issued_at', 'Ausgestellt'], ['paid_at', 'Bezahlt am']],
    payments: [['tenant_label', 'Unternehmen'], ['invoice_label', 'Rechnung'], ['status', 'Status'], ['provider', 'Zahlungsquelle'], ['payment_method', 'Zahlungsweg'], ['failure_reason', 'Fehlergrund'], ['created_at', 'Erfasst']],
    'feature-flags': [['flag_key', 'Technischer Schlüssel'], ['scope', 'Geltungsbereich'], ['tenant_label', 'Unternehmen'], ['enabled', 'Aktiviert'], ['rollout_label', 'Freigabeanteil'], ['starts_at', 'Beginn'], ['ends_at', 'Ende'], ['updated_at', 'Zuletzt geändert']],
    users: [['full_name', 'Name'], ['email', 'E-Mail'], ['role', 'Rolle'], ['status', 'Zugriff'], ['last_login_at', 'Letzte Anmeldung'], ['updated_at', 'Geändert']],
    releases: [['version_label', 'Version'], ['environment', 'Umgebung'], ['status', 'Status'], ['commit_sha', 'Git-Commit'], ['migration_version', 'Datenbankstand'], ['deployed_at', 'Registriert'], ['notes', 'Prüfnotiz']],
    audit: [['action', 'Aktion'], ['created_at', 'Zeitpunkt'], ['actor_user_id', 'Ausführender Benutzer'], ['actor_role', 'Ausführende Rolle'], ['tenant_label', 'Unternehmen'], ['tenant_id', 'Unternehmens-ID'], ['target_type', 'Zielbereich'], ['target_id', 'Ziel-ID'], ['reason', 'Begründung']],
    system: [['display_name', 'Einstellung'], ['setting_key', 'Schlüssel'], ['display_value', 'Aktueller Wert'], ['description', 'Bedeutung'], ['is_sensitive', 'Geschützter Wert'], ['updated_at', 'Geändert']],
    discounts: [['discount_name', 'Bezeichnung'], ['discount_key', 'Code'], ['discount_type', 'Art'], ['display_value', 'Wert'], ['status', 'Status'], ['description', 'Beschreibung']],
    plans: [['plan_name', 'Vertragsmodell'], ['plan_key', 'Kennung'], ['description', 'Beschreibung'], ['status', 'Status'], ['is_public', 'Öffentlich'], ['included_module_keys', 'Enthaltene Funktionen']],
    addons: [['addon_name', 'Erweiterung'], ['addon_key', 'Kennung'], ['description', 'Beschreibung'], ['status', 'Status']],
};
function ConsoleDetail({ section, row, data, role, onClose, onAction }: {
    section: ConsoleSection;
    row: ConsoleRow;
    data: ConsoleData;
    role: PlatformRoleKey | undefined;
    onClose: () => void;
    onAction: (action: ConsoleAction) => void;
}) {
    const router = useRouter();
    const actions = consoleActions(section, row, data).filter(action => api.platformRoleHasCapability(role, action.capability));
    const title = section === 'audit' ? platformActionLabel(row.action) : section === 'plans' ? platformName(row.plan_key, String(row.plan_name || 'Individueller Tarif')) : String(row[PRIMARY_KEYS[section] ?? 'id'] ?? CONSOLE_SECTIONS[section].title);
    const fields = DETAIL_FIELDS[section] ?? [];
    const safeRow = redactConsoleValue(row) as ConsoleRow;
    return <ConsoleDialog title={title} description={CONSOLE_SECTIONS[section].subtitle} onClose={onClose} footer={<><NativeDiv className="cs-actions">{Boolean(row.tenant_id) && api.platformRoleHasCapability(role, 'tenants.read') && <NativeButton className="cs-btn" onClick={() => router.push(`/platform/tenants/${encodeURIComponent(String(row.tenant_id))}` as never)}>Unternehmensakte</NativeButton>}{section !== 'audit' && api.platformRoleHasCapability(role, 'audit.read') && <NativeButton className="cs-btn" onClick={() => router.push(api.buildPlatformAuditPath({ tenantId: row.tenant_id ? String(row.tenant_id) : undefined }) as never)}>Änderungsprotokoll öffnen</NativeButton>}</NativeDiv><NativeButton className="cs-btn" onClick={onClose}>Schließen</NativeButton></>}>
    <NativeDl className="cs-kv">{fields.map(([key, label]) => <NativeDiv key={key} style={{ display: 'contents' }}><NativeDt>{label}</NativeDt><NativeDd>{key === 'action' ? platformActionLabel(safeRow[key]) : key.endsWith('_at') ? consoleDate(safeRow[key]) : consoleText(safeRow[key])}</NativeDd></NativeDiv>)}</NativeDl>
    {['billing', 'payments'].includes(section) && <ConsoleStats items={[{ label: 'Betrag', value: consoleMoney(row.amount_cents, row.currency) }, ...(section === 'billing' ? [{ label: 'Netto', value: consoleMoney(row.net_cents, row.currency) }, { label: 'Steuer', value: consoleMoney(row.tax_cents, row.currency) }] : [])]}/>}
    {actions.length > 0 && <NativeDiv className="cs-actions">{actions.map(action => <NativeButton className={`cs-btn ${action.danger ? 'danger' : 'primary'}`} key={action.key} disabled={getServiceMode() === 'demo'} onClick={() => onAction(action)}>{action.title}</NativeButton>)}</NativeDiv>}
    {section === 'audit' && <NativeDetails><NativeSummary>Technische Einzelheiten der Änderung</NativeSummary><NativeDiv className="cs-columns"><NativeSection><NativeH3>Vor der Änderung</NativeH3><ConsoleJson value={redactConsoleValue(row.before)}/></NativeSection><NativeSection><NativeH3>Nach der Änderung</NativeH3><ConsoleJson value={redactConsoleValue(row.after)}/></NativeSection></NativeDiv></NativeDetails>}
    {section === 'billing' && typeof row.invoice_url === 'string' && /^https:\/\//i.test(row.invoice_url) && <NativeA className="cs-btn" href={row.invoice_url} target="_blank" rel="noreferrer noopener">Rechnungsdokument öffnen ↗</NativeA>}
    {section === 'releases' && <><NativeH3>Dokumentierte Prüfergebnisse</NativeH3><ConsoleJson value={row.checks}/>{typeof row.deployment_url === 'string' && /^https:\/\//i.test(row.deployment_url) && <NativeA className="cs-btn" href={row.deployment_url} target="_blank" rel="noreferrer noopener">Bereitstellung öffnen ↗</NativeA>}</>}
    {section === 'plans' && <ConsolePanel title="Hinterlegte Tarifgrundlage" description="Die Preise stammen aus dem aktuellen Katalog; frühere Zuweisungen behalten ihren gespeicherten Vertragsstand."><NativeDiv className="cs-panel-body"><ConsoleStats items={[{ label: 'Monatspreis', value: consoleMoney(row.monthly_price_cents, row.currency) }, { label: 'Jahrespreis', value: consoleMoney(row.yearly_price_cents, row.currency) }]}/><NativeP>Enthaltene Funktionen: {Array.isArray(row.included_module_keys) && row.included_module_keys.length ? row.included_module_keys.map(key => platformName(key, 'Funktionsbereich')).join(', ') : 'Keine gesonderten Funktionen hinterlegt'}</NativeP></NativeDiv></ConsolePanel>}
    {section === 'addons' && <ConsoleVersions section={section} row={row} role={role} onAction={onAction}/>}
    {section === 'billing' && <ConsolePanel title="Zugeordnete Zahlungen"><NativeDiv className="cs-panel-body">{data.related.filter(payment => payment.invoice_id === row.id).map(payment => <NativeDiv className="cs-task" key={String(payment.id)}><NativeDiv><NativeB>{consoleMoney(payment.amount_cents, payment.currency)}</NativeB><NativeP>{consoleDate(payment.created_at)} · {consoleLabel(payment.payment_method)}</NativeP></NativeDiv><ConsoleBadge value={payment.status} label={consoleLabel(payment.status)}/></NativeDiv>)}{!data.related.some(payment => payment.invoice_id === row.id) && <NativeP className="cs-muted">Keine zugeordneten Zahlungen in den verfügbaren Daten.</NativeP>}</NativeDiv></ConsolePanel>}
    {section === 'discounts' && <DiscountAssignments data={{ ...data, related: data.related.filter(item => item.discount_key === row.discount_key) }} role={role} onAction={onAction}/>}
    {section === 'users' && <RoleMatrix selectedRole={String(row.role)}/>}
    {section === 'addons' && <AddonAssignments data={{ ...data, related: data.related.filter(item => item.addon_key === row.addon_key) }} role={role} onAction={onAction}/>}
  </ConsoleDialog>;
}
function ConsoleVersions({ row }: {
    section: ConsoleSection;
    row: ConsoleRow;
    role: PlatformRoleKey | undefined;
    onAction: (action: ConsoleAction) => void;
}) {
    const [versions, setVersions] = useState<ConsoleRow[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [versionId, setVersionId] = useState('');
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        loadConsoleVersions('addons', row).then(rows => { if (active) {
            setVersions(rows);
            setVersionId(String(rows[0]?.id ?? ''));
        } })
            .catch(cause => { if (active)
            setError(cause.message); }).finally(() => { if (active)
            setLoading(false); });
        return () => { active = false; };
    }, [row]);
    const selected = versions.find(version => version.id === versionId);
    return <ConsolePanel title="Preisentwicklung" description="Dokumentierte Preise und ihre Gültigkeit"><NativeDiv className="cs-panel-body">
    {loading ? <NativeP role="status">Preise werden geladen…</NativeP> : error ? <NativeP className="cs-notice error" role="alert">{error}</NativeP> : !versions.length ? <NativeP>Noch keine Preise hinterlegt.</NativeP> : <>
      <NativeLabel className="cs-field">Preisstand auswählen<NativeSelect value={versionId} onChange={event => setVersionId(event.target.value)}>{versions.map(version => <NativeOption key={String(version.id)} value={String(version.id)}>Preisstand {String(version.version_number)} · {consoleLabel(version.status)} · {consoleDate(version.effective_from)}</NativeOption>)}</NativeSelect></NativeLabel>
      {selected ? <ConsoleStats items={[{ label: 'Monat', value: consoleMoney(selected.monthly_price_cents, selected.currency) }, { label: 'Jahr', value: consoleMoney(selected.yearly_price_cents, selected.currency) }, { label: 'Gültig ab', value: consoleDate(selected.effective_from) }]}/> : null}
    </>}
  </NativeDiv></ConsolePanel>;
}
function AddonAssignments({ data, role, onAction }: {
    data: ConsoleData;
    role: PlatformRoleKey | undefined;
    onAction: (action: ConsoleAction) => void;
}) {
    return <ConsolePanel title="Zugeordnete Unternehmen" description="Vertragsstand und Laufzeit der Erweiterungen"><NativeDiv className="cs-panel-body">
    {!data.related.length && <NativeP className="cs-muted">Keine Zuweisungen vorhanden.</NativeP>}
    {data.related.map(item => <NativeDiv className="cs-task" key={String(item.id)}><NativeDiv><NativeB>{String(item.tenant_label)} · {String(data.rows.find(row => row.addon_key === item.addon_key)?.addon_name || platformName(item.addon_key, 'Zusatzpaket'))}</NativeB><NativeP>{consoleLabel(item.billing_interval)} · {consoleDate(item.starts_at ?? item.created_at)}{item.ends_at ? ` bis ${consoleDate(item.ends_at)}` : ''}</NativeP><ConsoleBadge value={item.status} label={consoleLabel(item.status)}/></NativeDiv>
      {!['cancelled', 'revoked', 'expired'].includes(String(item.status)) && api.platformRoleHasCapability(role, 'plans.write') && <NativeButton className="cs-btn danger" disabled={getServiceMode() === 'demo'} onClick={() => onAction({ key: 'remove-addon', title: 'Erweiterung beenden', description: `${item.addon_key} für ${item.tenant_label} beenden. Die Begründung dokumentiert die Vertragsgrundlage.`, capability: 'plans.write', danger: true, fields: [], run: async (_, reason) => { const result = await api.removePlatformAddonFromTenant(String(item.tenant_id), String(item.addon_key), reason); if (!result.ok)
                throw new Error(result.error); return result.data; } })}>Beenden</NativeButton>}
    </NativeDiv>)}
  </NativeDiv></ConsolePanel>;
}
function DiscountAssignments({ data, role, onAction }: {
    data: ConsoleData;
    role: PlatformRoleKey | undefined;
    onAction: (action: ConsoleAction) => void;
}) {
    return <ConsolePanel title="Mandantenzuweisungen" description="Geltungsdauer und Widerruf bestehender Sonderkonditionen"><NativeDiv className="cs-panel-body">{!data.related.length ? <NativeP className="cs-muted">Keine Zuweisungen vorhanden.</NativeP> : data.related.map(row => <NativeDiv className="cs-task" key={String(row.id)}><NativeDiv><NativeB>{String(row.tenant_label)} · {String(row.discount_key)}</NativeB><NativeP>{consoleDate(row.starts_at)} bis {row.ends_at ? consoleDate(row.ends_at) : 'unbefristet'}</NativeP><ConsoleBadge value={row.status} label={consoleLabel(row.status)}/></NativeDiv>{['active', 'scheduled'].includes(String(row.status)) && api.platformRoleHasCapability(role, 'discounts.write') && <NativeButton className="cs-btn danger" disabled={getServiceMode() === 'demo'} onClick={() => onAction({ key: 'revoke-discount', title: 'Sonderkondition widerrufen', description: `${row.discount_key} für ${row.tenant_label} widerrufen. Der Vorgang bleibt protokolliert.`, capability: 'discounts.write', fields: [], danger: true, run: async (_, reason) => { const result = await api.removePlatformDiscount(String(row.tenant_id), String(row.discount_key), reason); if (!result.ok)
            throw new Error(result.error); return result.data; } })}>Widerrufen</NativeButton>}</NativeDiv>)}</NativeDiv></ConsolePanel>;
}
const MATRIX: [
    string,
    PlatformCapability,
    PlatformCapability?
][] = [['Veröffentlichungen', 'releases.read'], ['Unternehmen', 'tenants.read', 'tenants.write'], ['Funktionen', 'modules.read', 'modules.write'], ['Support', 'support.read', 'support.write'], ['Benutzer', 'users.read', 'users.write'], ['System', 'system.read', 'system.write'], ['Änderungsprotokoll', 'audit.read'], ['Freigaben', 'flags.read', 'flags.write']];
function RoleMatrix({ selectedRole }: {
    selectedRole?: string;
}) {
    const roles = Object.keys(api.PLATFORM_ROLE_LABELS).filter(role => !selectedRole || role === selectedRole) as PlatformRoleKey[];
    return <ConsolePanel title="Rollen & Berechtigungen" description="Lesen und Bearbeiten nach Bereich"><NativeDiv className="cs-table-scroll"><NativeTable className="cs-table cs-role-table"><NativeThead><NativeTr><NativeTh>Bereich</NativeTh>{roles.map(role => <NativeTh key={role}>{consoleLabel(role)}</NativeTh>)}</NativeTr></NativeThead><NativeTbody>{MATRIX.map(([label, read, write]) => <NativeTr key={label}><NativeTd>{label}</NativeTd>{roles.map(role => <NativeTd key={role}>{write && api.platformRoleHasCapability(role, write) ? 'Lesen & bearbeiten' : api.platformRoleHasCapability(role, read) ? 'Lesen' : 'Kein Zugriff'}</NativeTd>)}</NativeTr>)}</NativeTbody></NativeTable></NativeDiv></ConsolePanel>;
}
function ConsoleDashboard({ data, loading, role, onRefresh }: {
    data: ConsoleData;
    loading: boolean;
    role: PlatformRoleKey | undefined;
    onRefresh: () => void;
}) {
    const router = useRouter();
    const summary = data.summary;
    if (!summary)
        return <ConsolePanel title="Betriebsübersicht"><NativeDiv className="cs-panel-body"><NativeP>{loading ? 'Die Betriebsdaten werden abgefragt.' : 'Die Betriebsübersicht konnte noch nicht geladen werden.'}</NativeP><NativeButton className="cs-btn" disabled={loading} onClick={onRefresh}>Aktualisieren</NativeButton></NativeDiv></ConsolePanel>;
    const tasks = [
        { title: 'Neue Unternehmen einrichten', value: summary.tenants.onboarding, text: 'Registrierungen prüfen und die Einrichtung begleiten.', path: '/platform/tenants', cap: 'tenants.read' },
        { title: 'Gesperrte Zugänge prüfen', value: summary.tenants.suspended, text: 'Grund, Status und weitere Bearbeitung in der Unternehmensakte prüfen.', path: '/platform/tenants?status=suspended', cap: 'tenants.read' },
        { title: 'Support bearbeiten', value: summary.system.activeSupportSessions, text: 'Supporttickets und genehmigte Zugriffe im Support-Arbeitsbereich öffnen.', path: '/platform/support', cap: 'support.read' },
    ].filter(task => api.platformRoleHasCapability(role, task.cap as PlatformCapability));
    return <>
    <PlatformOperationsPanel />
    <ConsoleStats items={[{ label: 'Aktive Unternehmen', value: summary.tenants.active }, { label: 'In Einrichtung', value: summary.tenants.onboarding }, { label: 'Gespeicherte Funktionsfreigaben', value: summary.system.activeFeatureFlags }, { label: 'Wartungseinstellung', value: summary.system.maintenanceMode ? 'Gespeichert: ein' : 'Gespeichert: aus' }]}/>
    {summary.system.maintenanceMode && <NativeDiv className="cs-notice">Die Wartungseinstellung ist eingeschaltet. Die vollständige Umsetzung in Website und Software ist noch offen; prüfen Sie den tatsächlichen Zugang im Bereich System.</NativeDiv>}
    <NativeDiv className="cs-columns"><ConsolePanel title="Jetzt bearbeiten" description="Offene Vorgänge nach Zuständigkeit" actions={<NativeButton className="cs-btn" disabled={loading} onClick={onRefresh}>↻ Aktualisieren</NativeButton>}><NativeDiv className="cs-panel-body">{tasks.map(task => <NativeDiv className="cs-task" key={task.title}><NativeDiv><NativeButton className="cs-link" onClick={() => router.push(task.path as never)}>{task.title}</NativeButton><NativeP>{task.text}</NativeP></NativeDiv><NativeStrong>{task.value}</NativeStrong></NativeDiv>)}</NativeDiv></ConsolePanel>
      <ConsolePanel title="Letzte Änderungen" description="Zuletzt protokollierte Plattformaktionen" actions={api.platformRoleHasCapability(role, 'audit.read') && <NativeButton className="cs-link" onClick={() => router.push('/platform/audit' as never)}>Gesamten Verlauf öffnen</NativeButton>}><NativeDiv className="cs-panel-body">{data.related.map(row => <NativeDiv className="cs-task" key={String(row.id)}><NativeDiv><NativeB>{platformActionLabel(row.action)}</NativeB><NativeP>{consoleDate(row.created_at)} · {consoleLabel(row.actor_role)}</NativeP><NativeP>{consoleText(row.reason)}</NativeP></NativeDiv></NativeDiv>)}{!data.related.length && <NativeP className="cs-muted">Keine zugänglichen Protokolleinträge vorhanden.</NativeP>}</NativeDiv></ConsolePanel></NativeDiv>
    <ConsolePanel title="Arbeitsbereiche" description="Direkt zur passenden Verwaltung"><NativeDiv className="cs-panel-body"><NativeDiv className="cs-columns">{Object.entries(CONSOLE_SECTIONS).filter(([key, info]) => key !== 'dashboard' && !isRetiredPlatformSection(key) && (!info.capability || api.platformRoleHasCapability(role, info.capability))).map(([key, info]) => <NativeDiv className="cs-task" key={key}><NativeDiv><NativeButton className="cs-link" onClick={() => router.push(`/platform/${key}` as never)}>{info.title}</NativeButton><NativeP>{info.subtitle}</NativeP></NativeDiv><NativeSpan aria-hidden>↗</NativeSpan></NativeDiv>)}</NativeDiv></NativeDiv></ConsolePanel>
  </>;
}
