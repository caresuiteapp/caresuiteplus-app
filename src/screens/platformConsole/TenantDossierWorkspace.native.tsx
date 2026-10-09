import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { ListFilterSelect } from '@/components/ui/ListFilterSelect';
import { PLATFORM_COLORS as C } from '@/components/platformConsole/PlatformColors';
import { consoleDate, consoleLabel } from '@/lib/platformConsole/consoleWorkspaceModel';
import { platformActionLabel } from '@/lib/platformConsole/platformLanguage';
import { getTenantDossier, getTenantDossierPage, type DossierQuery } from '@/lib/platformConsole/tenantDossierService';
import { buildTenantSetup, dossierChangedFields, dossierFieldLabel, dossierPersonCompleteness, dossierRowName, safeDossierLogo, visibleDossierFields, type DossierPage, type DossierRow, type DossierScope, type TenantDossier } from '@/lib/platformConsole/tenantDossierModel';
import type { ServiceResult } from '@/types/core/base';

export type DossierView = 'company' | 'setup' | 'clients' | 'employees' | 'history';

function useRequest<T>(key: string, fetch: () => Promise<ServiceResult<T>>, enabled = true, delay = 0, revision?: unknown) {
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null; loading: boolean }>({ key: '', data: null, error: null, loading: false });
  const [retry, setRetry] = useState(0);
  const request = useRef(0), fetchRef = useRef(fetch);
  fetchRef.current = fetch;
  useEffect(() => {
    const current = ++request.current;
    if (!enabled) return;
    setState({ key, data: null, error: null, loading: true });
    const timer = setTimeout(() => {
      void fetchRef.current().then(result => {
        if (current !== request.current) return;
        setState(result.ok ? { key, data: result.data, error: null, loading: false } : { key, data: null, error: result.error, loading: false });
      }).catch(cause => {
        if (current === request.current) setState({ key, data: null, error: cause instanceof Error ? cause.message : 'Die Angaben konnten nicht geladen werden.', loading: false });
      });
    }, delay);
    return () => { clearTimeout(timer); request.current++; };
  }, [key, enabled, delay, retry, revision]);
  return { data: enabled && state.key === key ? state.data : null, error: enabled && state.key === key ? state.error : null, loading: enabled && (state.key !== key || state.loading), reload: () => setRetry(value => value + 1) };
}

export function useTenantDossier(tenantId: string, enabled: boolean, revision?: unknown) {
  return useRequest(tenantId, () => getTenantDossier(tenantId), enabled, 0, revision);
}

function useDossierPage(tenantId: string, query: DossierQuery) {
  return useRequest(JSON.stringify([tenantId, query]), () => getTenantDossierPage(tenantId, query), true, query.search ? 250 : 0);
}

function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, disabled && s.disabled]}><Text style={s.buttonText}>{label}</Text></Pressable>;
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <View style={s.panel}><Text accessibilityRole="header" style={s.title}>{title}</Text>{hint ? <Text style={s.muted}>{hint}</Text> : null}{children}</View>;
}

