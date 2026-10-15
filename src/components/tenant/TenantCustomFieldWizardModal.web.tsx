import { useEffect, useId, useRef, useState } from 'react';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { usePermissions } from '@/hooks/usePermissions';
import { TENANT_SETTINGS_PERMISSION } from '@/lib/tenant/tenantSettingsRoute';
import { resolveCustomFieldPlaceholder, saveTenantCustomFieldDefinition } from '@/lib/tenant/tenantCustomFieldService';
import {
  buildCustomFieldInput, createCustomFieldDraft, createCustomFieldKey, CUSTOM_FIELD_FUNCTION_LABELS,
  CUSTOM_FIELD_TYPE_LABELS, validateCustomFieldDraft,
} from '@/lib/tenant/tenantCustomFieldEditor';
import type { CustomFieldDataType, TenantCustomFieldDefinition, TenantModuleKey } from '@/types/tenant/tenantCenter';

export type TenantCustomFieldWizardModalProps = {
  visible: boolean;
  tenantId: string;
  field?: TenantCustomFieldDefinition | null;
  onClose: () => void;
  onSaved: (fields?: TenantCustomFieldDefinition[]) => void;
};

const MODULE_LABELS: Record<TenantModuleKey, string> = { assist: 'Assist', pflege: 'Pflege', stationaer: 'Stationär', beratung: 'Beratung' };

export function TenantCustomFieldWizardModal(props: TenantCustomFieldWizardModalProps) {
  if (!props.visible) return null;
  return <CustomFieldEditor key={`${props.tenantId}:${props.field?.id ?? props.field?.fieldKey ?? 'new'}`} {...props} />;
}

