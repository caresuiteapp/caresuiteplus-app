import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { COMPANY_EDITOR_CSS } from '@/components/tenant/forms/TenantCompanyEditorForms.web';
import { LiquidCommandShell } from '@/liquid-command/shell/LiquidCommandShell';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import type { ServiceResult } from '@/types';

export function CompanyClientSettingsFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const router = useFlowRouter();
  return <LiquidCommandShell activeModule="office" activeArea="company" title={title} subtitle="Unternehmen" contentMode="fill" showPageHeader={false} showContextBar={false}>
    <div className="cs-client-settings-scroll"><div className="cs-company-editor cs-client-settings" data-cs-company-surface="dark"><style>{COMPANY_EDITOR_CSS}{SETTINGS_CSS}</style>
      <header className="cs-client-settings-heading"><div><span>Unternehmen</span><h1>{title}</h1><p>{description}</p></div><button type="button" onClick={() => router.back()}>Zurück</button></header>{children}
    </div></div>
  </LiquidCommandShell>;
}

export function CompanySettingsFeedback({ error, message, onRetry, loading }: { error?: string | null; message?: string | null; onRetry?: () => void; loading?: boolean }) {
  return <>{error ? <div className="cs-company-save-error" role="alert">{error}{onRetry ? <button type="button" disabled={loading} onClick={onRetry}>Erneut laden</button> : null}</div> : null}{message ? <p className="cs-client-settings-success" role="status">{message}</p> : null}</>;
}

export type SettingsEditorField = { key: string; label: string; hint?: string; required?: boolean; multiline?: boolean; numeric?: boolean };
export function CompanySettingsEditor<T>({ title, initial, fields, onSave, onSaved, onClose }: {
  title: string; initial: Record<string, string>; fields: SettingsEditorField[];
  onSave: (values: Record<string, string>) => Promise<ServiceResult<T>>;
  onSaved: (value: T) => void; onClose: () => void;
}) {
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
    if (!dirty && !saving) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, saving]);
  const close = () => { if (pending.current) return; if (dirty) setDiscard(true); else onClose(); };
  const save = async () => {
    if (pending.current || !dirty) return;
    if (fields.some(field => field.required && !values[field.key]?.trim())) { setError('Bitte alle Pflichtangaben ausfüllen.'); return; }
    pending.current = true; setSaving(true); setError(null); setDiscard(false);
    try {
      const result = await onSave(values);
      if (!mounted.current) return;
      if (!result.ok) { setError(result.error); return; }
      onSaved(result.data); onClose();
    } catch { if (mounted.current) setError('Speichern nicht möglich. Ihre Eingaben bleiben erhalten. Bitte erneut versuchen.'); }
    finally { pending.current = false; if (mounted.current) setSaving(false); }
  };
  return <PlatformModal surfaceScope="company" visible title={title} subtitle="Unternehmen" onClose={close} dismissOnBackdrop={false} maxWidth={780} sheetStyle={{ backgroundColor: '#08172a' }} bodyStyle={{ backgroundColor: '#08172a' }} footerContent={<div className="cs-company-editor">
    {discard ? <div className="cs-company-discard" role="alert"><p>Ungespeicherte Änderungen verwerfen?</p><div className="cs-company-editor-actions"><button type="button" onClick={() => setDiscard(false)}>Weiter bearbeiten</button><button type="button" className="cs-company-remove" onClick={onClose}>Änderungen verwerfen</button></div></div> : null}
    <div className="cs-company-editor-status"><p>{saving ? 'Wird gespeichert …' : dirty ? 'Noch nicht gespeichert' : 'Gespeicherter Stand'}</p><div className="cs-company-editor-actions"><button type="button" disabled={saving} onClick={close}>Abbrechen</button><button type="button" className="cs-company-primary" disabled={saving || !dirty} onClick={() => void save()}>Änderungen speichern</button></div></div>
  </div>}><div className="cs-company-editor"><style>{COMPANY_EDITOR_CSS}</style>{error ? <div className="cs-company-save-error" role="alert">{error}</div> : null}<form noValidate onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={saving}><div className="cs-company-form-group cs-company-fields">{fields.map(field => <div key={field.key} className={`cs-company-field${field.multiline ? ' cs-company-wide' : ''}`}><label htmlFor={`${id}-${field.key}`}>{field.label}{field.required ? ' *' : ''}</label>{field.multiline ? <textarea id={`${id}-${field.key}`} rows={3} value={values[field.key] ?? ''} onChange={event => { setValues({ ...values, [field.key]: event.target.value }); setError(null); }} /> : <input id={`${id}-${field.key}`} inputMode={field.numeric ? 'decimal' : 'text'} value={values[field.key] ?? ''} required={field.required} onChange={event => { setValues({ ...values, [field.key]: event.target.value }); setError(null); }} />}{field.hint ? <small>{field.hint}</small> : null}</div>)}</div></fieldset></form></div></PlatformModal>;
}

