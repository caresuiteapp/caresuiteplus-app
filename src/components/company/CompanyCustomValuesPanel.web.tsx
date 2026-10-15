import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PermissionKey, RoleKey } from '@/types';
import type { TenantCustomFieldDefinition } from '@/types/tenant/tenantCenter';
import { enforcePermission } from '@/lib/permissions';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import {
  canEditCompanyCustomValue, companyCustomValueOptions, loadCompanyCustomValues, parseCompanyCustomValue, saveCompanyCustomValue,
  type CompanyCustomValue, type CompanyCustomValueScope,
} from '@/lib/tenant/companyCustomValues.web';

export type CompanyCustomValuesPanelProps = {
  tenantId: string;
  roleKey: RoleKey | null;
  effectivePermissions?: readonly PermissionKey[];
  fields: readonly TenantCustomFieldDefinition[];
  onSaved?: () => void;
  onNavigationGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
};
const inputValue = (value: CompanyCustomValue['value']) => value === null ? '' : String(value);
const css = `.co-own-values{margin-top:20px}.co-own-values-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:18px;margin-top:20px}.co-own-value{min-width:0;display:grid;align-content:start;gap:8px}.co-own-value label{color:#e6f1ff;font-size:13px;font-weight:600;line-height:1.5}.co-own-value input,.co-own-value select,.co-own-value textarea{box-sizing:border-box;width:100%;min-height:44px;padding:11px 13px;border:1px solid #516d8c;border-radius:12px;background:#0b1a2e;color:#edf6ff;font:inherit;font-size:13px;line-height:1.5;outline:none;color-scheme:dark}.co-own-value textarea{resize:vertical;min-height:100px}.co-own-value :is(input,select,textarea):focus-visible{border-color:#87ceff;box-shadow:0 0 0 3px #48a5ed30}.co-own-value :is(input,select,textarea):disabled{opacity:.6}.co-own-value [aria-invalid=true]{border-color:#ff9b9b}.co-own-value small{color:#a9bdd5;font-size:12px;line-height:1.55;overflow-wrap:anywhere}.co-own-value .co-own-error,.co-own-error{color:#ffb8b8;font-size:13px;line-height:1.6}.co-own-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:22px;padding-top:18px;border-top:1px solid #324b66}.co-own-status{color:#b7e5d5;font-size:13px;line-height:1.6}.co-own-values p{line-height:1.65}.co-own-values button:disabled{opacity:.55;cursor:default}`;

