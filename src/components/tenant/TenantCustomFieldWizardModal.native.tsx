// Generated native presentation from src/components/tenant/TenantCustomFieldWizardModal.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSpan,NativeDiv,NativeStrong,NativeButton,NativeStyle,NativeForm,NativeFieldset,NativeSection,NativeH3,NativeP,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeSmall,NativeTextarea,NativeDetails,NativeSummary,NativeCode,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import type { PermissionKey } from '@/types';
import { useEffect, useId, useRef, useState } from 'react';
import { PlatformModal } from "../layout/platform/platformmodal.tsx";
import { usePermissions } from '@/hooks/usePermissions';
import { TENANT_SETTINGS_PERMISSION } from '@/lib/tenant/tenantSettingsRoute';
import { resolveCustomFieldPlaceholder, saveTenantCustomFieldDefinition } from '@/lib/tenant/tenantCustomFieldService';
import { buildCustomFieldInput, createCustomFieldDraft, createCustomFieldKey, CUSTOM_FIELD_FUNCTION_LABELS, CUSTOM_FIELD_TYPE_LABELS, validateCustomFieldDraft, } from '@/lib/tenant/tenantCustomFieldEditor';
import type { CustomFieldDataType, TenantCustomFieldDefinition, TenantModuleKey } from '@/types/tenant/tenantCenter';
export type TenantCustomFieldWizardModalProps = {
    visible: boolean;
    tenantId: string;
    effectivePermissions?: readonly PermissionKey[];
    field?: TenantCustomFieldDefinition | null;
    onClose: () => void;
    onSaved: (fields?: TenantCustomFieldDefinition[]) => void;
};
const MODULE_LABELS: Record<TenantModuleKey, string> = { assist: 'Assist', pflege: 'Pflege', stationaer: 'Stationär', beratung: 'Beratung' };
export function TenantCustomFieldWizardModal(props: TenantCustomFieldWizardModalProps) {
    if (!props.visible)
        return null;
    return <NativeWorkspaceStyleScope css={[CUSTOM_FIELD_CSS]}>{<CustomFieldEditor key={`${props.tenantId}:${props.field?.id ?? props.field?.fieldKey ?? 'new'}`} {...props}/>}</NativeWorkspaceStyleScope>;
}
function CustomFieldEditor({ tenantId, field, onClose, onSaved, effectivePermissions }: TenantCustomFieldWizardModalProps) {
    const window = useNativeWorkflowWindow();
    const { roleKey, can } = usePermissions();
    const canEdit = effectivePermissions ? effectivePermissions.includes(TENANT_SETTINGS_PERMISSION) : can(TENANT_SETTINGS_PERMISSION);
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
        if (!dirty)
            return;
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
        if (savingRef.current)
            return;
        if (dirty)
            setDiscard(true);
        else
            onClose();
    }
    async function save() {
        if (savingRef.current || !canEdit)
            return;
        setSubmitted(true);
        setSaveError(null);
        if (Object.keys(errors).length)
            return;
        savingRef.current = true;
        setSaving(true);
        setDiscard(false);
        try {
            const result = await saveTenantCustomFieldDefinition(tenantId, buildCustomFieldInput(draft, persistedField), roleKey);
            if (!mounted.current)
                return;
            if (!result.ok) {
                setSaveError(result.error);
                if (result.savedId) {
                    const confirmed = { ...buildCustomFieldInput(draft, persistedField), id: result.savedId };
                    const confirmedDraft = createCustomFieldDraft(confirmed);
                    setPersistedField(confirmed);
                    setInitial(confirmedDraft);
                    setDraft(confirmedDraft);
                    setKeyEdited(true);
                    setRefreshPending(true);
                }
                return;
            }
            onSaved(result.data);
            onClose();
        }
        catch {
            if (mounted.current)
                setSaveError('Das Feld konnte nicht gespeichert werden. Bitte versuchen Sie es erneut. Ihre Eingaben bleiben erhalten.');
        }
        finally {
            savingRef.current = false;
            if (mounted.current)
                setSaving(false);
        }
    }
    const fieldError = (name: string) => submitted && errors[name] ? <NativeSpan className="cs-company-custom-error" id={`${formId}-${name}-error`}>{errors[name]}</NativeSpan> : null;
    const footer = <NativeDiv className="cs-company-custom cs-company-custom-footer-surface">
    {discard ? <NativeDiv className="cs-company-custom-discard" role="alert">
      <NativeStrong>Änderungen verwerfen?</NativeStrong><NativeSpan>Ihre Eingaben sind noch nicht gespeichert.</NativeSpan>
      <NativeDiv className="cs-company-custom-actions"><NativeButton type="button" onClick={() => setDiscard(false)}>Weiter bearbeiten</NativeButton><NativeButton type="button" className="cs-company-custom-danger" onClick={onClose}>Verwerfen und schließen</NativeButton></NativeDiv>
    </NativeDiv> : <NativeDiv className="cs-company-custom-footer">
      <NativeSpan aria-live="polite">{saving ? 'Feld wird gespeichert …' : dirty ? 'Ungespeicherte Änderungen' : refreshPending ? 'Feld gespeichert · Liste nicht aktualisiert' : persistedField ? 'Gespeichertes Feld' : 'Neues individuelles Feld'}</NativeSpan>
      <NativeDiv className="cs-company-custom-actions"><NativeButton type="button" disabled={saving} onClick={close}>Abbrechen</NativeButton><NativeButton type="submit" form={formId} className="cs-company-custom-primary" disabled={saving || !canEdit || (Boolean(persistedField) && !dirty && !refreshPending)}>{saving ? 'Wird gespeichert …' : refreshPending && !dirty ? 'Erneut speichern' : persistedField ? 'Änderungen speichern' : 'Feld anlegen'}</NativeButton></NativeDiv>
    </NativeDiv>}
  </NativeDiv>;
    return <NativeWorkspaceStyleScope css={[CUSTOM_FIELD_CSS, CUSTOM_FIELD_CSS]}>{<PlatformModal surfaceScope="company" visible title={persistedField ? 'Individuelles Feld bearbeiten' : 'Individuelles Feld anlegen'} subtitle="Eigene Angaben für Ihr Unternehmen definieren" onClose={close} maxWidth={850} minWidth={260} maxHeightRatio={0.93} dismissOnBackdrop={!saving} footerContent={footer} bodyStyle={{ backgroundColor: '#f4f8fd', padding: 22 }} sheetStyle={{ backgroundColor: '#f4f8fd' }}>
    <NativeStyle>{CUSTOM_FIELD_CSS}</NativeStyle>
    <NativeForm id={formId} className="cs-company-custom" noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
      {!canEdit && <NativeDiv className="cs-company-custom-banner" role="alert">Sie haben keine Berechtigung, individuelle Unternehmensfelder zu bearbeiten.</NativeDiv>}
      {saveError && <NativeDiv className="cs-company-custom-banner" role="alert">{saveError}</NativeDiv>}
      {submitted && Object.keys(errors).length > 0 && <NativeDiv className="cs-company-custom-banner" role="alert">Bitte prüfen Sie die markierten Angaben.</NativeDiv>}
      <NativeFieldset disabled={saving || !canEdit}>
        <NativeSection className="cs-company-custom-section" aria-label="Feld und Eingabe">
          <NativeDiv className="cs-company-custom-section-heading"><NativeSpan>01</NativeSpan><NativeDiv><NativeH3>Feld und Eingabe</NativeH3><NativeP>Wählen Sie eine Bezeichnung, die beim Ausfüllen verständlich ist.</NativeP></NativeDiv></NativeDiv>
          <NativeLabel className="cs-company-custom-label" htmlFor={`${formId}-label`}>Bezeichnung <NativeSpan>Pflichtangabe</NativeSpan></NativeLabel>
          <NativeInput id={`${formId}-label`} autoFocus value={definition.label} placeholder="Zum Beispiel: Interne Kundennummer" aria-invalid={submitted && Boolean(errors.label)} aria-describedby={submitted && errors.label ? `${formId}-label-error` : undefined} onChange={event => {
            const label = event.target.value;
            setDraft(current => ({ ...current, definition: { ...current.definition, label, ...(!keyEdited ? { fieldKey: createCustomFieldKey(label) } : {}) } }));
            setSaveError(null);
            setDiscard(false);
        }}/>
          {fieldError('label')}
          <NativeDiv className="cs-company-custom-grid">
            <NativeDiv><NativeLabel className="cs-company-custom-label" htmlFor={`${formId}-type`}>Art der Eingabe</NativeLabel><NativeSelect id={`${formId}-type`} value={definition.dataType} disabled={Boolean(persistedField)} onChange={event => patch('dataType', event.target.value as CustomFieldDataType)}>{Object.entries(CUSTOM_FIELD_TYPE_LABELS).map(([value, label]) => <NativeOption key={value} value={value}>{label}</NativeOption>)}</NativeSelect>{persistedField && <NativeP className="cs-company-custom-note">Die Eingabeart bleibt erhalten, damit vorhandene Angaben weiter passen.</NativeP>}</NativeDiv>
            <NativeLabel className="cs-company-custom-toggle"><NativeInput type="checkbox" checked={definition.validation.required === true} onChange={event => patch('validation', { ...definition.validation, required: event.target.checked })}/><NativeSpan><NativeStrong>Pflichtfeld</NativeStrong><NativeSmall>Beim Ausfüllen ist eine Angabe erforderlich.</NativeSmall></NativeSpan></NativeLabel>
          </NativeDiv>
          {definition.dataType === 'select' && <NativeDiv><NativeLabel className="cs-company-custom-label" htmlFor={`${formId}-options`}>Auswahlmöglichkeiten</NativeLabel><NativeTextarea id={`${formId}-options`} rows={4} value={draft.optionsText} placeholder={'Eine Möglichkeit pro Zeile\nZum Beispiel: Telefon\nE-Mail\nPersönlich'} aria-invalid={submitted && Boolean(errors.options)} aria-describedby={`${formId}-options-hint${submitted && errors.options ? ` ${formId}-options-error` : ''}`} onChange={event => { setDraft(current => ({ ...current, optionsText: event.target.value })); setSaveError(null); setDiscard(false); }}/><NativeP id={`${formId}-options-hint`} className="cs-company-custom-note">Eine Möglichkeit pro Zeile. Die Reihenfolge wird übernommen.</NativeP>{fieldError('options')}</NativeDiv>}
        </NativeSection>
        <NativeSection className="cs-company-custom-section" aria-label="Verwendung und Sichtbarkeit">
          <NativeDiv className="cs-company-custom-section-heading"><NativeSpan>02</NativeSpan><NativeDiv><NativeH3>Verwendung</NativeH3><NativeP>Diese Einstellungen werden mit der Felddefinition gespeichert.</NativeP></NativeDiv></NativeDiv>
          <NativeDiv className="cs-company-custom-grid">
            <NativeDiv><NativeLabel className="cs-company-custom-label" htmlFor={`${formId}-module`}>Geltungsbereich</NativeLabel><NativeSelect id={`${formId}-module`} value={definition.moduleKey ?? ''} onChange={event => patch('moduleKey', event.target.value || null)}><NativeOption value="">Unternehmensweit</NativeOption><NativeOption value="assist">Assist</NativeOption>{existingModule && <NativeOption value={existingModule}>{MODULE_LABELS[existingModule]} · bestehende Zuordnung</NativeOption>}</NativeSelect></NativeDiv>
            <NativeDiv><NativeLabel className="cs-company-custom-label" htmlFor={`${formId}-function`}>Verwendungszweck</NativeLabel><NativeSelect id={`${formId}-function`} value={definition.functionKey ?? ''} onChange={event => patch('functionKey', event.target.value || null)}><NativeOption value="">Alle Zwecke</NativeOption>{Object.entries(CUSTOM_FIELD_FUNCTION_LABELS).map(([value, label]) => <NativeOption key={value} value={value}>{label}</NativeOption>)}{existingFunction && <NativeOption value={existingFunction}>Bisheriger Verwendungszweck</NativeOption>}</NativeSelect></NativeDiv>
          </NativeDiv>
          <NativeDiv className="cs-company-custom-grid">
            <NativeLabel className="cs-company-custom-toggle"><NativeInput type="checkbox" checked={definition.visibility.office === true} onChange={event => patch('visibility', { ...definition.visibility, office: event.target.checked })}/><NativeSpan><NativeStrong>Verwaltung</NativeStrong><NativeSmall>Für Verwaltungsformulare vorsehen</NativeSmall></NativeSpan></NativeLabel>
            <NativeLabel className="cs-company-custom-toggle"><NativeInput type="checkbox" checked={definition.visibility.portal === true} onChange={event => patch('visibility', { ...definition.visibility, portal: event.target.checked })}/><NativeSpan><NativeStrong>Portale</NativeStrong><NativeSmall>Für Portalformulare vorsehen</NativeSmall></NativeSpan></NativeLabel>
          </NativeDiv>
          <NativeP className="cs-company-custom-note">Damit wird das Feld vorbereitet. Bestehende Formulare und Portale werden dadurch nicht automatisch erweitert.</NativeP>
          <NativeLabel className="cs-company-custom-toggle"><NativeInput type="checkbox" checked={definition.isActive} onChange={event => patch('isActive', event.target.checked)}/><NativeSpan><NativeStrong>Feld aktiv verwenden</NativeStrong><NativeSmall>Inaktive Felder bleiben erhalten und können später wieder aktiviert werden.</NativeSmall></NativeSpan></NativeLabel>
        </NativeSection>
        <NativeDetails className="cs-company-custom-advanced" open={submitted && Boolean(errors.fieldKey) ? true : undefined}>
          <NativeSummary>Erweitert: Dokumentplatzhalter</NativeSummary>
          <NativeDiv><NativeLabel className="cs-company-custom-label" htmlFor={`${formId}-key`}>Schlüssel</NativeLabel><NativeInput id={`${formId}-key`} value={definition.fieldKey} disabled={Boolean(persistedField)} spellCheck={false} autoCapitalize="none" aria-invalid={submitted && Boolean(errors.fieldKey)} aria-describedby={`${formId}-key-hint${submitted && errors.fieldKey ? ` ${formId}-fieldKey-error` : ''}`} onChange={event => { setKeyEdited(true); patch('fieldKey', event.target.value); }}/><NativeP className="cs-company-custom-note" id={`${formId}-key-hint`}>{persistedField ? 'Der Schlüssel bleibt unverändert, damit bestehende Verweise erhalten bleiben.' : 'Wird aus der Bezeichnung gebildet. Sie können ihn vor dem Anlegen ändern.'}</NativeP>{fieldError('fieldKey')}<NativeCode>{placeholder}</NativeCode><NativeP className="cs-company-custom-note">Kennung für Dokumentvorlagen, die individuelle Unternehmensfelder unterstützen.</NativeP></NativeDiv>
        </NativeDetails>
      </NativeFieldset>
    </NativeForm>
  </PlatformModal>}</NativeWorkspaceStyleScope>;
}
const CUSTOM_FIELD_CSS = `
.cs-company-custom{font-family:inherit;color:#15304e;font-size:14px;line-height:1.5;min-width:0;box-sizing:border-box;color-scheme:light}
.cs-company-custom *{box-sizing:border-box}.cs-company-custom fieldset{border:0;padding:0;margin:0;display:grid;gap:16px;min-width:0}
.cs-company-custom-section{padding:20px;border:1px solid #d7e3f1;border-radius:20px;background:linear-gradient(140deg,#ffffff,#f7faff);display:grid;gap:12px;min-width:0}
.cs-company-custom-section-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:3px}.cs-company-custom-section-heading>span{flex:0 0 32px;height:32px;display:grid;place-items:center;border-radius:11px;background:#ffffff;color:#59708c;font-size:12px;font-weight:700}
.cs-company-custom h3{margin:0;font-size:16px;font-weight:700;color:#15304e}.cs-company-custom p{margin:2px 0 0;color:#59708c;font-size:12px;line-height:1.55}
.cs-company-custom-label{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;font-weight:600;font-size:13px;color:#15304e;margin-bottom:5px}.cs-company-custom-label>span{font-size:11px;color:#59708c;font-weight:400}
.cs-company-custom input:not([type=checkbox]),.cs-company-custom select,.cs-company-custom textarea{width:100%;min-width:0;background:#ffffff;border:1px solid #c5d6e9;border-radius:11px;min-height:43px;padding:10px 12px;color:#15304e;font:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
.cs-company-custom textarea{resize:vertical;line-height:1.6}.cs-company-custom input::placeholder,.cs-company-custom textarea::placeholder{color:#59708c}.cs-company-custom select{padding-right:25px}.cs-company-custom option{background:#ffffff;color:#15304e}
.cs-company-custom input:focus-visible,.cs-company-custom select:focus-visible,.cs-company-custom textarea:focus-visible,.cs-company-custom button:focus-visible,.cs-company-custom summary:focus-visible{outline:2px solid #1764d4;outline-offset:3px}
.cs-company-custom [aria-invalid=true]{border-color:#e7c2c0!important}.cs-company-custom input:disabled,.cs-company-custom select:disabled{color:#59708c;opacity:1;background:#ffffff}.cs-company-custom-error{font-size:12px;color:#a33b35;display:block}
.cs-company-custom-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}.cs-company-custom-note{padding-top:3px}
.cs-company-custom-toggle{display:flex;align-items:center;gap:11px;border:1px solid #d7e3f1;border-radius:13px;padding:13px;min-height:72px;cursor:pointer;background:#f4f8fd;min-width:0}
.cs-company-custom-toggle input{flex:0 0 18px;width:18px;height:18px;accent-color:#1764d4;margin:0}.cs-company-custom-toggle strong{display:block;font-size:13px;font-weight:600}.cs-company-custom-toggle small{display:block;color:#59708c;line-height:1.45;margin-top:2px}
.cs-company-custom-advanced{border:1px solid #d7e3f1;border-radius:15px;overflow:hidden}.cs-company-custom-advanced summary{cursor:pointer;font-size:13px;font-weight:600;padding:14px 16px;color:#15304e}.cs-company-custom-advanced>div{padding:0 16px 16px}.cs-company-custom code{display:block;padding:12px;margin-top:12px;border:1px dashed #d7e3f1;border-radius:10px;color:#1764d4;background:#eaf2ff;white-space:normal;overflow-wrap:anywhere;font-size:12px}
.cs-company-custom-banner{padding:12px 15px;border:1px solid #d7e3f1;border-radius:12px;background:#ffffff;color:#15304e;margin-bottom:14px;font-size:13px}
.cs-company-custom-footer-surface{background:#f4f8fd;border-radius:14px;padding:12px}
.cs-company-custom-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.cs-company-custom-footer>span{color:#59708c;font-size:12px}.cs-company-custom-actions{display:flex;gap:9px;flex-wrap:wrap}.cs-company-custom button{appearance:none;border:1px solid #c5d6e9;background:#ffffff;color:#15304e;border-radius:12px;min-height:42px;padding:10px 16px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}.cs-company-custom button:hover{background:#e6f0ff}.cs-company-custom button.cs-company-custom-primary{background:linear-gradient(135deg,#1764d4,#1558ba);border-color:#2269cd;color:#ffffff;box-shadow:0 5px 18px #12325014}.cs-company-custom button:disabled{opacity:.55;cursor:default}.cs-company-custom button.cs-company-custom-danger{background:#fff4f3;border-color:#e7c2c0;color:#a33b35}
.cs-company-custom-discard{border:1px solid #ead4a6;background:#fff8ea;border-radius:14px;padding:14px;display:grid;gap:6px}.cs-company-custom-discard>span{color:#86570f;font-size:13px}.cs-company-custom-discard .cs-company-custom-actions{margin-top:8px}
@media(max-width:620px){.cs-company-custom-grid{grid-template-columns:1fr}.cs-company-custom-section{padding:15px;border-radius:16px}.cs-company-custom-footer{align-items:stretch}.cs-company-custom-footer>.cs-company-custom-actions{width:100%}.cs-company-custom-actions button{flex:1 1 auto}.cs-company-custom-section-heading{gap:9px}}
@media(prefers-reduced-motion:reduce){.cs-company-custom *{transition:none!important}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
