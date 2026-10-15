import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PermissionKey, RoleKey } from '@/types';
import type { CompanyAccessProfile, CompanyScopeGrant } from '@/types/tenant/companyAccess';
import type { CompanyOrganizationSnapshot } from '@/types/tenant/companyOrganization';
import { loadCompanyScopeGrants, saveCompanyScopeGrant } from '@/lib/tenant/companyAccessService.web';
import { loadCompanyOrganization } from '@/lib/tenant/companyOrganizationService.web';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import { confirmAction } from '@/lib/platform/confirmAction';

type Props = { tenantId: string; roleKey: RoleKey | null; actorProfileId?: string | null; effectivePermissions: readonly PermissionKey[]; onNavigationGuardChange?: (guard: (() => Promise<boolean>) | null) => void };
const grantKey = (grant: CompanyScopeGrant) => `${grant.kind}:${grant.targetId}`;
const signature = (limited: boolean, grants: readonly CompanyScopeGrant[]) => `${limited}:${grants.map(grantKey).sort().join(',')}`;
const css = `.co-access{display:grid;gap:22px;container-type:inline-size}.co-access-layout{display:grid;grid-template-columns:minmax(210px,300px) minmax(0,1fr);gap:22px}.co-access-people{display:flex;flex-direction:column;gap:8px}.co-access-person{display:grid;gap:6px;text-align:left;background:#ffffff;border:1px solid #d7e3f1;border-radius:14px;color:#15304e;padding:14px;font:inherit;cursor:pointer}.co-access-person[aria-pressed=true]{background:#e6f0ff;border-color:#8cb4e7}.co-access-person small,.co-access small{color:#59708c;line-height:1.5}.co-access-editor{padding:22px;background:#ffffff;border:1px solid #d7e3f1;border-radius:18px;min-width:0}.co-access-editor h3{margin:0 0 8px}.co-access-editor p{line-height:1.65;color:#59708c}.co-access-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:18px;margin:20px 0}.co-access fieldset{min-width:0;margin:0;border:1px solid #d7e3f1;border-radius:12px;padding:12px}.co-access legend{font-size:13px;font-weight:600;padding:0 6px;color:#15304e}.co-access label{display:flex;align-items:flex-start;gap:10px;padding:9px 0;line-height:1.5;overflow-wrap:anywhere;color:#15304e}.co-access input[type=checkbox]{width:18px;height:18px;margin-top:3px;flex-shrink:0;accent-color:#1764d4}.co-access .co-action{padding:12px 18px;border:1px solid #d7e3f1;border-radius:12px;background:#ffffff;color:#1764d4;font:inherit;font-weight:650;cursor:pointer}.co-access-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}.co-access button:focus-visible,.co-access input:focus-visible{outline:3px solid #1764d4;outline-offset:3px}.co-access button:disabled{opacity:.55;cursor:default}.co-access-notice{padding:14px 18px;border:1px solid #d7e3f1;background:#ffffff;color:#15304e;border-radius:12px;line-height:1.6}.co-access-error{border-color:#e7c2c0;background:#fff4f3;color:#a33b35}.co-access-header{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}@container(max-width:760px){.co-access-layout{grid-template-columns:1fr}.co-access-editor{padding:16px}.co-access-people{max-height:240px;overflow:auto}}`;

