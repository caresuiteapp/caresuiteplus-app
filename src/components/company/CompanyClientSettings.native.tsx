// Generated native presentation from src/components/company/CompanyClientSettings.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeStyle,NativeHeader,NativeSpan,NativeH1,NativeP,NativeButton,NativeForm,NativeFieldset,NativeLabel,NativeTextarea,NativeInput,NativeSmall,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { PlatformModal } from "../layout/platform/platformmodal.tsx";
import { COMPANY_EDITOR_CSS } from "../tenant/forms/TenantCompanyEditorForms.native.tsx";
import { LiquidCommandShell } from '@/liquid-command/shell/LiquidCommandShell';
import { useFlowRouter } from "../../hooks/useFlowRouter.ts";
import type { ServiceResult } from '@/types';
export function CompanyClientSettingsFrame({ title, description, children }: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    const router = useFlowRouter();
    return <NativeWorkspaceStyleScope css={[COMPANY_EDITOR_CSS, SETTINGS_CSS, COMPANY_EDITOR_CSS, SETTINGS_CSS]}>{<LiquidCommandShell activeModule="office" activeArea="company" title={title} subtitle="Unternehmen" contentMode="fill" showPageHeader={false} showContextBar={false}>
    <NativeDiv className="cs-client-settings-scroll"><NativeDiv className="cs-company-editor cs-client-settings" data-cs-company-surface="light"><NativeStyle>{COMPANY_EDITOR_CSS}{SETTINGS_CSS}</NativeStyle>
      <NativeHeader className="cs-client-settings-heading"><NativeDiv><NativeSpan>Unternehmen</NativeSpan><NativeH1>{title}</NativeH1><NativeP>{description}</NativeP></NativeDiv><NativeButton type="button" onClick={() => router.back()}>Zurück</NativeButton></NativeHeader>{children}
    </NativeDiv></NativeDiv>
  </LiquidCommandShell>}</NativeWorkspaceStyleScope>;
}
export function CompanySettingsFeedback({ error, message, onRetry, loading }: {
    error?: string | null;
    message?: string | null;
    onRetry?: () => void;
    loading?: boolean;
}) {
    return <NativeWorkspaceStyleScope css={[COMPANY_EDITOR_CSS, SETTINGS_CSS]}>{<>{error ? <NativeDiv className="cs-company-save-error" role="alert">{error}{onRetry ? <NativeButton type="button" disabled={loading} onClick={onRetry}>Erneut laden</NativeButton> : null}</NativeDiv> : null}{message ? <NativeP className="cs-client-settings-success" role="status">{message}</NativeP> : null}</>}</NativeWorkspaceStyleScope>;
}
export type SettingsEditorField = {
    key: string;
    label: string;
    hint?: string;
    required?: boolean;
    multiline?: boolean;
    numeric?: boolean;
};
export function CompanySettingsEditor<T>({ title, initial, fields, onSave, onSaved, onClose }: {
    title: string;
    initial: Record<string, string>;
    fields: SettingsEditorField[];
    onSave: (values: Record<string, string>) => Promise<ServiceResult<T>>;
    onSaved: (value: T) => void;
    onClose: () => void;
}) {
    const window = useNativeWorkflowWindow();
    const [baseline] = useState(initial);
    const [values, setValues] = useState(initial);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [discard, setDiscard] = useState(false);
    const pending = useRef(false);
    const mounted = useRef(true);
    const id = useId();
    const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => {
        if (!dirty && !saving)
            return;
        const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty, saving]);
    const close = () => { if (pending.current)
        return; if (dirty)
        setDiscard(true);
    else
        onClose(); };
    const save = async () => {
        if (pending.current || !dirty)
            return;
        if (fields.some(field => field.required && !values[field.key]?.trim())) {
            setError('Bitte alle Pflichtangaben ausfüllen.');
            return;
        }
        pending.current = true;
        setSaving(true);
        setError(null);
        setDiscard(false);
        try {
            const result = await onSave(values);
            if (!mounted.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            onSaved(result.data);
            onClose();
        }
        catch {
            if (mounted.current)
                setError('Speichern nicht möglich. Ihre Eingaben bleiben erhalten. Bitte erneut versuchen.');
        }
        finally {
            pending.current = false;
            if (mounted.current)
                setSaving(false);
        }
    };
    return <NativeWorkspaceStyleScope css={[COMPANY_EDITOR_CSS, SETTINGS_CSS, COMPANY_EDITOR_CSS]}>{<PlatformModal surfaceScope="company" visible title={title} subtitle="Unternehmen" onClose={close} dismissOnBackdrop={false} maxWidth={780} sheetStyle={{ backgroundColor: '#f4f8fd' }} bodyStyle={{ backgroundColor: '#f4f8fd' }} footerContent={<NativeDiv className="cs-company-editor">
    {discard ? <NativeDiv className="cs-company-discard" role="alert"><NativeP>Ungespeicherte Änderungen verwerfen?</NativeP><NativeDiv className="cs-company-editor-actions"><NativeButton type="button" onClick={() => setDiscard(false)}>Weiter bearbeiten</NativeButton><NativeButton type="button" className="cs-company-remove" onClick={onClose}>Änderungen verwerfen</NativeButton></NativeDiv></NativeDiv> : null}
    <NativeDiv className="cs-company-editor-status"><NativeP>{saving ? 'Wird gespeichert …' : dirty ? 'Noch nicht gespeichert' : 'Gespeicherter Stand'}</NativeP><NativeDiv className="cs-company-editor-actions"><NativeButton type="button" disabled={saving} onClick={close}>Abbrechen</NativeButton><NativeButton type="button" className="cs-company-primary" disabled={saving || !dirty} onClick={() => void save()}>Änderungen speichern</NativeButton></NativeDiv></NativeDiv>
  </NativeDiv>}><NativeDiv className="cs-company-editor"><NativeStyle>{COMPANY_EDITOR_CSS}</NativeStyle>{error ? <NativeDiv className="cs-company-save-error" role="alert">{error}</NativeDiv> : null}<NativeForm noValidate onSubmit={event => { event.preventDefault(); void save(); }}><NativeFieldset disabled={saving}><NativeDiv className="cs-company-form-group cs-company-fields">{fields.map(field => <NativeDiv key={field.key} className={`cs-company-field${field.multiline ? ' cs-company-wide' : ''}`}><NativeLabel htmlFor={`${id}-${field.key}`}>{field.label}{field.required ? ' *' : ''}</NativeLabel>{field.multiline ? <NativeTextarea id={`${id}-${field.key}`} rows={3} value={values[field.key] ?? ''} onChange={event => { setValues({ ...values, [field.key]: event.target.value }); setError(null); }}/> : <NativeInput id={`${id}-${field.key}`} inputMode={field.numeric ? 'decimal' : 'text'} value={values[field.key] ?? ''} required={field.required} onChange={event => { setValues({ ...values, [field.key]: event.target.value }); setError(null); }}/>}{field.hint ? <NativeSmall>{field.hint}</NativeSmall> : null}</NativeDiv>)}</NativeDiv></NativeFieldset></NativeForm></NativeDiv></PlatformModal>}</NativeWorkspaceStyleScope>;
}
const SETTINGS_CSS = `
.cs-client-settings-scroll{height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#9bb3ce #f4f8fd}.cs-client-settings{background:#f4f8fd;min-height:100%;padding:26px;border-radius:22px;container-type:inline-size}.cs-client-settings-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:25px}.cs-client-settings-heading>div{flex:1;min-width:200px}.cs-client-settings-heading span{font-size:12px;color:#59708c}.cs-client-settings-heading h1{font-size:25px;line-height:1.35;margin:9px 0;color:#15304e;font-weight:650}.cs-client-settings-heading p{margin:0;font-size:14px;color:#59708c;line-height:1.6;max-width:75ch}.cs-client-settings-toolbar{display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap;margin-bottom:20px}.cs-client-settings-toolbar .cs-company-field{max-width:320px;flex:1;min-width:190px}.cs-client-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.cs-client-settings-card{padding:22px;border:1px solid #d7e3f1;border-radius:19px;background:linear-gradient(145deg,#ffffff,#f7faff);min-width:0}.cs-client-settings-card h2{font-size:18px;line-height:1.4;color:#15304e;margin:0 0 8px;overflow-wrap:anywhere}.cs-client-settings-card p{color:#59708c;font-size:13px;line-height:1.6;margin:0 0 16px}.cs-client-settings-card dl{display:grid;gap:13px;margin:20px 0}.cs-client-settings-card dl>div{display:flex;justify-content:space-between;align-items:baseline;gap:15px;flex-wrap:wrap}.cs-client-settings-card dt{color:#59708c;font-size:12px}.cs-client-settings-card dd{margin:0;color:#15304e;font-size:14px;overflow-wrap:anywhere}.cs-client-settings-card footer{display:flex;flex-wrap:wrap;gap:9px;border-top:1px solid #d7e3f1;padding-top:17px}.cs-client-settings-rules{margin:18px 0 0;padding-top:16px;border-top:1px solid #d7e3f1}.cs-client-settings-rules strong{display:block;font-size:21px;line-height:1.5;color:#1764d4}.cs-client-settings-rules span{display:block;font-size:12px;color:#59708c;line-height:1.6;margin-top:5px}.cs-client-settings-rules button{margin-top:12px}.cs-client-settings-success{background:#edf8f3;border:1px solid #b7ddcc;padding:14px;border-radius:12px;color:#176c50;line-height:1.5}.cs-client-settings .cs-company-save-error button{margin-left:14px}.cs-client-settings-subtle{font-size:12px;color:#59708c;line-height:1.6}.cs-client-settings-note{padding:16px;border:1px solid #d7e3f1;border-radius:13px;color:#59708c;font-size:13px;line-height:1.7;margin-bottom:20px}
@container(max-width:700px){.cs-client-settings-grid{grid-template-columns:1fr}.cs-client-settings-card{padding:18px}.cs-client-settings-heading h1{font-size:22px}}@media(max-width:560px){.cs-client-settings{padding:17px}.cs-client-settings-heading{gap:13px}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