function Progress({ value, label }: { value: number; label: string }) {
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: value }} style={s.progress}><View style={[s.progressFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View>;
}

function State({ loading, error, reload }: { loading: boolean; error: string | null; reload: () => void }) {
  if (loading) return <View style={s.state} accessibilityLiveRegion="polite"><ActivityIndicator color={C.accent} /><Text style={s.muted}>Angaben werden geladen…</Text></View>;
  if (error) return <View style={s.state}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Button label="Erneut laden" onPress={reload} /></View>;
  return null;
}

export function TenantDossierHeader({ dossier, onOpen }: { dossier: TenantDossier; onOpen: (view: DossierView) => void }) {
  const setup = buildTenantSetup(dossier), name = String(dossier.company.name ?? dossier.platform.tenant_name ?? 'Unternehmen');
  const raw = safeDossierLogo(dossier.branding?.logo_url), logo = raw?.startsWith('/') ? 'https://www.caresuiteplus.app' + raw : raw;
  return <Panel title={name} hint={`Unternehmensakte · Stand ${consoleDate(dossier.checkedAt)}`}>
    <View style={s.row}>{logo ? <Image source={{ uri: logo }} style={s.logo} contentFit="contain" cachePolicy="memory" allowDownscaling recyclingKey={dossier.tenantId + logo} accessibilityLabel={`Logo ${name}`} /> : <Text style={s.initial}>{name.slice(0, 1)}</Text>}<View style={s.grow}><Text style={s.percentage}>{setup.percentage}% eingerichtet</Text><Text style={s.muted}>{setup.complete} von {setup.applicable} Prüfschritten vollständig · {setup.partial} teilweise · {setup.open} offen</Text><Progress value={setup.percentage} label="Einrichtungsstand" /></View></View>
    <Text style={s.body}>{dossier.counts.clients.total} Klient:innen · {dossier.counts.employees.total} Mitarbeitende · {dossier.counts.accounts} Konten</Text>
    <View style={s.row}><Button label="Einrichtung prüfen" onPress={() => onOpen('setup')} /><Button label="Alle Unternehmensdaten" onPress={() => onOpen('company')} /></View>
  </Panel>;
}

export function TenantDossierOverview({ dossier, onOpen }: { dossier: TenantDossier; onOpen: (view: DossierView) => void }) {
  const setup = buildTenantSetup(dossier);
  return <Panel title="Unternehmen im Überblick" hint="Der Prozentstand bewertet gespeicherte Grundangaben. Teilangaben werden anteilig gewertet; er ist keine Geräte- oder Funktionsfreigabe.">
    <View style={s.row}>{([['clients', 'Klient:innen öffnen'], ['employees', 'Mitarbeitende öffnen'], ['history', 'Schritte nachvollziehen']] as const).map(([key, label]) => <Button key={key} label={label} onPress={() => onOpen(key)} />)}</View>
    <Text style={s.body}>{dossier.counts.assignments ?? '—'} Einsätze · {dossier.counts.documents ?? '—'} Dokumente · {dossier.counts.services} aktive Leistungen</Text>
    {setup.groups.map(group => <View key={group.label} style={s.card}><Text style={s.label}>{group.label} · {group.percentage}%</Text><Progress value={group.percentage} label={`Einrichtung ${group.label}`} /><Text style={s.muted}>{group.complete} von {group.total} Schritten vollständig</Text></View>)}
    <Text style={s.muted}>{dossier.sections.filter(section => section.available).length} verfügbare Datenbereiche</Text>
  </Panel>;
}

export function TenantSetupPanel({ dossier, onSection }: { dossier: TenantDossier; onSection: (section: string) => void }) {
  const setup = buildTenantSetup(dossier), [filter, setFilter] = useState('all');
  const steps = setup.steps.filter(step => filter === 'all' || (filter === 'missing' ? ['open', 'partial'].includes(step.state) : step.state === filter));
  return <Panel title="Einrichtung Schritt für Schritt" hint={`${setup.percentage}% · ${setup.complete} vollständig · ${setup.partial} teilweise · ${setup.open} offen`}>
    <ListFilterSelect label="Ansicht" value={filter} onChange={setFilter} options={[{ key: 'all', label: 'Alle Schritte' }, { key: 'missing', label: 'Offen und teilweise' }, { key: 'complete', label: 'Vollständig' }, { key: 'not_applicable', label: 'Nicht anwendbar' }]} />
    {steps.map(step => <View key={step.key} style={s.card}><Text style={s.muted}>{step.group}</Text><Text style={s.label}>{step.label}</Text><Text style={s.body}>{step.state === 'complete' ? 'Vollständig' : step.state === 'partial' ? `Teilweise · ${Math.round(step.score * 100)}%` : step.state === 'open' ? 'Offen' : 'Nicht anwendbar'}</Text><Text style={s.body}>{step.evidence}</Text>{step.missing.map(item => <Text key={item} style={s.muted}>• {item}</Text>)}<Text style={s.muted}>Nachweis: {step.source}</Text><Button label={`Daten prüfen: ${step.label}`} onPress={() => onSection(step.section)} /></View>)}
    {!steps.length ? <Text style={s.muted}>Keine Prüfschritte für diese Ansicht.</Text> : null}
  </Panel>;
}

function searchable(value: unknown): string {
  if (Array.isArray(value)) return value.map(searchable).join(' ');
  if (value && typeof value === 'object') return visibleDossierFields(value as DossierRow).map(([key, item]) => dossierFieldLabel(key) + ' ' + searchable(item)).join(' ');
  return value == null ? '' : String(value);
}

function Fold({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={s.stack}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={s.button}><Text style={s.buttonText}>{open ? '▾' : '▸'} {label}</Text></Pressable>{open ? children : null}</View>;
}

function Value({ value, field }: { value: unknown; field?: string }) {
  const [linkError, setLinkError] = useState(false);
  if (value == null || value === '') return <Text style={s.muted}>Nicht hinterlegt</Text>;
  if (typeof value === 'boolean') return <Text style={s.body}>{value ? 'Ja' : 'Nein'}</Text>;
  if (typeof value === 'number') return <Text selectable style={s.body}>{value.toLocaleString('de-DE', { maximumFractionDigits: 6 })}</Text>;
  if (Array.isArray(value)) return value.length ? <Fold label={`${value.length} Einträge anzeigen`}>{value.map((item, index) => <View key={index} style={s.nested}><Value value={item} /></View>)}</Fold> : <Text style={s.muted}>Keine Einträge</Text>;
  if (typeof value === 'object') return <Fold label="Weitere Angaben anzeigen">{visibleDossierFields(value as DossierRow).map(([key, item]) => <View key={key} style={s.nested}><Text style={s.label}>{dossierFieldLabel(key)}</Text><Value value={item} field={key} /></View>)}</Fold>;
  const text = String(value);
  if (field && /(_at|_date|date_of_birth|valid_from|valid_to|service_start)$/.test(field) && /^\d{4}-\d{2}-\d{2}/.test(text)) return <Text selectable style={s.body}>{/^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`).toLocaleDateString('de-DE') : consoleDate(text)}</Text>;
  if (/^https?:\/\//i.test(text) && safeDossierLogo(text)) return <View style={s.stack}><Text selectable style={s.body}>{text}</Text><Button label="Adresse öffnen" onPress={() => { setLinkError(false); void Linking.openURL(text).catch(() => setLinkError(true)); }} />{linkError ? <Text accessibilityRole="alert" style={s.error}>Die Adresse konnte nicht geöffnet werden.</Text> : null}</View>;
  return <Text selectable style={s.body}>{field && ['status', 'role_key', 'employment_type', 'product_key', 'billing_party', 'gender'].includes(field) ? consoleLabel(value) : text}</Text>;
}

export function TenantDossierFields({ row }: { row: DossierRow }) {
  const [search, setSearch] = useState(''), [showEmpty, setShowEmpty] = useState(true), [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const all = visibleDossierFields(row), populated = all.filter(([, value]) => value != null && value !== '' && (!Array.isArray(value) || value.length));
  const fields = all.filter(([key, value]) => (showEmpty || populated.some(([name]) => name === key)) && (dossierFieldLabel(key) + ' ' + key + ' ' + searchable(value)).toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE')));
  return <View style={s.stack} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <Text style={s.label}>Angabe suchen</Text><TextInput accessibilityLabel="Angabe suchen" style={s.input} value={search} onChangeText={setSearch} placeholder="Adresse, Pflegegrad, IBAN…" placeholderTextColor={C.muted} />
    <View style={s.row}><Switch accessibilityLabel="Leere Angaben anzeigen" value={showEmpty} onValueChange={setShowEmpty} /><Text style={s.body}>Leere Angaben anzeigen</Text></View><Text style={s.muted}>{populated.length} von {all.length} Feldern befüllt</Text>
    <View style={s.row}>{fields.map(([key, value]) => <View key={key} style={[s.card, { width: width >= 740 * Math.max(1, fontScale) ? '48%' : '100%' }]}><Text style={s.label}>{dossierFieldLabel(key)}</Text><Value value={value} field={key} /></View>)}</View>
    {!fields.length ? <Text style={s.muted}>Keine passenden Angaben.</Text> : null}
  </View>;
}

function Pager({ data, offset, onOffset, loading }: { data: DossierPage | null; offset: number; onOffset: (offset: number) => void; loading: boolean }) {
  const limit = data?.limit ?? 50;
  return <View style={s.stack}><Text style={s.muted}>{data?.total != null ? `${data.total} passende Datensätze · ${data.rows.length ? offset + 1 : 0}–${offset + data.rows.length}` : 'Seitenweise Datenansicht'} · Seite {Math.floor(offset / limit) + 1}</Text><View style={s.row}><Button label="Zurück" disabled={loading || offset === 0} onPress={() => onOffset(Math.max(0, offset - limit))} /><Button label="Weitere Datensätze" disabled={loading || !data?.hasMore} onPress={() => onOffset(offset + limit)} /></View></View>;
}

export function TenantDossierDataBrowser(props: { dossier: TenantDossier; scope: DossierScope; initialSection?: string; parentId?: string; excludeMain?: boolean }) {
  return <DataBrowser key={`${props.dossier.tenantId}:${props.scope}:${props.parentId ?? ''}:${props.initialSection ?? ''}`} {...props} />;
}

function DataBrowser({ dossier, scope, initialSection, parentId, excludeMain = false }: { dossier: TenantDossier; scope: DossierScope; initialSection?: string; parentId?: string; excludeMain?: boolean }) {
  const sections = useMemo(() => dossier.sections.filter(section => (section.scope === scope || (scope === 'company' && section.scope === 'operations')) && (!excludeMain || !['clients', 'employees'].includes(section.key))), [dossier.sections, scope, excludeMain]);
  const [section, setSection] = useState(initialSection && sections.some(item => item.key === initialSection) ? initialSection : sections[0]?.key ?? '');
  const [search, setSearch] = useState(''), [status, setStatus] = useState(''), [deleted, setDeleted] = useState(false), [offset, setOffset] = useState(0), [selected, setSelected] = useState<DossierRow | null>(null);
  const personKind = section === 'clients' || section === 'employees' ? section : null;
  const page = useDossierPage(dossier.tenantId, { section: section || 'tenants', parentId, search, status, offset, includeDeleted: deleted });
  if (!sections.length) return <Text style={s.muted}>Für diesen Bereich sind keine Datenquellen in der Akte hinterlegt.</Text>;
  const changeSection = (value: string) => { setSection(value); setSearch(''); setStatus(''); setDeleted(false); setOffset(0); setSelected(null); };
  return <Panel title={sections.find(item => item.key === section)?.label ?? 'Gespeicherte Angaben'} hint={parentId ? 'Alle zugeordneten Angaben zu dieser Person.' : 'Suche und Seitenzählung berücksichtigen den gesamten ausgewählten Bereich.'}>
    <ListFilterSelect label="Datenbereich" value={section} onChange={changeSection} options={sections.map(item => ({ key: item.key, label: item.label + (!parentId ? item.available ? ` (${item.count ?? '—'})` : ' – nicht bereitgestellt' : '') }))} />
    <Text style={s.label}>Suchen</Text><TextInput accessibilityLabel="Suchen" style={s.input} value={search} maxLength={200} onChangeText={value => { setSearch(value); setOffset(0); }} placeholder="Name, Nummer, Ort oder Angabe…" placeholderTextColor={C.muted} />
    {personKind ? <><ListFilterSelect label="Status" value={status} onChange={value => { setStatus(value); setOffset(0); }} options={[{ key: '', label: 'Alle Status' }, ...[...new Set([...(page.data?.statuses ?? []), ...(status ? [status] : [])])].map(value => ({ key: value, label: consoleLabel(value) }))]} /><View style={s.row}><Switch accessibilityLabel="Gelöschte Datensätze einbeziehen" value={deleted} onValueChange={value => { setDeleted(value); setOffset(0); }} /><Text style={s.body}>Gelöschte Datensätze einbeziehen</Text></View></> : null}
    <Button label="Aktualisieren" disabled={page.loading} onPress={page.reload} /><State {...page} />
    {!page.loading && !page.error && page.data ? !page.data.available ? <Text style={s.muted}>Datenbereich nicht bereitgestellt. Diese Datenquelle ist in der aktuellen Datenbank nicht verfügbar.</Text> : !page.data.rows.length ? <Text style={s.muted}>Keine passenden Datensätze. Bitte Suche und Filter prüfen.</Text> : page.data.rows.map((row, index) => {
      const completeness = personKind ? dossierPersonCompleteness(row, personKind) : null;
      return <View key={String(row.id ?? index)} style={s.card}><Text style={s.label}>{dossierRowName(row)}</Text><Text selectable style={s.muted}>{String(row.client_number ?? row.employee_number ?? row.username ?? row.id ?? '')}</Text><Text style={s.body}>{row.deleted_at ? 'Gelöscht' : row.status ? consoleLabel(row.status) : row.is_active == null ? 'Status nicht hinterlegt' : row.is_active ? 'Aktiv' : 'Inaktiv'}</Text>{row.portal_enabled != null ? <Text style={s.muted}>Portal {row.portal_enabled ? 'aktiviert' : 'deaktiviert'}</Text> : null}{completeness ? <><Text style={s.body}>{completeness.percentage}% Grundangaben</Text><Text style={s.muted}>{completeness.missing.join(', ') || 'Grundangaben vollständig'}</Text></> : null}<Text style={s.muted}>Geändert {consoleDate(row.updated_at ?? row.created_at)}</Text><Button label={`Alle Angaben zu ${dossierRowName(row)} öffnen`} onPress={() => setSelected(row)} /></View>;
    }) : null}
    <Pager data={page.data} offset={offset} onOffset={setOffset} loading={page.loading} />
    {selected ? <RecordDialog key={`${section}:${String(selected.id ?? 'singleton')}`} dossier={dossier} section={section} row={selected} personKind={personKind} onClose={() => setSelected(null)} /> : null}
  </Panel>;
}

function RecordDialog({ dossier, section, row, personKind, onClose }: { dossier: TenantDossier; section: string; row: DossierRow; personKind: 'clients' | 'employees' | null; onClose: () => void }) {
  const [related, setRelated] = useState(false);
  return <PlatformModal visible title={dossierRowName(row)} subtitle={dossier.sections.find(item => item.key === section)?.label ?? 'Gespeicherte Angaben'} onClose={onClose} maxWidth={1040} minWidth={240} maxHeightRatio={0.9}>
    {personKind ? <View style={s.row}><Button label="Alle Stammdaten" onPress={() => setRelated(false)} /><Button label="Zugehörige Angaben und Akten" onPress={() => setRelated(true)} /></View> : null}
    {personKind && related && typeof row.id === 'string' ? <TenantDossierDataBrowser dossier={dossier} scope={personKind} parentId={row.id} excludeMain /> : <TenantDossierFields row={row} />}
  </PlatformModal>;
}

export function TenantDossierHistory({ tenantId }: { tenantId: string }) {
  return <History key={tenantId} tenantId={tenantId} />;
}

function History({ tenantId }: { tenantId: string }) {
  const [search, setSearch] = useState(''), [offset, setOffset] = useState(0);
  const page = useDossierPage(tenantId, { section: 'history', search, offset });
  return <Panel title="Welche Schritte wurden gemacht?" hint="Gespeicherte Unternehmens- und Plattformaktionen mit Zeitpunkt, ausführender Person und Änderungen. Fehlende Protokolle bleiben als fehlende Nachweise erkennbar.">
    <Text style={s.label}>Verlauf durchsuchen</Text><TextInput accessibilityLabel="Verlauf durchsuchen" style={s.input} maxLength={200} value={search} onChangeText={value => { setSearch(value); setOffset(0); }} placeholder="Aktion, Person oder Begründung…" placeholderTextColor={C.muted} />
    <Button label="Aktualisieren" onPress={page.reload} disabled={page.loading} /><State {...page} />
    {!page.loading && !page.error && page.data ? page.data.rows.length ? page.data.rows.map(row => <View key={`${row.source}:${String(row.id)}`} style={s.card}><Text style={s.muted}>{consoleDate(row.created_at)}</Text><Text style={s.label}>{platformActionLabel(row.action)}</Text><Text style={s.body}>{String(row.actor_name ?? 'Ausführende Person nicht hinterlegt')} · {String(row.source ?? 'Protokoll')}</Text>{row.reason != null ? <Text style={s.body}>{String(row.reason)}</Text> : null}<Fold label="Geänderte Angaben anzeigen">{dossierChangedFields(row.before, row.after).map(change => <View key={change.key} style={s.nested}><Text style={s.label}>{dossierFieldLabel(change.key)}</Text><Text style={s.muted}>Vorher</Text><Value value={change.before} field={change.key} /><Text style={s.muted}>Nachher</Text><Value value={change.after} field={change.key} /></View>)}{!dossierChangedFields(row.before, row.after).length ? <Text style={s.muted}>Für diese Aktion sind keine unterschiedlichen Feldwerte gespeichert.</Text> : null}</Fold></View>) : <Text style={s.muted}>Keine protokollierten Schritte in dieser Auswahl.</Text> : null}
    <Pager data={page.data} offset={offset} onOffset={setOffset} loading={page.loading} />
  </Panel>;
}

const s = StyleSheet.create({
  panel: { alignSelf: 'stretch', minWidth: 0, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, gap: 12 },
  title: { color: C.text, fontSize: 19, fontWeight: '800', flexShrink: 1 },
  label: { color: C.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  body: { color: C.text, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  muted: { color: C.muted, fontSize: 13, lineHeight: 20, flexShrink: 1 },
  error: { color: C.danger, fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', minWidth: 0 },
  grow: { flex: 1, minWidth: 160, gap: 8 },
  stack: { gap: 10, minWidth: 0 },
  card: { padding: 14, gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: 12, minWidth: 0, alignSelf: 'stretch' },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 10, backgroundColor: C.panelSoft, justifyContent: 'center', maxWidth: '100%' },
  buttonText: { color: C.accent, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  disabled: { opacity: 0.5 },
  input: { color: C.text, borderColor: C.borderStrong, backgroundColor: C.panelSoft, borderWidth: 1, borderRadius: 10, minHeight: 48, padding: 12, fontSize: 15 },
  state: { paddingVertical: 14, gap: 12 },
  logo: { width: 64, height: 64, borderRadius: 12 },
  initial: { color: C.accent, fontSize: 36, width: 64, textAlign: 'center' },
  percentage: { color: C.text, fontSize: 23, fontWeight: '800' },
  progress: { height: 8, backgroundColor: C.border, borderRadius: 8, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', backgroundColor: C.accent, borderRadius: 8 },
  nested: { paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: C.borderStrong, gap: 8 },
});
