// Generated native presentation from src/screens/pflege/SupplyWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window,nativeStructuredClone as structuredClone,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { NativeLocalDateTimeInput } from '@/components/inputs/NativeLocalDateTimeInput.native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { carePermissionOwner, carePermissionOwnerIsCurrent, sameCarePermissionOwner, type CarePermissionOwner } from "../../lib/permissions/carePermissionOwner.native.ts";
import { isDemoMode } from '@/lib/supabase/config';
import { supplyRepository as repository } from "../../lib/pflege/supplyWorkspaceRepository.supabase.native.ts";
import type { SupplyAuthority } from "../../lib/pflege/supplyWorkspaceRepository.native.ts";
import { SupplyWorkflow, browserSupplyLock, type SupplyJournal } from "../../lib/pflege/supplyWorkspaceWorkflow.native.ts";
import { discardSupplyDraft, restoreSupplyDraft, saveSupplyDraft, type SupplyDraft } from "../../lib/pflege/supplyWorkspaceDraft.native.ts";
import { buildSupplyCommand, supplyFields, supplyLocalTime, supplyOptions, supplyTimeFromInput, supplyTimeCandidates, type SupplyField, type SupplyOption } from "../../lib/pflege/supplyWorkspaceForm.native.ts";
import { assertSupplySelectionCurrent, decodeSupplyHistory, supplyBaseRights, supplyId, supplyKinds, supplyLabels, supplyWriteRights, type SupplyContext, type SupplyKind, type SupplyRow, type SupplyState } from "../../lib/pflege/supplyWorkspaceDomain.native.ts";
import type { PermissionKey } from '@/types/permissions';
import { SourcePicker } from "./TreatmentSourcePicker.native.tsx";
import { colors, spacing } from '@/theme';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { medicationTimeDisplay } from "../../lib/pflege/medicationTimeDisplay.native.ts";
import { sameWoundJson } from '@/lib/pflege/woundCareDomain';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { makeSupplyReviewSource } from "../../lib/pflege/supplyWorkspaceReview.native.ts";
import { SupplyWorkspaceReviewPanel } from "../../components/pflege/SupplyWorkspaceReviewPanel.native.tsx";
type Boundary = {
    owner: CarePermissionOwner | null;
    grants: readonly PermissionKey[];
    number: number;
    canCurrent(): boolean;
};
const baseRights = [...supplyBaseRights] as PermissionKey[];
const person = (r: SupplyRow) => [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Name nicht hinterlegt';
const when = (value: string) => medicationTimeDisplay(value).display;
/** Web/Desktop-only workspace. Android and shared native interfaces remain unchanged. */
export function SupplyWorkspace() {
    const styles = useSupplyStyles();
    const auth = useAuth(), tenantId = useServiceTenantId(), permissions = useCareRuntimePermissions();
    const owner = carePermissionOwner(auth, tenantId, isDemoMode());
    const reference = useRef<Boundary | null>(null), mounted = useRef(true);
    if (!reference.current || !sameCarePermissionOwner(reference.current.owner, owner) || reference.current.grants !== permissions.permissions) {
        const captured = permissions.permissions;
        reference.current = { owner, grants: captured, number: (reference.current?.number ?? 0) + 1, canCurrent: () => permissions.canAll([...captured]) };
    }
    const boundary = reference.current;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const authority = useMemo<SupplyAuthority | null>(() => {
        if (!boundary.owner || boundary.owner.demo || !boundary.owner.accessToken || !baseRights.every(k => boundary.grants.includes(k)))
            return null;
        const own = boundary.owner, accessToken = boundary.owner.accessToken;
        return { tenantId: own.tenantId, actorId: own.profileId, accessToken, expiresAt: own.expiresAt,
            isCurrent: () => mounted.current && reference.current === boundary && carePermissionOwnerIsCurrent(own) && boundary.canCurrent() };
    }, [boundary]);
    const content = permissions.loading ? <LoadingState message="Aktuelle Material- und Aktenrechte werden geprüft…"/> : permissions.error ?
        <ErrorState message={permissions.error} onRetry={permissions.refreshPermissions}/> : !authority || !authority.isCurrent() ?
        <InfoBanner variant="warning" message={owner?.demo ? 'Verbindliche Materialvorgänge benötigen ein angemeldetes Betriebskonto.' : 'Aktuelle Rechte für Pflegefälle, Inventarbestand und Inventaraudit sind nicht vollständig bestätigt.'}/> :
        <AuthorizedSupply key={boundary.number} authority={authority} grants={boundary.grants}/>;
    return <ScreenShell title="Hygiene, Material und Zugänge" subtitle="Fallbezogene Originale, Bestandsbuch, Gerätefreigabe und Wiederaufnahme">{content}</ScreenShell>;
}
function AuthorizedSupply({ authority, grants }: {
    authority: SupplyAuthority;
    grants: readonly PermissionKey[];
}) {
    const styles = useSupplyStyles(), router = useRouter(), params = useLocalSearchParams();
    const routeClient = typeof params.clientId === 'string' && supplyId(params.clientId) ? params.clientId : '';
    const [clients, setClients] = useState<SupplyRow[] | null>(null), [clientId, setClientId] = useState(routeClient), [error, setError] = useState(''), [revision, setRevision] = useState(0);
    useEffect(() => {
        let active = true;
        setClients(null);
        setError('');
        void repository.clients(authority).then(result => { if (!active || !authority.isCurrent())
            return; if (result.ok)
            setClients(result.data);
        else
            setError(result.error); });
        return () => { active = false; };
    }, [authority, revision]);
    if (!authority.isCurrent())
        return <InfoBanner variant="warning" message="Konto, Sitzung oder aktuelle Rechte wurden geändert. Die Fallansicht neu öffnen."/>;
    if (params.clientId !== undefined && !routeClient)
        return <ErrorState message="Der Pflegefalllink ist ungültig. Einen aktiven Pflegefall aus der Übersicht wählen."/>;
    return <View style={styles.stack}>
    <View style={styles.actions}><PremiumButton title="Dauerhafte Inventargegenstände öffnen" variant="secondary" onPress={() => { if (authority.isCurrent())
        router.push('/pflege/inventar/items' as never); }}/></View>
    {!clients ? error ? <ErrorState message={error} onRetry={() => setRevision(n => n + 1)}/> : <LoadingState message="Zugängliche Pflegefälle werden vollständig geladen…"/> : <>
      <SectionPanel title="Pflegefall auswählen"><SourcePicker label="Pflegefall" rows={clients.map(r => ({ id: String(r.id), label: person(r) }))} value={clientId} onChange={setClientId} disabled={false}/>
        {!clients.length ? <Text style={styles.body}>Kein aktiver Pflegefall ist aktuell zugänglich.</Text> : null}
      </SectionPanel>
      {clientId && clients.some(r => r.id === clientId) ? <CaseSupply key={clientId} authority={authority} grants={grants} clientId={clientId}/> : clientId ? <ErrorState message="Dieser Pflegefall ist nicht im vollständig zugänglichen Bestand enthalten."/> : <InfoBanner variant="info" message="Einen Pflegefall auswählen, um Hygienezuordnungen, Materialbuchungen, Geräte- und Schlüsselverläufe vollständig zu laden."/>}
    </>}
  </View>;
}
function CaseSupply({ authority, grants, clientId }: {
    authority: SupplyAuthority;
    grants: readonly PermissionKey[];
    clientId: string;
}) {
    const window = useNativeWorkflowWindow();
    const router = useRouter();
    const styles = useSupplyStyles();
    const [context, setContext] = useState<SupplyContext | null>(null), [state, setState] = useState<SupplyState | null>(null);
    const [error, setError] = useState(''), [notice, setNotice] = useState(''), [reading, setReading] = useState(true), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0), [journal, setJournal] = useState<SupplyJournal | null>(null), [journalError, setJournalError] = useState('');
    const alive = useRef(true), action = useRef(false), ticket = useRef(0), [loadFailed, setLoadFailed] = useState(false);
    const workflow = useMemo(() => new SupplyWorkflow({ tenantId: authority.tenantId, clientId, actorId: authority.actorId }, {
        storage: { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: key => window.localStorage.removeItem(key) },
        lock: browserSupplyLock, isCurrent: () => alive.current && authority.isCurrent(), commit: command => repository.commit(authority, command), confirm: command => repository.confirm(authority, command),
    }), [authority, clientId]);
    const current = () => alive.current && authority.isCurrent();
    const readJournal = () => { if (!current())
        return; try {
        setJournal(workflow.read());
        setJournalError('');
    }
    catch (e) {
        setJournalError(e instanceof Error ? e.message : 'Der gesicherte Vorgang ist beschädigt. Neue Übertragung bleibt gesperrt.');
    } };
    useEffect(() => {
        alive.current = true;
        readJournal();
        const storage = (event: StorageEvent) => { if (event.key?.startsWith('caresuite.case-supply.v1:'))
            readJournal(); };
        window.addEventListener('storage', storage);
        return () => { alive.current = false; ticket.current++; window.removeEventListener('storage', storage); };
    }, [workflow]);
    useEffect(() => {
        const own = ++ticket.current;
        setReading(true);
        setError('');
        setLoadFailed(false);
        void repository.context(authority, clientId).then(result => {
            if (!current() || ticket.current !== own)
                return;
            if (!result.ok) {
                setError(result.error);
                setReading(false);
                setLoadFailed(true);
                return;
            }
            try {
                const folded = decodeSupplyHistory(result.data.history, result.data);
                setContext(result.data);
                setState(folded.state);
            }
            catch (e) {
                setContext(null);
                setState(null);
                setError(e instanceof Error ? e.message : 'Der vollständige Originalverlauf ist widersprüchlich.');
            }
            finally {
                if (current() && ticket.current === own)
                    setReading(false);
            }
        });
    }, [authority, clientId, revision]);
    async function run(operation: () => Promise<void>) {
        if (action.current || !current())
            return;
        action.current = true;
        setBusy(true);
        setError('');
        try {
            await operation();
        }
        catch (e) {
            if (current())
                setError(e instanceof Error ? e.message : 'Der Vorgang konnte nicht bestätigt werden.');
        }
        finally {
            action.current = false;
            if (current()) {
                setBusy(false);
                readJournal();
            }
        }
    }
    if (!current())
        return <InfoBanner variant="warning" message="Die aktuellen Akten- und Inventarrechte sind nicht mehr bestätigt. Die Fallansicht neu öffnen."/>;
    const recover = journal ? <SectionPanel title="Gesicherter Materialvorgang"><Text style={styles.body}>{journal.phase === 'dispatched' ? 'Die Speicherantwort ist unklar. Die exakt gesicherte Anfrage wird nicht erneut gesendet; nur ihre native Quittung darf gelesen werden.' : journal.phase === 'confirmed' ? 'Die Quittung ist lokal gesichert. Vor einer neuen Buchung muss derselbe Originalbeleg im vollständig neu geladenen Verlauf erscheinen.' : journal.phase === 'rejected' ? journal.rejection : 'Die Anfrage wurde dauerhaft vorbereitet, aber noch nicht versendet.'}</Text>
    {journal.phase === 'dispatched' ? <PremiumButton title="Gespeicherten Vorgang ausschließlich prüfen" disabled={busy} loading={busy} onPress={() => void run(async () => { const result = await workflow.confirm(); if (!result.ok)
        throw Error(result.error); if (current())
        setRevision(n => n + 1); })}/> : null}
    {journal.phase === 'confirmed' ? <PremiumButton title="Quittung mit Originalverlauf abgleichen" disabled={busy || !context} loading={busy} onPress={() => void run(async () => { const fresh = await repository.context(authority, clientId); if (!fresh.ok || !current())
        throw Error('Der bestätigte Originalverlauf konnte noch nicht abgeglichen werden.'); await workflow.releaseConfirmed(fresh.data.history.events); if (current())
        setRevision(n => n + 1); })}/> : null}
    {journal.phase === 'prepared' || journal.phase === 'rejected' ? <PremiumButton title="Abgewiesenen oder ungesendeten Vorgang freigeben" variant="secondary" disabled={busy} onPress={() => void run(() => workflow.discardUnsentOrRejected())}/> : null}
  </SectionPanel> : null;
    return <View style={styles.stack}>{journalError ? <ErrorState message={journalError}/> : null}{recover}{error ? <ErrorState message={error} onRetry={busy ? undefined : () => setRevision(n => n + 1)}/> : null}{notice ? <SuccessState message={notice}/> : null}
    <View style={styles.actions}><PremiumButton title="Pflegeakte und Originaldokumente öffnen" variant="secondary" disabled={busy} onPress={() => { if (current())
        router.push(clientRecordRoute(clientId) as never); }}/><PremiumButton title="Aktuellen vollständigen Bestand neu laden" variant="secondary" disabled={busy || reading} onPress={() => setRevision(n => n + 1)}/></View>
    {reading ? <LoadingState message="Aktuelle Originale, Personen und vollständige Ereigniskette werden geladen…"/> : null}
    {context && state ? <>
      <Text style={styles.caption}>Letzte vollständig geladene Fassung: {when(context.loadedAt)}.</Text>{loadFailed ? <InfoBanner variant="warning" message="Die aktuelle Abfrage ist fehlgeschlagen. Der letzte geladene Stand bleibt zur Einsicht sichtbar; neue Buchungen sind gesperrt."/> : null}
      <SupplyOverview context={context} state={state}/>
      {state.headId ? <SupplyWorkspaceReviewPanel tenantId={authority.tenantId} clientId={clientId} actorId={authority.actorId} canView={grants.includes('inventory.audit_view')} canRequest={grants.includes('inventory.manage_items')} canReview={grants.includes('inventory.audit_view') && grants.includes('pflege.documentation.sign')} supplyOriginal={makeSupplyReviewSource(context)}/> : null}
      <SupplyEditor context={context} state={state} grants={grants} disabled={busy || reading || loadFailed || !!journal || !!journalError} isCurrent={current} onSubmit={command => void run(async () => {
                if (reading || loadFailed)
                    throw Error('Der aktuelle vollständige Fallbestand ist noch nicht bestätigt.');
                if (workflow.read())
                    throw Error('Zuerst den gesicherten Vorgang abgleichen.');
                const required = supplyWriteRights(command.kind, command.payload) as PermissionKey[];
                if (!required.every(right => grants.includes(right)) || !current())
                    throw Error('Das aktuelle Schreibrecht für diesen Vorgang fehlt.');
                assertSupplySelectionCurrent(command, context);
                const result = await workflow.dispatch(command);
                if (!current())
                    return;
                if (!result.ok)
                    throw Error(result.error);
                discardSupplyDraft(window.sessionStorage, { tenantId: authority.tenantId, clientId, actorId: authority.actorId });
                setNotice('Der Originalbeleg ist gespeichert. Fachliche und rechtliche Abnahmen bleiben offen.');
                setRevision(n => n + 1);
            })}/>
    </> : null}
  </View>;
}
function SupplyOverview({ context, state }: {
    context: SupplyContext;
    state: SupplyState;
}) {
    const styles = useSupplyStyles(), [search, setSearch] = useState(''), [count, setCount] = useState(20), [group, setGroup] = useState('all'), [articleCount, setArticleCount] = useState(20), today = new Date().toISOString().slice(0, 10);
    const rows = [...state.events].reverse().filter(e => (group === 'all' || supplyGroups.find(g => g.key === group)?.kinds.includes(e.command.kind)) && `${supplyLabels[e.command.kind]} ${e.actorName} ${e.command.note} ${Object.values(e.command.payload).filter(v => typeof v === 'string').join(' ')}`.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
    function describe(field: SupplyField, value: unknown): string {
        if (field.type === 'time')
            return typeof value === 'string' ? when(value) : 'Zeit nicht bestätigt';
        if (field.type === 'choice')
            return field.options?.find(o => o.key === value)?.label ?? 'Auswahl nicht bestätigt';
        if (field.type === 'reference') {
            if (value && typeof value === 'object') {
                const r = value as SupplyRow, source = r.snapshot as SupplyRow | undefined, document = source?.document as SupplyRow | undefined, version = source?.version as SupplyRow | undefined;
                return document ? `${document.title ?? 'QM-Dokument'} · Fassung ${version?.version_number ?? 'unbekannt'}` : String(r.name ?? source?.title ?? source?.name ?? 'Originalbeleg');
            }
            const article = state.articles.find(a => a.id === value);
            if (article)
                return `${article.name} · ${article.unit}`;
            const order = state.orders.find(o => o.id === value);
            if (order)
                return `${order.reference} · ${order.quantity} bestellt`;
            const lot = state.lots.find(l => l.id === value);
            if (lot)
                return `Charge ${lot.batch} · ${lot.location}`;
            const original = state.events.find(e => e.id === value);
            return original ? `${supplyLabels[original.command.kind]} · ${original.actorName} · ${when(original.command.occurredAt)} · ${original.command.note}` : 'Originalbezug nicht bestätigt';
        }
        return String(value);
    }
    return <View style={styles.stack}>
  <SectionPanel title="Materialbestand dieses Pflegefalls"><Text style={styles.caption}>Eingang, Bestand und offene Bestellung bleiben getrennt. Als haltbar werden nur ungesperrte Chargen vor ihrem Verfall gezählt. Die Anwendbarkeit muss zusätzlich geprüft werden.</Text>
   {!state.articles.length ? <Text style={styles.body}>Noch kein Artikel für diesen Pflegefall erfasst. Zuerst Artikel und kleinste Mengeneinheit anlegen, danach Bestellung und tatsächlichen Eingang buchen.</Text> : null}
   {state.articles.slice(0, articleCount).map(article => { const lots = state.lots.filter(l => l.articleId === article.id), total = lots.reduce((n, l) => n + l.quantity, 0), usable = lots.filter(l => !l.held && l.expiry >= today).reduce((n, l) => n + l.quantity, 0), orders = state.orders.filter(o => o.articleId === article.id); return <View key={article.id} style={styles.item}><Text style={styles.heading}>{article.name}</Text><Text style={styles.body}>Gebuchter Bestand {total} {article.unit}. Davon ohne Chargensperre und aktuell haltbar: {usable} {article.unit}. Mindestbestand {article.minimum} {article.unit}{usable < article.minimum ? ' – Nachbestellung prüfen.' : '.'}</Text>{orders.map(o => <Text key={o.id} style={styles.body}>{o.reference}: {o.received} von {o.quantity} {article.unit} eingegangen, {o.quantity - o.received} offen · {o.supplier}</Text>)}{lots.map(l => <Text key={l.id} style={styles.body}>Charge {l.batch}: {l.quantity} {article.unit} · {l.location} · Verfall {l.expiry} · {l.held ? 'gesperrt' : l.expiry < today ? 'abgelaufen' : 'ohne Chargensperre'}</Text>)}</View>; })}
   {articleCount < state.articles.length ? <PremiumButton title="Weitere Artikel und Chargen anzeigen" variant="secondary" onPress={() => setArticleCount(n => n + 20)}/> : null}
  </SectionPanel>
  <SectionPanel title="Hygiene, Geräte, Hauswirtschaft und Schlüssel im Originalverlauf"><PremiumInput label="Vorgänge, Personen und Anlässe suchen" value={search} onChangeText={v => { setSearch(v); setCount(20); }}/><FilterChipGroup wrap options={[{ key: 'all', label: 'Alle Vorgänge' }, ...supplyGroups.map(({ key, label }) => ({ key, label }))]} value={group} onChange={v => { setGroup(v); setCount(20); }}/><Text style={styles.caption}>{state.events.length} Originalereignisse vollständig geladen, {rows.length} Suchtreffer. {context.sources.count} aktuell zugängliche Originalquellen und {context.people.count} aktive Personen.</Text>
   {!rows.length ? <Text style={styles.body}>Keine Originalereignisse für diese Auswahl. Fehlende Einträge bestätigen keinen unauffälligen Befund, keine Versorgung und keine Freigabe.</Text> : null}
   {rows.slice(0, count).map(e => <View key={e.id} style={styles.item}><Text style={styles.heading}>{supplyLabels[e.command.kind]}</Text><Text style={styles.caption}>{e.actorName} · tatsächlich {when(e.command.occurredAt)} · dokumentiert {when(e.recordedAt)}</Text><Text style={styles.body}>{e.command.note}</Text>{supplyFields(e.command.kind).map(field => <Text key={field.key} style={styles.body}>{field.label}: {describe(field, e.command.payload[field.key])}</Text>)}</View>)}
   {count < rows.length ? <PremiumButton title="Weitere Originalereignisse anzeigen" variant="secondary" onPress={() => setCount(n => n + 20)}/> : null}
  </SectionPanel>
 </View>;
}
const supplyGroups: {
    key: string;
    label: string;
    kinds: SupplyKind[];
}[] = [
    { key: 'hygiene', label: 'Hygiene und Befunde', kinds: ['hygiene_plan', 'infection'] },
    { key: 'stock', label: 'Material und Bestand', kinds: ['article', 'order', 'receipt', 'consume', 'hold', 'release_lot', 'dispose', 'count', 'approve_count', 'reverse_stock'] },
    { key: 'device', label: 'Geräte und Reinigung', kinds: ['device_check', 'device_training', 'cleaning', 'device_release', 'device_use'] },
    { key: 'housekeeping', label: 'Hauswirtschaft', kinds: ['housekeeping'] }, { key: 'keys', label: 'Schlüssel und Zugang', kinds: ['key'] },
];
function SupplyEditor({ context, state, grants, disabled, isCurrent, onSubmit }: {
    context: SupplyContext;
    state: SupplyState;
    grants: readonly PermissionKey[];
    disabled: boolean;
    isCurrent(): boolean;
    onSubmit(command: ReturnType<typeof buildSupplyCommand>): void;
}) {
    const styles = useSupplyStyles(), scope = { tenantId: context.tenantId, clientId: context.clientId, actorId: context.actorId };
    const [restored] = useState(() => { try {
        return { value: restoreSupplyDraft(window.sessionStorage, scope, state.headId, (_field, value) => [...context.sources.rows, ...context.people.rows, ...state.events, ...state.articles, ...state.orders, ...state.lots].some(r => sameWoundJson(r, value))), error: '' };
    }
    catch (e) {
        return { value: null, error: e instanceof Error ? e.message : 'Der lokale Entwurf ist nicht lesbar.' };
    } });
    const [draft, setDraft] = useState<SupplyDraft>(restored.value?.draft ?? { version: context.version, scope, headId: state.headId, kind: 'article', occurredAt: '', note: '', values: {}, selected: {} });
    const [group, setGroup] = useState(supplyGroups.find(g => g.kinds.includes(draft.kind))?.key ?? 'stock'), [error, setError] = useState(''), [draftError, setDraftError] = useState(restored.error), [message, setMessage] = useState(restored.value?.changed ? 'Entwurf wiederhergestellt. Geänderte Originale erneut auswählen.' : restored.value ? 'Lokaler Entwurf wiederhergestellt.' : '');
    const contextRef = useRef(context), corrupt = useRef(!!restored.error), changed = contextRef.current !== context;
    useEffect(() => { if (contextRef.current === context)
        return; contextRef.current = context; setDraft(d => ({ ...d, headId: state.headId, selected: {} })); setMessage('Der Bestand wurde neu geladen. Texte bleiben erhalten; Originale und Mengenbezug erneut auswählen.'); }, [context, state.headId]);
    useEffect(() => { if (!isCurrent() || corrupt.current)
        return; try {
        saveSupplyDraft(window.sessionStorage, draft);
        setDraftError('');
    }
    catch (e) {
        setDraftError(e instanceof Error ? e.message : 'Der Entwurf ist nicht gesichert.');
    } }, [draft]);
    const fields = supplyFields(draft.kind), required = supplyWriteRights(draft.kind, { action: draft.values.action }) as PermissionKey[], allowed = required.every(r => grants.includes(r));
    function edit(change: Partial<SupplyDraft>) { if (!isCurrent())
        return; setDraft(d => ({ ...d, ...change })); setError(''); setMessage(''); }
    function choose(field: SupplyField, id: string) { const row = supplyOptions(field, state, context).find(r => r.id === id); if (!row)
        return; const values = { ...draft.values }; if (field.pool === 'plan') {
        const original = row.value as {
            command: {
                payload: SupplyRow;
            };
        };
        values.activity = String(original.command.payload.activity);
        values.site = String(original.command.payload.site);
    } edit({ values, selected: { ...draft.selected, [field.key]: { id: row.id, value: structuredClone(row.value) } } }); }
    function reset() { try {
        if (!isCurrent())
            return;
        discardSupplyDraft(window.sessionStorage, scope);
        corrupt.current = false;
        edit({ occurredAt: '', note: '', values: {}, selected: {} });
        setDraftError('');
    }
    catch (e) {
        setDraftError(e instanceof Error ? e.message : 'Entwurf nicht entfernt.');
    } }
    return <SectionPanel title="Tatsächlichen Vorgang erfassen">
  <FilterChipGroup wrap options={supplyGroups.map(({ key, label }) => ({ key, label }))} value={group} onChange={disabled ? undefined : key => { setGroup(key); edit({ kind: supplyGroups.find(g => g.key === key)!.kinds[0], values: {}, selected: {} }); }}/>
  <FilterChipGroup wrap options={supplyGroups.find(g => g.key === group)!.kinds.map(key => ({ key, label: supplyLabels[key] }))} value={draft.kind} onChange={disabled ? undefined : kind => edit({ kind: kind as SupplyKind, values: {}, selected: {} })}/>
  <InfoBanner variant="info" message="Materialmengen gehören ausschließlich zu diesem Pflegefall. Wareneingang, Verbrauch, Anwendung und Gerätefreigabe haben eigene Nachweise. Ein Dokumentbezug bestätigt seine Datei oder fachliche Gültigkeit noch nicht."/>
  {message ? <InfoBanner variant="info" message={message}/> : null}{draftError ? <ErrorState message={draftError}/> : null}
  {!allowed ? <InfoBanner variant="warning" message="Für diese Aktion fehlt ein aktuelles Bearbeitungsrecht. Der Entwurf kann lokal gesichert werden."/> : null}
  <SupplyTimeInput label="Tatsächlicher Ereigniszeitpunkt" value={draft.occurredAt} disabled={disabled} onChange={occurredAt => edit({ occurredAt })}/>
  {fields.map(field => field.type === 'reference' ? <ReferenceField key={field.key} field={field} state={state} context={context} selected={draft.selected[field.key]?.id ?? ''} disabled={disabled} onChange={id => choose(field, id)}/> : field.type === 'choice' ? <View key={field.key} style={styles.stack}><Text style={styles.heading}>{field.label}</Text><FilterChipGroup wrap options={field.options ?? []} value={draft.values[field.key] ?? ''} onChange={disabled ? undefined : value => edit({ values: { ...draft.values, [field.key]: value } })}/></View> : field.type === 'time' ? <SupplyTimeInput key={field.key} label={field.label} value={draft.values[field.key] ?? ''} disabled={disabled} onChange={value => edit({ values: { ...draft.values, [field.key]: value } })}/> : <PremiumInput key={field.key} label={field.label} hint={field.type === 'date' ? 'Datum als JJJJ-MM-TT' : field.type === 'number' ? 'Ganze Menge der kleinsten Artikeleinheit' : undefined} keyboardType={field.type === 'number' ? 'numeric' : 'default'} value={draft.values[field.key] ?? ''} editable={!disabled} onChangeText={value => edit({ values: { ...draft.values, [field.key]: value } })}/>)}
  {draft.kind === 'count' && draft.selected.lotId ? <Text style={styles.body}>Sollbestand dieser Chargenfassung: {String((draft.selected.lotId.value as SupplyRow).quantity)}. Die Zählung ändert keine Menge. Eine andere Person prüft und bucht die Differenz.</Text> : null}
  {draft.kind === 'approve_count' || draft.kind === 'reverse_stock' ? <InfoBanner variant="warning" message="Der ursprüngliche Beleg bleibt erhalten. Berichtigte und durch Inventur angepasste Mengen bleiben bis zu einer gesonderten Freigabe gesperrt. Die Buchung ändert keinen klinischen Durchführungsnachweis."/> : null}
  {draft.kind === 'device_release' || draft.kind === 'device_use' ? <InfoBanner variant="info" message="Aktuelle Prüfung, eigene Einweisung, Reinigung und passende Hygienezuordnung werden einzeln benötigt. Medizinprodukteklassifikation und fachliche Einsatzfreigabe müssen zusätzlich am Original geprüft sein."/> : null}
  {draft.kind === 'key' ? <InfoBanner variant="info" message="Ein Übergabeangebot bestätigt keinen Empfang. Die verwahrende Person bestätigt Übernahme, Rückgabe oder Verlust selbst. Zugangssperre und abgeschlossene Verlustbearbeitung benötigen eigene tatsächliche Nachweise."/> : null}
  <PremiumInput label="Tatsächlicher Anlass, Abweichung oder Dokumentationsgrund" value={draft.note} multiline maxLength={4000} editable={!disabled} onChangeText={note => edit({ note })}/>
  <Text style={styles.caption}>Texte und ausgewählte Originale werden als Entwurf für dieses Konto und diesen Fall auf diesem Gerät gesichert.</Text>
  <View style={styles.actions}><PremiumButton title="Entwurf ausdrücklich sichern" variant="secondary" disabled={disabled || !!draftError} onPress={() => { try {
        if (!isCurrent())
            return;
        saveSupplyDraft(window.sessionStorage, draft);
        setMessage('Entwurf auf diesem Gerät gesichert.');
    }
    catch (e) {
        setDraftError(e instanceof Error ? e.message : 'Entwurf nicht gesichert.');
    } }}/>
   <PremiumButton title={supplyLabels[draft.kind]} disabled={disabled || changed || !allowed || !!draftError} onPress={() => { try {
        if (!isCurrent())
            return;
        const command = buildSupplyCommand(draft, state, context, crypto.randomUUID(), crypto.randomUUID());
        assertSupplySelectionCurrent(command, context);
        onSubmit(command);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Angaben und Originale prüfen.');
    } }}/>
   <PremiumButton title={draftError ? 'Lokalen Entwurf ausdrücklich entfernen' : 'Mit leerem Entwurf beginnen'} variant="secondary" disabled={disabled} onPress={reset}/></View>
  {error ? <ErrorState message={error}/> : null}
 </SectionPanel>;
}
function SupplyTimeInput({ label, value, disabled, onChange }: {
    label: string;
    value: string;
    disabled: boolean;
    onChange(value: string): void;
}) {
    const styles = useSupplyStyles(), color = typeof styles.body.color === 'string' ? styles.body.color : undefined, candidates = supplyTimeCandidates(supplyLocalTime(value));
    return <View style={styles.stack}><Text style={styles.heading}>{label}</Text><NativeLocalDateTimeInput label={label} disabled={disabled} value={value ? supplyLocalTime(value) : ''} onChange={text => onChange(supplyTimeFromInput(text))} color={color}/>{candidates.length > 1 ? <View style={styles.stack}><Text style={styles.body}>Diese Ortszeit kommt bei der Zeitumstellung zweimal vor. Den tatsächlichen UTC-Abstand ausdrücklich auswählen.</Text><FilterChipGroup wrap options={candidates} value={value} onChange={disabled ? undefined : onChange}/></View> : null}<Text style={styles.caption}>Ortszeit des Geräts: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Die tatsächlich beobachtete Zeit angeben.</Text></View>;
}
function ReferenceField({ field, state, context, selected, disabled, onChange }: {
    field: SupplyField;
    state: SupplyState;
    context: SupplyContext;
    selected: string;
    disabled: boolean;
    onChange(id: string): void;
}) {
    const options: SupplyOption[] = supplyOptions(field, state, context);
    return <SourcePicker label={`${field.label} *`} rows={options.map(option => ({ id: option.id, label: option.label }))} value={selected} onChange={onChange} disabled={disabled}/>;
}
function useSupplyStyles() { const text = useAdaptiveContentStyles(); return { ...layout, body: text.body, caption: text.caption, heading: text.bodyStrong }; }
const layout = StyleSheet.create({ stack: { gap: spacing.md, width: '100%', minWidth: 0 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'flex-start' }, item: { borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 12, padding: spacing.md, gap: spacing.sm, minWidth: 0, width: '100%' } });
