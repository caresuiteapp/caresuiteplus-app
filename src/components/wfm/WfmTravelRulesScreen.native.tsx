// Generated native presentation from src/components/wfm/WfmTravelRulesScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeButton,NativeForm,NativeH3,NativeFieldset,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeP,NativeDetails,NativeSummary,NativeTextarea,NativeSection,NativeArticle,NativeStrong,NativeSpan} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { listWfmTravelRules, type WfmTravelRule } from '@/lib/wfm';
import { saveOfficeTravelRule } from "../../lib/wfm/wfmOfficePlanningActions.native.ts";
import { TravelPolicyEditor } from '@/components/travel/TravelPolicyEditor';
import { DEFAULT_TRAVEL_COMPENSATION_POLICY } from '@/lib/travel/travelCompensationPolicy';
import { WfmSecondaryWorkspace, WfmWebNotice, useWfmUnsavedChanges } from "./WfmSecondaryWorkspace.native.tsx";
const initial = { name: '', minGap: '0', maxGap: '180', roundTo: '5', mileage: '0', priority: '100', notes: '', paid: true, active: true, travelPolicy: DEFAULT_TRAVEL_COMPENSATION_POLICY };
export function WfmTravelRulesScreen() {
    const tenantId = useServiceTenantId();
    const { user, profile } = useAuth();
    const actorId = user?.id ?? profile?.id ?? '';
    const { can, check, roleKey, permissions } = usePermissions();
    const canManage = can('time.settings.manage');
    const scope = `${tenantId}:${actorId}:${roleKey}:${canManage}`;
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(initial);
    const [open, setOpen] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    useWfmUnsavedChanges(dirty, busy);
    useEffect(() => { setEditingId(null); setForm(initial); setDirty(false); setOpen(false); setError(''); setMessage(''); setBusy(false); lock.current = false; }, [scope]);
    const query = useAsyncQuery(useCallback(async () => tenantId ? listWfmTravelRules(tenantId) : { ok: true as const, data: [] }, [tenantId]), [tenantId], { enabled: !!tenantId && !!actorId && canManage, queryKey: scope });
    const change = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => { if (lock.current)
        return; setDirty(true); setForm(previous => ({ ...previous, [key]: value })); };
    const reset = () => { setForm(initial); setEditingId(null); setOpen(false); setDirty(false); setError(''); };
    const edit = async (rule?: WfmTravelRule) => {
        if (busy || (dirty && !await confirmNativeWorkspaceAction('Ungespeicherte Änderungen verwerfen?')))
            return;
        setEditingId(rule?.id ?? null);
        setForm(rule ? { name: rule.name, minGap: String(rule.minGapMinutes), maxGap: rule.maxGapMinutes == null ? '' : String(rule.maxGapMinutes), roundTo: String(rule.roundToMinutes), mileage: (rule.mileageRateCents / 100).toFixed(2).replace('.', ','), priority: String(rule.priority), notes: rule.notes, paid: rule.countsAsWorkTime, active: rule.isActive, travelPolicy: rule.travelPolicy } : initial);
        setOpen(true);
        setDirty(false);
        setError('');
    };
    const persist = async (override?: WfmTravelRule) => {
        if (lock.current || !tenantId || !actorId || !canManage || query.loading || query.error || query.refreshError)
            return;
        const minimum = Number(form.minGap);
        const maximum = form.maxGap.trim() ? Number(form.maxGap) : null;
        const priority = Number(form.priority);
        const mileage = Number(form.mileage.replace(',', '.'));
        if (!override && (!form.name.trim() || !form.minGap.trim() || !form.priority.trim() || !form.mileage.trim() || !Number.isInteger(minimum) || minimum < 0 || (maximum != null && (!Number.isInteger(maximum) || maximum < minimum)) || !Number.isInteger(priority) || priority < 0 || !Number.isFinite(mileage) || mileage < 0 || !/^\d+(?:[.,]\d{1,2})?$/.test(form.mileage.trim()))) {
            setError('Bitte Bezeichnung und gültige Zahlen eingeben. Maximalabstand darf nicht kleiner als Mindestabstand sein; Kilometerpauschale mit höchstens zwei Nachkommastellen.');
            return;
        }
        lock.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        const requestedScope = scope;
        try {
            const result = await saveOfficeTravelRule(override ? { ...override, tenantId, actorId } : { id: editingId ?? undefined, tenantId, actorId, name: form.name.trim(), minGapMinutes: minimum, maxGapMinutes: maximum, countsAsWorkTime: form.paid, roundToMinutes: Number(form.roundTo), mileageRateCents: Math.round(mileage * 100), travelPolicy: form.travelPolicy, priority, isActive: form.active, notes: form.notes }, roleKey, permissions);
            if (scopeRef.current !== requestedScope)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            query.setData(previous => [...(previous ?? []).filter(rule => rule.id !== result.data.id), result.data].sort((a, b) => a.priority - b.priority));
            if (!override)
                reset();
            setMessage(override ? `Regel ${result.data.isActive ? 'aktiviert' : 'deaktiviert'}.` : 'Fahrzeitregel gespeichert.');
            await query.refresh();
        }
        catch (cause) {
            if (scopeRef.current === requestedScope)
                setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen.');
        }
        finally {
            if (scopeRef.current === requestedScope) {
                lock.current = false;
                setBusy(false);
            }
        }
    };
    return <WfmSecondaryWorkspace title="Fahrzeitregeln" description="Wegezeiten, Fahrtarten und Kilometervergütung verwalten." actions={<NativeDiv className="wts-actions"><NativeButton disabled={!canManage || busy || query.refreshing} onClick={() => void query.refresh()}>Aktualisieren</NativeButton><NativeButton className="wts-primary" disabled={!canManage || busy || query.loading || !!query.error} onClick={async () => await edit()}>Neue Regel</NativeButton></NativeDiv>}>
    {!canManage ? <WfmWebNotice>{check('time.settings.manage').reason ?? 'Keine Berechtigung.'}</WfmWebNotice> : <>
      {query.loading && <WfmWebNotice>Fahrzeitregeln werden geladen…</WfmWebNotice>}{(query.error || query.refreshError) && <WfmWebNotice tone="error">{query.error || query.refreshError}</WfmWebNotice>}{error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}
      {open && <NativeForm className="wts-panel" onSubmit={event => { event.preventDefault(); void persist(); }}><NativeH3>{editingId ? 'Regel bearbeiten' : 'Neue Regel'}</NativeH3><NativeFieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0 }}><NativeDiv className="wts-stack">
        <NativeLabel className="wts-field">Bezeichnung<NativeInput value={form.name} onChange={e => change('name', e.target.value)} required maxLength={160}/></NativeLabel>
        <NativeDiv className="wts-grid"><NativeLabel className="wts-field">Mindestabstand (Min.)<NativeInput type="number" min="0" step="1" value={form.minGap} onChange={e => change('minGap', e.target.value)} required/></NativeLabel><NativeLabel className="wts-field">Maximalabstand (Min.)<NativeInput type="number" min="0" step="1" value={form.maxGap} onChange={e => change('maxGap', e.target.value)} placeholder="Unbegrenzt"/></NativeLabel><NativeLabel className="wts-field">Rundung<NativeSelect value={form.roundTo} onChange={e => change('roundTo', e.target.value)}>{[1, 5, 10, 15, 30].map(n => <NativeOption key={n} value={n}>{n} Minuten</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="wts-field">Kilometerpauschale (€/km)<NativeInput inputMode="decimal" value={form.mileage} onChange={e => change('mileage', e.target.value)} required/></NativeLabel><NativeLabel className="wts-field">Priorität<NativeInput type="number" min="0" step="1" value={form.priority} onChange={e => change('priority', e.target.value)} required/></NativeLabel></NativeDiv>
        <NativeP>Kleinere Prioritätszahlen werden zuerst berücksichtigt. Ein leeres Maximalfeld bedeutet unbegrenzt.</NativeP>
        <NativeLabel className="wts-check"><NativeInput type="checkbox" checked={form.paid} onChange={e => change('paid', e.target.checked)}/>Fahrzeit als Arbeitszeit werten</NativeLabel><NativeLabel className="wts-check"><NativeInput type="checkbox" checked={form.active} onChange={e => change('active', e.target.checked)}/>Regel aktiv</NativeLabel>
        <NativeDetails><NativeSummary>Fahrtarten und Vergütungsmodell</NativeSummary><TravelPolicyEditor value={form.travelPolicy} onChange={value => change('travelPolicy', value)} compact/></NativeDetails>
        <NativeLabel className="wts-field">Interne Hinweise<NativeTextarea value={form.notes} onChange={e => change('notes', e.target.value)}/></NativeLabel>
      </NativeDiv></NativeFieldset><NativeDiv className="wts-actions"><NativeButton className="wts-primary" disabled={busy || !!query.refreshError}>{busy ? 'Wird gespeichert…' : 'Regel speichern'}</NativeButton><NativeButton type="button" disabled={busy} onClick={async () => { if (!dirty || await confirmNativeWorkspaceAction('Ungespeicherte Änderungen verwerfen?'))
                reset(); }}>Abbrechen</NativeButton></NativeDiv></NativeForm>}
      <NativeSection className="wts-panel"><NativeH3>Gespeicherte Regeln · {query.data?.length ?? 0}</NativeH3>{!query.loading && !query.error && !(query.data ?? []).length && <NativeDiv className="wts-empty">Noch keine Fahrzeitregeln. Legen Sie eine Regel für Ihr Unternehmen an.</NativeDiv>}{(query.data ?? []).map(rule => <NativeArticle className="wts-row" key={rule.id}><NativeDiv className="wts-row-head"><NativeStrong>{rule.name}</NativeStrong><NativeSpan className="wts-badge" data-tone={rule.isActive ? 'good' : 'muted'}>{rule.isActive ? 'Aktiv' : 'Inaktiv'}</NativeSpan></NativeDiv><NativeP>{rule.minGapMinutes}–{rule.maxGapMinutes ?? '∞'} Minuten · Rundung {rule.roundToMinutes} Minuten · {(rule.mileageRateCents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €/km · {rule.countsAsWorkTime ? 'Arbeitszeit' : 'Keine Arbeitszeit'} · Priorität {rule.priority}</NativeP>{rule.notes && <NativeP>{rule.notes}</NativeP>}<NativeDiv className="wts-actions"><NativeButton disabled={busy || !!query.refreshError} onClick={async () => await edit(rule)}>Bearbeiten</NativeButton><NativeButton disabled={busy || !!query.refreshError || dirty} onClick={() => void persist({ ...rule, isActive: !rule.isActive })}>{rule.isActive ? 'Deaktivieren' : 'Aktivieren'}</NativeButton></NativeDiv></NativeArticle>)}</NativeSection>
    </>}
  </WfmSecondaryWorkspace>;
}