export function CompanyCustomValuesPanel(props: CompanyCustomValuesPanelProps) {
  const permissionKey = props.effectivePermissions ? [...props.effectivePermissions].sort().join(',') : 'role';
  return <CustomValuesScope key={`${props.tenantId}:${props.roleKey}:${permissionKey}`} {...props} />;
}
function CustomValuesScope({ tenantId, roleKey, effectivePermissions, fields, onSaved, onNavigationGuardChange }: CompanyCustomValuesPanelProps) {
  const scope = useMemo<CompanyCustomValueScope>(() => ({ tenantId, roleKey, effectivePermissions }), [tenantId, roleKey, effectivePermissions]);
  const permitted = !enforcePermission(roleKey, 'business.tenant.manage', { effectivePermissions });
  const editable = fields.filter(canEditCompanyCustomValue);
  const idsKey = editable.map(field => field.id).sort().join(',');
  const fieldIds = useMemo(() => idsKey ? idsKey.split(',') : [], [idsKey]);
  const [values, setValues] = useState<Record<string, CompanyCustomValue>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const lock = useRef(false);
  const sequence = useRef(0);
  const current = useRef({ values, draft }); current.current = { values, draft };
  const dirtyIds = editable.filter(field => values[field.id!] && (draft[field.id!] ?? '') !== inputValue(values[field.id!].value)).map(field => field.id!);
  const confirmLeave = useUnsavedWebChanges(dirtyIds.length > 0, busy);
  const formId = useId();
  useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current += 1; }; }, []);
  useEffect(() => { onNavigationGuardChange?.(confirmLeave); return () => onNavigationGuardChange?.(null); }, [confirmLeave, onNavigationGuardChange]);
  const reload = useCallback(async (preserveEdits = true) => {
    const request = ++sequence.current; setLoading(true); setError('');
    const result = await loadCompanyCustomValues(scope, fieldIds);
    if (!alive.current || request !== sequence.current) return;
    if (!result.ok) { setError(result.error); setLoading(false); return; }
    const previous = current.current;
    const rows = Object.fromEntries(result.data.map(row => [row.definitionId, row]));
    setValues(rows);
    setDraft(Object.fromEntries(result.data.map(row => {
      const edited = preserveEdits && previous.values[row.definitionId] && previous.draft[row.definitionId] !== inputValue(previous.values[row.definitionId].value);
      return [row.definitionId, edited ? previous.draft[row.definitionId] : inputValue(row.value)];
    })));
    setErrors({}); setReloadRequired(false); setLoading(false);
  }, [scope, fieldIds]);
  useEffect(() => { if (permitted) void reload(); else setLoading(false); }, [permitted, reload]);
  async function save() {
    if (lock.current || !permitted || reloadRequired || loading) return;
    const invalid: Record<string, string> = {};
    for (const id of dirtyIds) { const field = editable.find(item => item.id === id)!; const parsed = parseCompanyCustomValue(field, draft[id] ?? ''); if (!parsed.ok) invalid[id] = parsed.error; }
    setErrors(invalid); setNotice(''); if (Object.keys(invalid).length) return;
    lock.current = true; setBusy(true); setError('');
    try {
      for (const id of dirtyIds) {
        const result = await saveCompanyCustomValue(scope, id, draft[id] ?? '', values[id].updatedAt);
        if (!alive.current) return;
        if (!result.ok) { setErrors(previous => ({ ...previous, [id]: result.error })); setReloadRequired(Boolean(result.reloadRequired)); setError('Die Bearbeitung wurde angehalten. Bereits bestätigte Angaben bleiben gespeichert.'); return; }
        setValues(previous => ({ ...previous, [id]: result.data }));
        setDraft(previous => ({ ...previous, [id]: inputValue(result.data.value) }));
      }
      setNotice('Eigene Angaben gespeichert.'); onSaved?.();
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function discardAndReload() { if (await confirmLeave()) { setNotice(''); await reload(false); } }
  if (!permitted) return null;
  return <section className="co-panel co-own-values" aria-labelledby={`${formId}-heading`}>
    <style>{css}</style>
    <div className="co-content-heading"><div><h3 id={`${formId}-heading`}>Ihre eigenen Unternehmensangaben</h3><p>Hinterlegte Felder ausfüllen und für passende Dokumentvorlagen verwenden.</p></div></div>
    {loading ? <p className="co-subtle" role="status">Angaben werden geladen …</p> : null}
    {error ? <p className="co-own-error" role="alert">{error}</p> : null}
    {!loading && !editable.length ? <p className="co-panel-intro">Legen Sie ein Feld an und geben Sie es für die Verwaltung frei. Danach können Sie den passenden Wert hier hinterlegen.</p> : null}
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="co-own-values-grid">{editable.map(field => {
        const id = field.id!; if (!values[id]) return null;
        const value = draft[id] ?? ''; const disabled = loading || busy || reloadRequired;
        const change = (next: string) => { setDraft(previous => ({ ...previous, [id]: next })); setErrors(previous => ({ ...previous, [id]: '' })); setNotice(''); };
        const inputProps = { id: `${formId}-${id}`, value, disabled, 'aria-invalid': Boolean(errors[id]), 'aria-describedby': errors[id] ? `${formId}-${id}-error` : `${formId}-${id}-hint`, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => change(event.target.value) };
        const options = companyCustomValueOptions(field);
        return <div className="co-own-value" key={id}><label htmlFor={`${formId}-${id}`}>{field.label}{field.validation.required === true ? ' *' : ''}</label>
          {field.dataType === 'multiline' ? <textarea {...inputProps} rows={3} /> : field.dataType === 'boolean' ? <select {...inputProps}><option value="">Nicht hinterlegt</option><option value="true">Ja</option><option value="false">Nein</option></select> : field.dataType === 'select' ? <select {...inputProps}><option value="">Bitte auswählen</option>{value && !options.some(option => option.value === value) ? <option value={value}>{value} · bisherige Angabe</option> : null}{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input {...inputProps} type={field.dataType === 'date' ? 'date' : 'text'} inputMode={field.dataType === 'number' ? 'decimal' : undefined} />}
          <small id={`${formId}-${id}-hint`}>{field.functionKey === 'documents' || !field.functionKey ? 'Für Dokumentvorlagen mit diesem Feld verfügbar.' : 'Für den hinterlegten Verwendungszweck gespeichert.'}</small>
          {errors[id] ? <small className="co-own-error" id={`${formId}-${id}-error`} role="alert">{errors[id]}</small> : null}
        </div>;
      })}</div>
      <div className="co-own-actions"><button className="co-button co-button--primary" disabled={!dirtyIds.length || busy || loading || reloadRequired} type="submit">{busy ? 'Speichern …' : 'Angaben speichern'}</button><button className="co-button" type="button" disabled={busy || loading} onClick={() => void discardAndReload()}>{reloadRequired || error ? 'Aktuellen Stand laden' : dirtyIds.length ? 'Änderungen verwerfen' : 'Aktualisieren'}</button>{notice ? <span className="co-own-status" role="status">{notice}</span> : null}</div>
    </form>
  </section>;
}
