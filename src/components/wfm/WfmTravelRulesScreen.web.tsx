import { useCallback, useEffect, useRef, useState } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { listWfmTravelRules, type WfmTravelRule } from '@/lib/wfm';
import { saveOfficeTravelRule } from '@/lib/wfm/wfmOfficePlanningActions.web';
import { TravelPolicyEditor } from '@/components/travel/TravelPolicyEditor';
import { DEFAULT_TRAVEL_COMPENSATION_POLICY } from '@/lib/travel/travelCompensationPolicy';
import { WfmSecondaryWorkspace, WfmWebNotice, useWfmUnsavedChanges } from './WfmSecondaryWorkspace.web';

const initial = { name: '', minGap: '0', maxGap: '180', roundTo: '5', mileage: '0', priority: '100', notes: '', paid: true, active: true, travelPolicy: DEFAULT_TRAVEL_COMPENSATION_POLICY };

export function WfmTravelRulesScreen() {
  const tenantId = useServiceTenantId(); const { user, profile } = useAuth(); const actorId = user?.id ?? profile?.id ?? ''; const { can, check, roleKey, permissions } = usePermissions(); const canManage = can('time.settings.manage');
  const scope = `${tenantId}:${actorId}:${roleKey}:${canManage}`; const scopeRef = useRef(scope); scopeRef.current = scope;
  const [editingId, setEditingId] = useState<string | null>(null); const [form, setForm] = useState(initial); const [open, setOpen] = useState(false); const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false); const lock = useRef(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useWfmUnsavedChanges(dirty, busy);
  useEffect(() => { setEditingId(null); setForm(initial); setDirty(false); setOpen(false); setError(''); setMessage(''); setBusy(false); lock.current = false; }, [scope]);
  const query = useAsyncQuery(useCallback(async () => tenantId ? listWfmTravelRules(tenantId) : { ok: true as const, data: [] }, [tenantId]), [tenantId], { enabled: !!tenantId && !!actorId && canManage, queryKey: scope });
  const change = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => { if (lock.current) return; setDirty(true); setForm(previous => ({ ...previous, [key]: value })); };
  const reset = () => { setForm(initial); setEditingId(null); setOpen(false); setDirty(false); setError(''); };
  const edit = (rule?: WfmTravelRule) => {
    if (busy || (dirty && !window.confirm('Ungespeicherte Änderungen verwerfen?'))) return;
    setEditingId(rule?.id ?? null); setForm(rule ? { name: rule.name, minGap: String(rule.minGapMinutes), maxGap: rule.maxGapMinutes == null ? '' : String(rule.maxGapMinutes), roundTo: String(rule.roundToMinutes), mileage: (rule.mileageRateCents / 100).toFixed(2).replace('.', ','), priority: String(rule.priority), notes: rule.notes, paid: rule.countsAsWorkTime, active: rule.isActive, travelPolicy: rule.travelPolicy } : initial); setOpen(true); setDirty(false); setError('');
  };
  const persist = async (override?: WfmTravelRule) => {
    if (lock.current || !tenantId || !actorId || !canManage || query.loading || query.error || query.refreshError) return;
    const minimum = Number(form.minGap); const maximum = form.maxGap.trim() ? Number(form.maxGap) : null; const priority = Number(form.priority); const mileage = Number(form.mileage.replace(',', '.'));
    if (!override && (!form.name.trim() || !form.minGap.trim() || !form.priority.trim() || !form.mileage.trim() || !Number.isInteger(minimum) || minimum < 0 || (maximum != null && (!Number.isInteger(maximum) || maximum < minimum)) || !Number.isInteger(priority) || priority < 0 || !Number.isFinite(mileage) || mileage < 0 || !/^\d+(?:[.,]\d{1,2})?$/.test(form.mileage.trim()))) { setError('Bitte Bezeichnung und gültige Zahlen eingeben. Maximalabstand darf nicht kleiner als Mindestabstand sein; Kilometerpauschale mit höchstens zwei Nachkommastellen.'); return; }
    lock.current = true; setBusy(true); setError(''); setMessage(''); const requestedScope = scope;
    try {
      const result = await saveOfficeTravelRule(override ? { ...override, tenantId, actorId } : { id: editingId ?? undefined, tenantId, actorId, name: form.name.trim(), minGapMinutes: minimum, maxGapMinutes: maximum, countsAsWorkTime: form.paid, roundToMinutes: Number(form.roundTo), mileageRateCents: Math.round(mileage * 100), travelPolicy: form.travelPolicy, priority, isActive: form.active, notes: form.notes }, roleKey, permissions);
      if (scopeRef.current !== requestedScope) return;
      if (!result.ok) { setError(result.error); return; }
      query.setData(previous => [...(previous ?? []).filter(rule => rule.id !== result.data.id), result.data].sort((a, b) => a.priority - b.priority));
      if (!override) reset(); setMessage(override ? `Regel ${result.data.isActive ? 'aktiviert' : 'deaktiviert'}.` : 'Fahrzeitregel gespeichert.'); await query.refresh();
    } catch (cause) { if (scopeRef.current === requestedScope) setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen.'); }
    finally { if (scopeRef.current === requestedScope) { lock.current = false; setBusy(false); } }
  };
  return <WfmSecondaryWorkspace title="Fahrzeitregeln" description="Wegezeiten, Fahrtarten und Kilometervergütung verwalten." actions={<div className="wts-actions"><button disabled={!canManage || busy || query.refreshing} onClick={() => void query.refresh()}>Aktualisieren</button><button className="wts-primary" disabled={!canManage || busy || query.loading || !!query.error} onClick={() => edit()}>Neue Regel</button></div>}>
    {!canManage ? <WfmWebNotice>{check('time.settings.manage').reason ?? 'Keine Berechtigung.'}</WfmWebNotice> : <>
      {query.loading && <WfmWebNotice>Fahrzeitregeln werden geladen…</WfmWebNotice>}{(query.error || query.refreshError) && <WfmWebNotice tone="error">{query.error || query.refreshError}</WfmWebNotice>}{error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}
      {open && <form className="wts-panel" onSubmit={event => { event.preventDefault(); void persist(); }}><h3>{editingId ? 'Regel bearbeiten' : 'Neue Regel'}</h3><fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0 }}><div className="wts-stack">
        <label className="wts-field">Bezeichnung<input value={form.name} onChange={e => change('name', e.target.value)} required maxLength={160} /></label>
        <div className="wts-grid"><label className="wts-field">Mindestabstand (Min.)<input type="number" min="0" step="1" value={form.minGap} onChange={e => change('minGap', e.target.value)} required /></label><label className="wts-field">Maximalabstand (Min.)<input type="number" min="0" step="1" value={form.maxGap} onChange={e => change('maxGap', e.target.value)} placeholder="Unbegrenzt" /></label><label className="wts-field">Rundung<select value={form.roundTo} onChange={e => change('roundTo', e.target.value)}>{[1, 5, 10, 15, 30].map(n => <option key={n} value={n}>{n} Minuten</option>)}</select></label><label className="wts-field">Kilometerpauschale (€/km)<input inputMode="decimal" value={form.mileage} onChange={e => change('mileage', e.target.value)} required /></label><label className="wts-field">Priorität<input type="number" min="0" step="1" value={form.priority} onChange={e => change('priority', e.target.value)} required /></label></div>
        <p>Kleinere Prioritätszahlen werden zuerst berücksichtigt. Ein leeres Maximalfeld bedeutet unbegrenzt.</p>
        <label className="wts-check"><input type="checkbox" checked={form.paid} onChange={e => change('paid', e.target.checked)} />Fahrzeit als Arbeitszeit werten</label><label className="wts-check"><input type="checkbox" checked={form.active} onChange={e => change('active', e.target.checked)} />Regel aktiv</label>
        <details><summary>Fahrtarten und Vergütungsmodell</summary><TravelPolicyEditor value={form.travelPolicy} onChange={value => change('travelPolicy', value)} compact /></details>
        <label className="wts-field">Interne Hinweise<textarea value={form.notes} onChange={e => change('notes', e.target.value)} /></label>
      </div></fieldset><div className="wts-actions"><button className="wts-primary" disabled={busy || !!query.refreshError}>{busy ? 'Wird gespeichert…' : 'Regel speichern'}</button><button type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Ungespeicherte Änderungen verwerfen?')) reset(); }}>Abbrechen</button></div></form>}
      <section className="wts-panel"><h3>Gespeicherte Regeln · {query.data?.length ?? 0}</h3>{!query.loading && !query.error && !(query.data ?? []).length && <div className="wts-empty">Noch keine Fahrzeitregeln. Legen Sie eine Regel für Ihr Unternehmen an.</div>}{(query.data ?? []).map(rule => <article className="wts-row" key={rule.id}><div className="wts-row-head"><strong>{rule.name}</strong><span className="wts-badge" data-tone={rule.isActive ? 'good' : 'muted'}>{rule.isActive ? 'Aktiv' : 'Inaktiv'}</span></div><p>{rule.minGapMinutes}–{rule.maxGapMinutes ?? '∞'} Minuten · Rundung {rule.roundToMinutes} Minuten · {(rule.mileageRateCents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €/km · {rule.countsAsWorkTime ? 'Arbeitszeit' : 'Keine Arbeitszeit'} · Priorität {rule.priority}</p>{rule.notes && <p>{rule.notes}</p>}<div className="wts-actions"><button disabled={busy || !!query.refreshError} onClick={() => edit(rule)}>Bearbeiten</button><button disabled={busy || !!query.refreshError || dirty} onClick={() => void persist({ ...rule, isActive: !rule.isActive })}>{rule.isActive ? 'Deaktivieren' : 'Aktivieren'}</button></div></article>)}</section>
    </>}
  </WfmSecondaryWorkspace>;
}
