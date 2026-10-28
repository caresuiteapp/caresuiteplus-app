// Generated native presentation from src/components/company/CompanyCostCentersPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeStyle,NativeDiv,NativeH3,NativeP,NativeButton,NativeForm,NativeFieldset,NativeLabel,NativeSpan,NativeInput,NativeSelect,NativeOption,NativeArticle,NativeStrong,NativeSmall,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PermissionKey, RoleKey } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { loadCompanyCostCenters, saveCompanyCostCenter, validateCompanyCostCenter, type CompanyCostCenter, type CompanyCostCenterInput, type CompanyCostCenterSnapshot } from "../../lib/tenant/companyCostCenters.ts";
export type CompanyCostCentersPanelProps = {
    tenantId: string;
    roleKey: RoleKey | null;
    effectivePermissions?: readonly PermissionKey[];
    onSaved?: () => void;
    onNavigationGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
};
const empty = (): CompanyCostCenterInput => ({ code: '', name: '', organizationId: null, isActive: true });
const css = `.co-cost-centers{margin-top:20px}.co-cost-tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:18px 0}.co-cost-centers input,.co-cost-centers select{box-sizing:border-box;min-width:0;width:100%;min-height:44px;background:#ffffff;border:1px solid #c5d6e9;border-radius:12px;color:#15304e;padding:11px 13px;font:inherit;font-size:13px;color-scheme:light}.co-cost-centers :is(input,select):focus-visible{outline:2px solid #1764d4;outline-offset:2px}.co-cost-tools>label{flex:1;min-width:min(100%,220px)}.co-cost-tools>label:last-child{flex:0 1 190px}.co-cost-tools label span,.co-cost-field>span{display:block;color:#59708c;font-size:12px;line-height:1.5;margin-bottom:7px}.co-cost-list{display:grid;gap:10px}.co-cost-row{display:grid;grid-template-columns:90px minmax(0,1fr) auto;align-items:center;gap:16px;padding:17px;border:1px solid #d7e3f1;border-radius:14px;background:#ffffff}.co-cost-code{font-size:13px;color:#1764d4;overflow-wrap:anywhere}.co-cost-row strong{font-size:14px;line-height:1.5;color:#15304e;display:block;overflow-wrap:anywhere}.co-cost-row small{display:block;margin-top:5px;color:#59708c;font-size:12px;line-height:1.5}.co-cost-editor{padding:20px;margin:18px 0;border:1px solid #d7e3f1;border-radius:16px;background:linear-gradient(130deg,#ffffff,#f7faff)}.co-cost-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:16px;margin:16px 0}.co-cost-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.co-cost-error{color:#a33b35;font-size:13px;line-height:1.6;margin:12px 0}.co-cost-status{color:#176c50;font-size:13px;line-height:1.6}.co-cost-centers button:disabled{opacity:.55;cursor:default}@container(max-width:550px){.co-cost-row{grid-template-columns:1fr;gap:8px}.co-cost-row .co-button{justify-self:start}.co-cost-tools>label:last-child{flex:1}.co-cost-editor{padding:16px}}`;
export function CompanyCostCentersPanel(props: CompanyCostCentersPanelProps) {
    const permissionsKey = props.effectivePermissions ? [...props.effectivePermissions].sort().join(',') : 'role';
    return <NativeWorkspaceStyleScope key={`${props.tenantId}:${props.roleKey}:${permissionsKey}`} css={[css]}>{<CostCentersScope key={`${props.tenantId}:${props.roleKey}:${permissionsKey}`} {...props}/>}</NativeWorkspaceStyleScope>;
}
function CostCentersScope({ tenantId, roleKey, effectivePermissions, onSaved, onNavigationGuardChange }: CompanyCostCentersPanelProps) {
    const scope = useMemo(() => ({ tenantId, roleKey, effectivePermissions }), [tenantId, roleKey, effectivePermissions]);
    const permitted = !enforcePermission(roleKey, 'business.tenant.manage', { effectivePermissions });
    const [snapshot, setSnapshot] = useState<CompanyCostCenterSnapshot>({ costCenters: [], organizations: [] });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [reloadRequired, setReloadRequired] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('active');
    const [draft, setDraft] = useState<CompanyCostCenterInput | null>(null);
    const [initial, setInitial] = useState<CompanyCostCenterInput | null>(null);
    const dirty = Boolean(draft && JSON.stringify(draft) !== JSON.stringify(initial));
    const confirmLeave = useUnsavedWebChanges(dirty, busy);
    const alive = useRef(true);
    const lock = useRef(false);
    const sequence = useRef(0);
    const formId = useId();
    useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current += 1; }; }, []);
    useEffect(() => { onNavigationGuardChange?.(confirmLeave); return () => onNavigationGuardChange?.(null); }, [confirmLeave, onNavigationGuardChange]);
    const reload = useCallback(async () => {
        const request = ++sequence.current;
        setLoading(true);
        setError('');
        const result = await loadCompanyCostCenters(scope);
        if (!alive.current || request !== sequence.current)
            return;
        if (result.ok) {
            setSnapshot(result.data);
            setReloadRequired(false);
        }
        else
            setError(result.error);
        setLoading(false);
    }, [scope]);
    useEffect(() => { if (permitted)
        void reload();
    else
        setLoading(false); }, [permitted, reload]);
    async function edit(item?: CompanyCostCenter) {
        if (!(await confirmLeave()))
            return;
        const next: CompanyCostCenterInput = item ? { id: item.id, expectedUpdatedAt: item.updatedAt, code: item.code, name: item.name, organizationId: item.organizationId, isActive: item.isActive } : empty();
        setInitial(next);
        setDraft(next);
        setError('');
        setNotice('');
    }
    async function close() { if (await confirmLeave()) {
        setDraft(null);
        setInitial(null);
        setError('');
    } }
    async function refresh() { if (await confirmLeave()) {
        setDraft(null);
        setInitial(null);
        setNotice('');
        await reload();
    } }
    async function save() {
        if (!draft || lock.current || loading || reloadRequired || !permitted)
            return;
        const invalid = validateCompanyCostCenter(draft);
        if (invalid) {
            setError(invalid);
            return;
        }
        lock.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const result = await saveCompanyCostCenter(scope, draft);
            if (!alive.current)
                return;
            if (!result.ok) {
                setError(result.error);
                setReloadRequired(Boolean(result.reloadRequired));
                return;
            }
            setSnapshot(previous => ({ ...previous, costCenters: [...previous.costCenters.filter(item => item.id !== result.data.id), result.data].sort((a, b) => a.code.localeCompare(b.code, 'de')) }));
            setDraft(null);
            setInitial(null);
            setNotice(result.data.isActive ? 'Kostenstelle gespeichert.' : 'Kostenstelle deaktiviert. Vorhandene Zuordnungen bleiben erhalten.');
            onSaved?.();
        }
        finally {
            lock.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    if (!permitted)
        return null;
    const filtered = snapshot.costCenters.filter(item => (filter === 'all' || (filter === 'active' ? item.isActive : !item.isActive)) && `${item.code} ${item.name}`.toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE')));
    const patch = <K extends keyof CompanyCostCenterInput>(key: K, value: CompanyCostCenterInput[K]) => setDraft(previous => previous ? { ...previous, [key]: value } : previous);
    return <NativeWorkspaceStyleScope css={[css, css]}>{<NativeSection className="co-panel co-cost-centers" aria-labelledby={`${formId}-title`}><NativeStyle>{css}</NativeStyle>
    <NativeDiv className="co-content-heading"><NativeDiv><NativeH3 id={`${formId}-title`}>Kostenstellen</NativeH3><NativeP>Ausgaben und Leistungen den passenden Bereichen zuordnen. {snapshot.costCenters.filter(item => item.isActive).length} aktive Kostenstellen.</NativeP></NativeDiv><NativeButton className="co-button co-button--primary" disabled={loading || busy || reloadRequired} onClick={() => void edit()}>Kostenstelle anlegen</NativeButton></NativeDiv>
    {loading ? <NativeP role="status" className="co-subtle">Kostenstellen werden geladen …</NativeP> : null}
    {error ? <NativeP className="co-cost-error" role="alert">{error}</NativeP> : null}{notice ? <NativeP className="co-cost-status" role="status">{notice}</NativeP> : null}
    {draft ? <NativeForm className="co-cost-editor" onSubmit={event => { event.preventDefault(); void save(); }}><NativeH3>{draft.id ? 'Kostenstelle bearbeiten' : 'Neue Kostenstelle'}</NativeH3>
      <NativeFieldset disabled={busy || reloadRequired || loading} style={{ border: 0, padding: 0, margin: 0 }}><NativeDiv className="co-cost-form">
        <NativeLabel className="co-cost-field"><NativeSpan>Kürzel *</NativeSpan><NativeInput autoFocus value={draft.code} onChange={event => patch('code', event.target.value)} maxLength={40} required placeholder="Zum Beispiel VERW"/></NativeLabel>
        <NativeLabel className="co-cost-field"><NativeSpan>Bezeichnung *</NativeSpan><NativeInput value={draft.name} onChange={event => patch('name', event.target.value)} maxLength={160} required placeholder="Zum Beispiel Verwaltung"/></NativeLabel>
        <NativeLabel className="co-cost-field"><NativeSpan>Arbeitsbereich</NativeSpan><NativeSelect value={draft.organizationId ?? ''} onChange={event => patch('organizationId', event.target.value || null)}><NativeOption value="">Keine Zuordnung</NativeOption>{snapshot.organizations.filter(item => item.isActive || item.id === draft.organizationId).map(item => <NativeOption key={item.id} value={item.id}>{item.name}{item.isActive ? '' : ' · inaktiv'}</NativeOption>)}</NativeSelect></NativeLabel>
        <NativeLabel className="co-cost-field"><NativeSpan>Status</NativeSpan><NativeSelect value={draft.isActive ? 'active' : 'inactive'} onChange={event => patch('isActive', event.target.value === 'active')}><NativeOption value="active">Aktiv</NativeOption><NativeOption value="inactive">Inaktiv</NativeOption></NativeSelect></NativeLabel>
      </NativeDiv></NativeFieldset><NativeP className="co-subtle">Deaktivierte Kostenstellen bleiben für bestehende Zuordnungen erhalten.</NativeP><NativeDiv className="co-cost-actions"><NativeButton className="co-button co-button--primary" disabled={busy || reloadRequired || loading || Boolean(draft.id && !dirty)} type="submit">{busy ? 'Speichern …' : 'Kostenstelle speichern'}</NativeButton><NativeButton className="co-button" disabled={busy} type="button" onClick={() => void close()}>Abbrechen</NativeButton></NativeDiv></NativeForm> : null}
    <NativeDiv className="co-cost-tools"><NativeLabel><NativeSpan>Kostenstelle suchen</NativeSpan><NativeInput type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Kürzel oder Bezeichnung"/></NativeLabel><NativeLabel><NativeSpan>Anzeigen</NativeSpan><NativeSelect value={filter} onChange={event => setFilter(event.target.value)}><NativeOption value="active">Aktive</NativeOption><NativeOption value="inactive">Inaktive</NativeOption><NativeOption value="all">Alle</NativeOption></NativeSelect></NativeLabel></NativeDiv>
    <NativeDiv className="co-cost-list">{filtered.map(item => <NativeArticle key={item.id} className="co-cost-row"><NativeSpan className="co-cost-code">{item.code}</NativeSpan><NativeDiv><NativeStrong>{item.name}</NativeStrong><NativeSmall>{item.isActive ? 'Aktiv' : 'Inaktiv'}{item.organizationId ? ` · ${snapshot.organizations.find(organization => organization.id === item.organizationId)?.name ?? 'Bisheriger Arbeitsbereich'}` : ''}</NativeSmall></NativeDiv><NativeButton className="co-button" disabled={busy || reloadRequired || loading} onClick={() => void edit(item)}>Bearbeiten</NativeButton></NativeArticle>)}</NativeDiv>
    {!filtered.length && !loading ? <NativeP className="co-panel-intro">{snapshot.costCenters.length ? 'Für diese Auswahl wurden keine Kostenstellen gefunden.' : 'Noch keine Kostenstellen hinterlegt. Legen Sie die erste Kostenstelle für Ihr Unternehmen an.'}</NativeP> : null}
    <NativeDiv className="co-cost-actions" style={{ marginTop: 18 }}><NativeButton className="co-button" disabled={busy || loading} onClick={() => void refresh()}>{reloadRequired || error ? 'Aktuellen Stand laden' : 'Aktualisieren'}</NativeButton></NativeDiv>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