export function CompanyScopeAccessPanel({ tenantId, roleKey, actorProfileId, effectivePermissions, onNavigationGuardChange }: Props) {
  const [profiles, setProfiles] = useState<CompanyAccessProfile[]>([]);
  const [organization, setOrganization] = useState<CompanyOrganizationSnapshot | null>(null);
  const [selected, setSelected] = useState('');
  const [limited, setLimited] = useState(false);
  const [grants, setGrants] = useState<CompanyScopeGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadRequired, setReloadRequired] = useState(false);
  const alive = useRef(true);
  const sequence = useRef(0);
  const lock = useRef(false);
  const scope = useMemo(() => ({ tenantId, actorRoleKey: roleKey, actorProfileId, effectivePermissions }), [tenantId, roleKey, actorProfileId, effectivePermissions]);
  const person = profiles.find(item => item.id === selected);
  const dirty = Boolean(person && signature(limited, grants) !== signature(person.scopeLimited, person.grants));
  const guard = useUnsavedWebChanges(dirty, busy);
  useEffect(() => { onNavigationGuardChange?.(guard); return () => onNavigationGuardChange?.(null); }, [guard, onNavigationGuardChange]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current += 1; }; }, []);
  const load = useCallback(async () => {
    const request = ++sequence.current; setLoading(true); setError(null);
    try {
      const [people, structure] = await Promise.all([loadCompanyScopeGrants(tenantId), loadCompanyOrganization(scope)]);
      if (!alive.current || request !== sequence.current) return false;
      if (!people.ok || !structure.ok) { setError(!people.ok ? people.error : !structure.ok ? structure.error : 'Die Zugriffe konnten nicht geladen werden.'); return false; }
      setProfiles(people.data.profiles); setOrganization(structure.data); setSelected(''); setGrants([]); setLimited(false); setReloadRequired(false); return true;
    } catch { if (alive.current && request === sequence.current) setError('Die Zugriffsbereiche konnten nicht geladen werden.'); return false; }
    finally { if (alive.current && request === sequence.current) setLoading(false); }
  }, [tenantId, scope]);
  useEffect(() => { void load(); }, [load]);
  async function select(profile: CompanyAccessProfile) {
    if (!(await guard()) || !alive.current) return;
    setSelected(profile.id); setLimited(profile.scopeLimited); setGrants(profile.grants); setNotice(null);
  }
  async function reload() { if (await guard()) { setNotice(null); await load(); } }
  async function save() {
    if (!person || person.isCurrentProfile || !dirty || lock.current || loading || reloadRequired) return;
    const accepted = await confirmAction({ title: 'Zugriffsbereiche speichern?', message: limited ? grants.length ? `Der Zugriff von ${person.displayName} wird auf die ausgewählten Unternehmensbereiche begrenzt.` : `${person.displayName} erhält keinen Zugriff auf die neuen Unternehmensbereiche, bis ein Bereich zugeordnet wird.` : `Die zusätzliche Bereichsbeschränkung für ${person.displayName} wird aufgehoben. Die vorhandenen Rollenrechte gelten weiterhin.`, confirmLabel: 'Zugriffe speichern', cancelLabel: 'Weiter bearbeiten' });
    if (!accepted || !alive.current || lock.current) return;
    lock.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      const result = await saveCompanyScopeGrant(tenantId, { profileId: person.id, limited, grants: limited ? grants : [], expectedVersion: person.version });
      if (!alive.current) return;
      if (!result.ok) { setError(result.error); setReloadRequired(true); return; }
      const refreshed = await load();
      if (alive.current) { setNotice('Zugriffsbereiche gespeichert.'); if (!refreshed) setReloadRequired(true); }
    } catch { if (alive.current) { setError('Der Speicherstand ist unklar. Bitte neu laden und die Zugriffe prüfen.'); setReloadRequired(true); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const blocked = busy || loading || reloadRequired;
  function toggle(grant: CompanyScopeGrant) { setGrants(current => current.some(item => grantKey(item) === grantKey(grant)) ? current.filter(item => grantKey(item) !== grantKey(grant)) : [...current, grant]); }
  const groups = organization ? [
    { kind: 'entity' as const, title: 'Gesellschaften', records: organization.entities },
    { kind: 'site' as const, title: 'Standorte', records: organization.sites },
    { kind: 'department' as const, title: 'Abteilungen', records: organization.departments },
  ] : [];
  function recordLabel(record: (typeof groups)[number]['records'][number]) {
    const context = ['entityId' in record && record.entityId ? organization?.entities.find(entity => entity.id === record.entityId)?.name : null, 'siteId' in record && record.siteId ? organization?.sites.find(site => site.id === record.siteId)?.name : null].filter(Boolean);
    return [record.name, ...context, record.code ? `Kennung ${record.code}` : null].filter(Boolean).join(' · ');
  }
  return <section className="co-access" aria-label="Zugriffsbereiche" aria-busy={loading || busy}>
    <style>{css}</style><div className="co-access-header"><div><h2>Zugriffsbereiche</h2><p>Unternehmensdaten gezielt für Standorte, Abteilungen und Gesellschaften freigeben.</p></div><button type="button" className="co-text-action" onClick={() => void reload()} disabled={busy || loading}>Neu laden</button></div>
    {error ? <div role="alert" className="co-access-notice co-access-error">{error}{reloadRequired ? ' Vor weiteren Änderungen bitte neu laden.' : ''}</div> : null}
    {notice ? <div role="status" className="co-access-notice">{notice}</div> : null}
    {loading && !organization ? <p role="status">Zugriffsbereiche werden geladen …</p> : organization ? <div className="co-access-layout">
      <nav className="co-access-people" aria-label="Person für Zugriffsbereiche auswählen">{profiles.map(profile => <button type="button" key={profile.id} className="co-access-person" aria-pressed={selected === profile.id} disabled={blocked} onClick={() => void select(profile)}><strong>{profile.displayName}</strong><small>{profile.scopeLimited ? `${profile.grants.length} Bereiche` : 'Ohne zusätzliche Bereichsbeschränkung'}{profile.isCurrentProfile ? ' · Sie' : ''}</small></button>)}{!profiles.length ? <p>Keine Unternehmenszugänge verfügbar.</p> : null}</nav>
      <div className="co-access-editor">{person ? <><h3>{person.displayName}</h3><p>Die Auswahl begrenzt vorhandene Rollenrechte. Abteilungen und Standorte geben nur ihre zugeordneten Datensätze frei. Eine Gesellschaft schließt ihre Standorte und Abteilungen ein.</p>
        {person.isCurrentProfile ? <p role="status">Eigene Zugriffsbereiche können Sie hier nicht ändern. Wenden Sie sich dafür an eine weitere Administration.</p> : null}
        {person.hasLegacyLimits ? <p role="status">Für diesen Zugang bestehen zusätzlich ältere Einschränkungen. Sie werden durch diese Auswahl nicht aufgehoben.</p> : null}
        <label><input type="checkbox" checked={limited} disabled={blocked || person.isCurrentProfile} onChange={event => { setLimited(event.target.checked); if (!event.target.checked) setGrants([]); }} />Auf ausgewählte Unternehmensbereiche begrenzen</label>
        {limited ? <div className="co-access-options">{groups.map(group => <fieldset key={group.kind} disabled={blocked || person.isCurrentProfile}><legend>{group.title}</legend>{group.records.filter(record => record.status !== 'archived' || grants.some(grant => grant.kind === group.kind && grant.targetId === record.id)).map(record => <label key={record.id}><input type="checkbox" checked={grants.some(grant => grant.kind === group.kind && grant.targetId === record.id)} onChange={() => toggle({ kind: group.kind, targetId: record.id })} />{recordLabel(record)}{record.status === 'archived' ? ' (archiviert)' : ''}</label>)}{!group.records.length ? <small>Noch keine Einträge vorhanden.</small> : null}</fieldset>)}</div> : null}
        {limited && !grants.length ? <p>Ohne ausgewählten Bereich bleiben die neuen Unternehmensbereiche für diesen Zugang gesperrt.</p> : null}
        <small>Diese Einschränkungen gelten für die neue Unternehmensstruktur, ihre Ressourcen und das zugeordnete Inventar. Andere Fachbereiche behalten ihre eigenen Zugriffsregeln.</small>
        <div className="co-access-actions"><button type="button" className="co-action" disabled={blocked || !dirty || person.isCurrentProfile || grants.length > 100} onClick={() => void save()}>{busy ? 'Wird gespeichert …' : 'Zugriffe speichern'}</button>{grants.length > 100 ? <span role="alert">Maximal 100 Bereiche pro Zugang.</span> : null}</div>
      </> : <><h3>Zugang auswählen</h3><p>Wählen Sie eine Person aus, um ihre Unternehmensbereiche festzulegen.</p></>}</div>
    </div> : null}
  </section>;
}