function CustomFieldEditor({ tenantId, field, onClose, onSaved }: TenantCustomFieldWizardModalProps) {
  const { roleKey, can } = usePermissions();
  const canEdit = can(TENANT_SETTINGS_PERMISSION);
  const [initial, setInitial] = useState(() => createCustomFieldDraft(field));
  const [persistedField, setPersistedField] = useState(field);
  const [refreshPending, setRefreshPending] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [keyEdited, setKeyEdited] = useState(Boolean(field));
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  const formId = useId();
  const errors = validateCustomFieldDraft(draft, persistedField);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const definition = draft.definition;
  const placeholder = resolveCustomFieldPlaceholder(definition.fieldKey || 'feldname');
  const existingModule = field?.moduleKey && field.moduleKey !== 'assist' ? field.moduleKey : null;
  const existingFunction = field?.functionKey && !CUSTOM_FIELD_FUNCTION_LABELS[field.functionKey] ? field.functionKey : null;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty]);

  function patch(key: keyof typeof definition, value: unknown) {
    setDraft(current => ({ ...current, definition: { ...current.definition, [key]: value } }));
    setSaveError(null);
    setDiscard(false);
  }

  function close() {
    if (savingRef.current) return;
    if (dirty) setDiscard(true);
    else onClose();
  }

  async function save() {
    if (savingRef.current || !canEdit) return;
    setSubmitted(true);
    setSaveError(null);
    if (Object.keys(errors).length) return;
    savingRef.current = true;
    setSaving(true);
    setDiscard(false);
    try {
      const result = await saveTenantCustomFieldDefinition(tenantId, buildCustomFieldInput(draft, persistedField), roleKey);
      if (!mounted.current) return;
      if (!result.ok) {
        setSaveError(result.error);
        if (result.savedId) {
          const confirmed = { ...buildCustomFieldInput(draft, persistedField), id: result.savedId };
          const confirmedDraft = createCustomFieldDraft(confirmed);
          setPersistedField(confirmed); setInitial(confirmedDraft); setDraft(confirmedDraft); setKeyEdited(true); setRefreshPending(true);
        }
        return;
      }
      onSaved(result.data);
      onClose();
    } catch {
      if (mounted.current) setSaveError('Das Feld konnte nicht gespeichert werden. Bitte versuchen Sie es erneut. Ihre Eingaben bleiben erhalten.');
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const fieldError = (name: string) => submitted && errors[name] ? <span className="cs-company-custom-error" id={`${formId}-${name}-error`}>{errors[name]}</span> : null;
  const footer = <div className="cs-company-custom cs-company-custom-footer-surface">
    {discard ? <div className="cs-company-custom-discard" role="alert">
      <strong>Änderungen verwerfen?</strong><span>Ihre Eingaben sind noch nicht gespeichert.</span>
      <div className="cs-company-custom-actions"><button type="button" onClick={() => setDiscard(false)}>Weiter bearbeiten</button><button type="button" className="cs-company-custom-danger" onClick={onClose}>Verwerfen und schließen</button></div>
    </div> : <div className="cs-company-custom-footer">
      <span aria-live="polite">{saving ? 'Feld wird gespeichert …' : dirty ? 'Ungespeicherte Änderungen' : refreshPending ? 'Feld gespeichert · Liste nicht aktualisiert' : persistedField ? 'Gespeichertes Feld' : 'Neues individuelles Feld'}</span>
      <div className="cs-company-custom-actions"><button type="button" disabled={saving} onClick={close}>Abbrechen</button><button type="submit" form={formId} className="cs-company-custom-primary" disabled={saving || !canEdit || (Boolean(persistedField) && !dirty && !refreshPending)}>{saving ? 'Wird gespeichert …' : refreshPending && !dirty ? 'Erneut speichern' : persistedField ? 'Änderungen speichern' : 'Feld anlegen'}</button></div>
    </div>}
  </div>;

  return <PlatformModal surfaceScope="company" visible title={persistedField ? 'Individuelles Feld bearbeiten' : 'Individuelles Feld anlegen'} subtitle="Eigene Angaben für Ihr Unternehmen definieren" onClose={close} maxWidth={850} minWidth={260} maxHeightRatio={0.93} dismissOnBackdrop={!saving} footerContent={footer} bodyStyle={{ backgroundColor: '#0b162a', padding: 22 }} sheetStyle={{ backgroundColor: '#0b162a' }}>
    <style>{CUSTOM_FIELD_CSS}</style>
    <form id={formId} className="cs-company-custom" noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
      {!canEdit && <div className="cs-company-custom-banner" role="alert">Sie haben keine Berechtigung, individuelle Unternehmensfelder zu bearbeiten.</div>}
      {saveError && <div className="cs-company-custom-banner" role="alert">{saveError}</div>}
      {submitted && Object.keys(errors).length > 0 && <div className="cs-company-custom-banner" role="alert">Bitte prüfen Sie die markierten Angaben.</div>}
      <fieldset disabled={saving || !canEdit}>
        <section className="cs-company-custom-section" aria-label="Feld und Eingabe">
          <div className="cs-company-custom-section-heading"><span>01</span><div><h3>Feld und Eingabe</h3><p>Wählen Sie eine Bezeichnung, die beim Ausfüllen verständlich ist.</p></div></div>
          <label className="cs-company-custom-label" htmlFor={`${formId}-label`}>Bezeichnung <span>Pflichtangabe</span></label>
          <input id={`${formId}-label`} autoFocus value={definition.label} placeholder="Zum Beispiel: Interne Kundennummer" aria-invalid={submitted && Boolean(errors.label)} aria-describedby={submitted && errors.label ? `${formId}-label-error` : undefined} onChange={event => {
            const label = event.target.value;
            setDraft(current => ({ ...current, definition: { ...current.definition, label, ...(!keyEdited ? { fieldKey: createCustomFieldKey(label) } : {}) } }));
            setSaveError(null); setDiscard(false);
          }} />
          {fieldError('label')}
          <div className="cs-company-custom-grid">
            <div><label className="cs-company-custom-label" htmlFor={`${formId}-type`}>Art der Eingabe</label><select id={`${formId}-type`} value={definition.dataType} disabled={Boolean(persistedField)} onChange={event => patch('dataType', event.target.value as CustomFieldDataType)}>{Object.entries(CUSTOM_FIELD_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{persistedField && <p className="cs-company-custom-note">Die Eingabeart bleibt erhalten, damit vorhandene Angaben weiter passen.</p>}</div>
            <label className="cs-company-custom-toggle"><input type="checkbox" checked={definition.validation.required === true} onChange={event => patch('validation', { ...definition.validation, required: event.target.checked })} /><span><strong>Pflichtfeld</strong><small>Beim Ausfüllen ist eine Angabe erforderlich.</small></span></label>
          </div>
          {definition.dataType === 'select' && <div><label className="cs-company-custom-label" htmlFor={`${formId}-options`}>Auswahlmöglichkeiten</label><textarea id={`${formId}-options`} rows={4} value={draft.optionsText} placeholder={'Eine Möglichkeit pro Zeile\nZum Beispiel: Telefon\nE-Mail\nPersönlich'} aria-invalid={submitted && Boolean(errors.options)} aria-describedby={`${formId}-options-hint${submitted && errors.options ? ` ${formId}-options-error` : ''}`} onChange={event => { setDraft(current => ({ ...current, optionsText: event.target.value })); setSaveError(null); setDiscard(false); }} /><p id={`${formId}-options-hint`} className="cs-company-custom-note">Eine Möglichkeit pro Zeile. Die Reihenfolge wird übernommen.</p>{fieldError('options')}</div>}
        </section>
        <section className="cs-company-custom-section" aria-label="Verwendung und Sichtbarkeit">
          <div className="cs-company-custom-section-heading"><span>02</span><div><h3>Verwendung</h3><p>Diese Einstellungen werden mit der Felddefinition gespeichert.</p></div></div>
          <div className="cs-company-custom-grid">
            <div><label className="cs-company-custom-label" htmlFor={`${formId}-module`}>Geltungsbereich</label><select id={`${formId}-module`} value={definition.moduleKey ?? ''} onChange={event => patch('moduleKey', event.target.value || null)}><option value="">Unternehmensweit</option><option value="assist">Assist</option>{existingModule && <option value={existingModule}>{MODULE_LABELS[existingModule]} · bestehende Zuordnung</option>}</select></div>
            <div><label className="cs-company-custom-label" htmlFor={`${formId}-function`}>Verwendungszweck</label><select id={`${formId}-function`} value={definition.functionKey ?? ''} onChange={event => patch('functionKey', event.target.value || null)}><option value="">Alle Zwecke</option>{Object.entries(CUSTOM_FIELD_FUNCTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}{existingFunction && <option value={existingFunction}>Bisheriger Verwendungszweck</option>}</select></div>
          </div>
          <div className="cs-company-custom-grid">
            <label className="cs-company-custom-toggle"><input type="checkbox" checked={definition.visibility.office === true} onChange={event => patch('visibility', { ...definition.visibility, office: event.target.checked })} /><span><strong>Verwaltung</strong><small>Für Verwaltungsformulare vorsehen</small></span></label>
            <label className="cs-company-custom-toggle"><input type="checkbox" checked={definition.visibility.portal === true} onChange={event => patch('visibility', { ...definition.visibility, portal: event.target.checked })} /><span><strong>Portale</strong><small>Für Portalformulare vorsehen</small></span></label>
          </div>
          <p className="cs-company-custom-note">Damit wird das Feld vorbereitet. Bestehende Formulare und Portale werden dadurch nicht automatisch erweitert.</p>
          <label className="cs-company-custom-toggle"><input type="checkbox" checked={definition.isActive} onChange={event => patch('isActive', event.target.checked)} /><span><strong>Feld aktiv verwenden</strong><small>Inaktive Felder bleiben erhalten und können später wieder aktiviert werden.</small></span></label>
        </section>
        <details className="cs-company-custom-advanced" open={submitted && Boolean(errors.fieldKey) ? true : undefined}>
          <summary>Erweitert: Dokumentplatzhalter</summary>
          <div><label className="cs-company-custom-label" htmlFor={`${formId}-key`}>Schlüssel</label><input id={`${formId}-key`} value={definition.fieldKey} disabled={Boolean(persistedField)} spellCheck={false} autoCapitalize="none" aria-invalid={submitted && Boolean(errors.fieldKey)} aria-describedby={`${formId}-key-hint${submitted && errors.fieldKey ? ` ${formId}-fieldKey-error` : ''}`} onChange={event => { setKeyEdited(true); patch('fieldKey', event.target.value); }} /><p className="cs-company-custom-note" id={`${formId}-key-hint`}>{persistedField ? 'Der Schlüssel bleibt unverändert, damit bestehende Verweise erhalten bleiben.' : 'Wird aus der Bezeichnung gebildet. Sie können ihn vor dem Anlegen ändern.'}</p>{fieldError('fieldKey')}<code>{placeholder}</code><p className="cs-company-custom-note">Kennung für Dokumentvorlagen, die individuelle Unternehmensfelder unterstützen.</p></div>
        </details>
      </fieldset>
    </form>
  </PlatformModal>;
}

const CUSTOM_FIELD_CSS = `
.cs-company-custom{font-family:inherit;color:#edf5ff;font-size:14px;line-height:1.5;min-width:0;box-sizing:border-box;color-scheme:dark}
.cs-company-custom *{box-sizing:border-box}.cs-company-custom fieldset{border:0;padding:0;margin:0;display:grid;gap:16px;min-width:0}
.cs-company-custom-section{padding:20px;border:1px solid #263b55;border-radius:20px;background:linear-gradient(140deg,rgba(21,42,66,.82),rgba(12,25,44,.9));display:grid;gap:12px;min-width:0}
.cs-company-custom-section-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:3px}.cs-company-custom-section-heading>span{flex:0 0 32px;height:32px;display:grid;place-items:center;border-radius:11px;background:#163b50;color:#8ce9f7;font-size:12px;font-weight:700}
.cs-company-custom h3{margin:0;font-size:16px;font-weight:700;color:#f3f8ff}.cs-company-custom p{margin:2px 0 0;color:#b4c6dc;font-size:12px;line-height:1.55}
.cs-company-custom-label{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;font-weight:600;font-size:13px;color:#e7f0ff;margin-bottom:5px}.cs-company-custom-label>span{font-size:11px;color:#9fb9d0;font-weight:400}
.cs-company-custom input:not([type=checkbox]),.cs-company-custom select,.cs-company-custom textarea{width:100%;min-width:0;background:#09182b;border:1px solid #3b526e;border-radius:11px;min-height:43px;padding:10px 12px;color:#f1f6ff;font:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
.cs-company-custom textarea{resize:vertical;line-height:1.6}.cs-company-custom input::placeholder,.cs-company-custom textarea::placeholder{color:#8fa6bf}.cs-company-custom select{padding-right:25px}.cs-company-custom option{background:#102239;color:#f1f6ff}
.cs-company-custom input:focus-visible,.cs-company-custom select:focus-visible,.cs-company-custom textarea:focus-visible,.cs-company-custom button:focus-visible,.cs-company-custom summary:focus-visible{outline:2px solid #7cdef5;outline-offset:3px}
.cs-company-custom [aria-invalid=true]{border-color:#fa9d9d!important}.cs-company-custom input:disabled,.cs-company-custom select:disabled{color:#adc0d3;opacity:1;background:#122037}.cs-company-custom-error{font-size:12px;color:#ffb6b6;display:block}
.cs-company-custom-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}.cs-company-custom-note{padding-top:3px}
.cs-company-custom-toggle{display:flex;align-items:center;gap:11px;border:1px solid #2b455f;border-radius:13px;padding:13px;min-height:72px;cursor:pointer;background:rgba(8,22,39,.5);min-width:0}
.cs-company-custom-toggle input{flex:0 0 18px;width:18px;height:18px;accent-color:#47c6e7;margin:0}.cs-company-custom-toggle strong{display:block;font-size:13px;font-weight:600}.cs-company-custom-toggle small{display:block;color:#b4c6dc;line-height:1.45;margin-top:2px}
.cs-company-custom-advanced{border:1px solid #2b405b;border-radius:15px;overflow:hidden}.cs-company-custom-advanced summary{cursor:pointer;font-size:13px;font-weight:600;padding:14px 16px;color:#bde9fa}.cs-company-custom-advanced>div{padding:0 16px 16px}.cs-company-custom code{display:block;padding:12px;margin-top:12px;border:1px dashed #3d6078;border-radius:10px;color:#9fe8f3;background:#0b1d30;white-space:normal;overflow-wrap:anywhere;font-size:12px}
.cs-company-custom-banner{padding:12px 15px;border:1px solid #885054;border-radius:12px;background:#3c2330;color:#ffd4d4;margin-bottom:14px;font-size:13px}
.cs-company-custom-footer-surface{background:#0b162a;border-radius:14px;padding:12px}
.cs-company-custom-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.cs-company-custom-footer>span{color:#adc2da;font-size:12px}.cs-company-custom-actions{display:flex;gap:9px;flex-wrap:wrap}.cs-company-custom button{appearance:none;border:1px solid #3b5674;background:#152b44;color:#eaf3ff;border-radius:12px;min-height:42px;padding:10px 16px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}.cs-company-custom button:hover{background:#1d3a58}.cs-company-custom button.cs-company-custom-primary{background:linear-gradient(135deg,#2186d5,#37b7d4);border-color:#69d0ed;color:#fff;box-shadow:0 5px 18px #0474a320}.cs-company-custom button:disabled{opacity:.55;cursor:default}.cs-company-custom button.cs-company-custom-danger{background:#602c3a;border-color:#bc6779;color:#ffe1e7}
.cs-company-custom-discard{border:1px solid #6f5262;background:#2b2031;border-radius:14px;padding:14px;display:grid;gap:6px}.cs-company-custom-discard>span{color:#d7bfcf;font-size:13px}.cs-company-custom-discard .cs-company-custom-actions{margin-top:8px}
@media(max-width:620px){.cs-company-custom-grid{grid-template-columns:1fr}.cs-company-custom-section{padding:15px;border-radius:16px}.cs-company-custom-footer{align-items:stretch}.cs-company-custom-footer>.cs-company-custom-actions{width:100%}.cs-company-custom-actions button{flex:1 1 auto}.cs-company-custom-section-heading{gap:9px}}
@media(prefers-reduced-motion:reduce){.cs-company-custom *{transition:none!important}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