const SETTINGS_CSS = `
.cs-client-settings-scroll{height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#44668b #102038}.cs-client-settings{background:#091728;min-height:100%;padding:26px;border-radius:22px;container-type:inline-size}.cs-client-settings-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:25px}.cs-client-settings-heading>div{flex:1;min-width:200px}.cs-client-settings-heading span{font-size:12px;color:#8dcaff}.cs-client-settings-heading h1{font-size:25px;line-height:1.35;margin:9px 0;color:#f1f7ff;font-weight:650}.cs-client-settings-heading p{margin:0;font-size:14px;color:#adbed4;line-height:1.6;max-width:75ch}.cs-client-settings-toolbar{display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap;margin-bottom:20px}.cs-client-settings-toolbar .cs-company-field{max-width:320px;flex:1;min-width:190px}.cs-client-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.cs-client-settings-card{padding:22px;border:1px solid #304a65;border-radius:19px;background:linear-gradient(145deg,#172b44,#102138);min-width:0}.cs-client-settings-card h2{font-size:18px;line-height:1.4;color:#eaf4ff;margin:0 0 8px;overflow-wrap:anywhere}.cs-client-settings-card p{color:#abc0d7;font-size:13px;line-height:1.6;margin:0 0 16px}.cs-client-settings-card dl{display:grid;gap:13px;margin:20px 0}.cs-client-settings-card dl>div{display:flex;justify-content:space-between;align-items:baseline;gap:15px;flex-wrap:wrap}.cs-client-settings-card dt{color:#9eb6d0;font-size:12px}.cs-client-settings-card dd{margin:0;color:#edf5ff;font-size:14px;overflow-wrap:anywhere}.cs-client-settings-card footer{display:flex;flex-wrap:wrap;gap:9px;border-top:1px solid #30465f;padding-top:17px}.cs-client-settings-rules{margin:18px 0 0;padding-top:16px;border-top:1px solid #30465f}.cs-client-settings-rules strong{display:block;font-size:21px;line-height:1.5;color:#a8dfff}.cs-client-settings-rules span{display:block;font-size:12px;color:#a7bed5;line-height:1.6;margin-top:5px}.cs-client-settings-rules button{margin-top:12px}.cs-client-settings-success{background:#153e35;border:1px solid #387b65;padding:14px;border-radius:12px;color:#ccf7e8;line-height:1.5}.cs-client-settings .cs-company-save-error button{margin-left:14px}.cs-client-settings-subtle{font-size:12px;color:#a7bed5;line-height:1.6}.cs-client-settings-note{padding:16px;border:1px solid #38516e;border-radius:13px;color:#aac2dd;font-size:13px;line-height:1.7;margin-bottom:20px}
@container(max-width:700px){.cs-client-settings-grid{grid-template-columns:1fr}.cs-client-settings-card{padding:18px}.cs-client-settings-heading h1{font-size:22px}}@media(max-width:560px){.cs-client-settings{padding:17px}.cs-client-settings-heading{gap:13px}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
