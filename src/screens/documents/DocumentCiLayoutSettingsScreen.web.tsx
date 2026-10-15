import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { DocumentsWorkspaceShell } from '@/components/documents/DocumentsWorkspaceShell.web';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchTenantDocumentSettings, saveTenantDocumentSettings } from '@/lib/documents';
import type { RoleKey } from '@/types';
import type { HeaderLayoutConfig, LogoPosition, TenantDocumentSettings, TenantDocumentSettingsForm } from '@/types/documents/tenantDocumentSettings';

const css = `
.dci-layout{display:grid;grid-template-columns:minmax(0,1fr) 286px;gap:24px;align-items:start}.dci-form{display:grid;gap:20px;min-width:0}.dci-section{padding:25px;border:1px solid #d9e4f1;border-radius:21px;background:#fff;box-shadow:0 4px 15px #254d7e08}.dci-section-heading{margin-bottom:21px}.dci-section-heading h2{margin:0;font-size:18px;color:#173451}.dci-section-heading p{font-size:13px;color:#526780;line-height:1.5;margin:7px 0 0}.dci-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.dci-fields>.dci-wide{grid-column:1/-1}.dci-hint{font-size:12px;color:#64758a;line-height:1.5;margin:5px 0 0}.dci-fieldset{padding:0;margin:0;border:0;min-width:0;display:contents}.dci-fieldset input:disabled,.dci-fieldset textarea:disabled,.dci-fieldset select:disabled{cursor:not-allowed;background:#f3f6fb;color:#63758b}.dci-colors{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;grid-column:1/-1}.dci-color{display:flex;align-items:center;gap:8px;padding:6px;border:1px solid #d6e2ef;background:#fbfdff;border-radius:12px}.dci-color input[type=color]{flex:0 0 34px;width:34px;height:34px;padding:0;border:0;cursor:pointer;background:none}.dci-color .dw-input{border:0;background:transparent;padding:4px 6px;min-width:0;box-shadow:none!important}.dci-check{display:flex;align-items:flex-start;gap:11px;padding:13px 15px;background:#f6f9fd;border:1px solid #e0e8f3;border-radius:12px;font-size:13px;color:#284461;line-height:1.5}.dci-check input{width:17px;height:17px;flex:0 0 17px;margin:2px 0 0;accent-color:#3678cb}.dci-check strong{display:block;font-weight:600}.dci-check small{display:block;margin-top:3px;color:#61738b;font-size:12px}.dci-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.dci-savebar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:18px 22px;border:1px solid #d4e2f4;border-radius:18px;background:#f4f8ff}.dci-savebar p{margin:0;font-size:13px;line-height:1.5;color:#526681}.dci-save-actions{display:flex;gap:10px;flex-wrap:wrap}.dci-preview{position:sticky;top:20px;display:grid;gap:14px}.dci-preview-heading{font-size:13px;font-weight:600;color:#405d7e;margin:0}.dci-sheet{background:#fff;border:1px solid #d6e1ef;border-radius:5px;box-shadow:0 12px 32px #17375414;aspect-ratio:210/297;min-width:0;padding:25px 23px;display:flex;flex-direction:column;position:relative;overflow:hidden;transition:box-shadow .2s,transform .2s}.dci-sheet:hover{box-shadow:0 18px 35px #17375420;transform:translateY(-2px)}.dci-sheet-header{display:flex;flex-direction:column;min-height:52px;color:var(--dci-primary);gap:6px}.dci-sheet-header[data-position=left]{align-items:flex-start}.dci-sheet-header[data-position=center]{align-items:center;text-align:center}.dci-sheet-header[data-position=right]{align-items:flex-end;text-align:right}.dci-sheet-header strong{font-size:13px;overflow-wrap:anywhere;line-height:1.3}.dci-sheet-logo{max-height:44px;object-fit:contain;max-width:100%;width:auto}.dci-sheet-logo-placeholder{padding:8px 12px;border-radius:6px;border:1px dashed #c9d8e9;font-size:10px;color:#697d94}.dci-sheet-accent{height:3px;background:var(--dci-accent);border-radius:2px;margin:12px 0 26px}.dci-sheet-address{width:65%;display:grid;gap:5px;margin-bottom:26px}.dci-sheet-line{height:4px;border-radius:3px;background:#e4ebf4}.dci-sheet-address .dci-sheet-line:last-child{width:72%}.dci-sheet-subject{font-size:12px;font-weight:700;color:var(--dci-primary);margin:0 0 15px}.dci-sheet-body{display:grid;gap:7px}.dci-sheet-body .dci-sheet-line{background:var(--dci-secondary);opacity:.22;height:3px}.dci-sheet-body .dci-sheet-line:last-child{width:75%}.dci-sheet-signature{width:46%;height:1px;background:#aabbd0;margin-top:32px}.dci-sheet-footer{margin-top:auto;padding-top:15px;display:grid;gap:5px;color:#687c95;font-size:8px;line-height:1.5;overflow-wrap:anywhere}.dci-sheet-footer:before{content:'';height:1px;background:#dfe7f1;margin-bottom:5px}.dci-preview-note{font-size:12px;color:#61748c;line-height:1.6;margin:0}.dci-dimensions{display:flex;gap:8px;flex-wrap:wrap}.dci-refresher{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}.dci-form textarea{min-height:105px;resize:vertical;font:inherit;line-height:1.55}.dci-readonly{margin-bottom:20px}.dci-layout small{font-family:inherit}.dci-subheading{font-size:14px;color:#2b4564;margin:5px 0 12px}.dci-custom-footer{margin-top:18px}.dci-custom-footer summary{cursor:pointer;font-size:13px;color:#315c94;padding:10px 0}.dci-custom-footer summary:focus-visible{outline:3px solid #93b8ed;border-radius:6px}.dci-footer-type{border-top:1px solid #e0e8f3;padding-top:16px;margin-top:16px}.dci-footer-type h3{font-size:14px;color:#254461;margin:0 0 12px}.dci-footer-type .dw-field{margin-top:12px}
@container (max-width:1050px){.dci-layout{grid-template-columns:minmax(0,1fr) 235px}.dci-section{padding:21px}.dci-colors{grid-template-columns:1fr}.dci-sheet{padding:20px 18px}}
@container (max-width:780px){.dci-layout{grid-template-columns:1fr}.dci-preview{position:static;display:grid;grid-template-columns:minmax(180px,260px) minmax(0,1fr);align-items:start}.dci-preview-heading{grid-column:1/-1}.dci-sheet{grid-row:2/5}.dci-fields{grid-template-columns:1fr}.dci-checks{grid-template-columns:1fr}.dci-colors{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container (max-width:520px){.dci-colors{grid-template-columns:1fr}.dci-preview{display:flex;flex-direction:column;align-items:stretch}.dci-sheet{width:240px;max-width:100%;align-self:center}.dci-save-actions{width:100%}.dci-save-actions .dw-button{flex:1}.dci-section{padding:18px}.dci-savebar{padding:16px}}
@media(prefers-reduced-motion:reduce){.dci-sheet{transition:none}.dci-sheet:hover{transform:none}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');

const HEADER_OPTIONS: { key: keyof Pick<HeaderLayoutConfig, 'showCompanyName' | 'showBrandLine' | 'showSlogan' | 'showDocumentType' | 'showAccentLine' | 'showDocumentNumber' | 'showPageNumber'>; label: string }[] = [
  { key: 'showCompanyName', label: 'Unternehmensname' },
  { key: 'showBrandLine', label: 'Rechtlicher Unternehmensname' },
  { key: 'showSlogan', label: 'Website' },
  { key: 'showDocumentType', label: 'Dokumentart' },
  { key: 'showAccentLine', label: 'Farbige Trennlinie' },
  { key: 'showDocumentNumber', label: 'Rechnungsnummer' },
  { key: 'showPageNumber', label: 'Seitenzahl im Kopf' },
];
const DOCUMENT_NAMES: Record<string, string> = { invoice: 'Rechnung', credit_note: 'Gutschrift', cancellation_invoice: 'Stornorechnung', contract: 'Vertrag', service_record: 'Leistungsnachweis', care_documentation: 'Pflegedokumentation', dunning_letter: 'Mahnung', payment_reminder: 'Zahlungserinnerung', business_letter: 'Geschäftsbrief', offer: 'Angebot', generic: 'Allgemeines Dokument' };

function toForm(settings: TenantDocumentSettings): TenantDocumentSettingsForm {
  const { id: _id, tenantId: _tenantId, updatedAt: _updatedAt, ...form } = settings;
  return form;
}

function safeLogo(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

function Field({ label, hint, children, wide = false }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return <label className={`dw-field${wide ? ' dci-wide' : ''}`}><span className="dw-label">{label}</span>{children}{hint ? <span className="dci-hint">{hint}</span> : null}</label>;
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="dci-section"><div className="dci-section-heading"><h2>{title}</h2><p>{description}</p></div>{children}</section>;
}

function LayoutSettingsForm({ tenantId, roleKey, canEdit, onStatusChange }: { tenantId: string; roleKey: RoleKey | null | undefined; canEdit: boolean; onStatusChange: (dirty: boolean, saving: boolean) => void }) {
  const query = useAsyncQuery(() => fetchTenantDocumentSettings(tenantId, roleKey), [tenantId, roleKey], { queryKey: `document-layout:${tenantId}:${roleKey ?? ''}` });
  const [draft, setDraft] = useState<TenantDocumentSettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState<string | null>(null);
  const saveLock = useRef(false);
  const mounted = useRef(true);
  const form = draft ?? (query.data ? toForm(query.data) : null);
  const dirty = draft !== null;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onStatusChange(dirty, saving); return () => onStatusChange(false, false); }, [dirty, saving, onStatusChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const patch = <K extends keyof TenantDocumentSettingsForm,>(key: K, value: TenantDocumentSettingsForm[K]) => {
    if (!form || !canEdit || saveLock.current) return;
    setDraft({ ...form, [key]: value });
    setSaved(false);
    setSaveError(null);
  };

  const save = async () => {
    if (!form || !canEdit || !dirty || saveLock.current) return;
    const colorsValid = [form.primaryColor, form.secondaryColor, form.accentColor].every((color) => /^#[a-f\d]{6}$/i.test(color));
    if (!colorsValid) { setSaveError('Bitte geben Sie die Farben als Hex-Farbwert ein, zum Beispiel #2457A6.'); return; }
    if (form.logoUrl?.trim() && !safeLogo(form.logoUrl)) { setSaveError('Bitte geben Sie für das Logo eine vollständige Adresse mit https:// ein.'); return; }
    if (!Number.isInteger(form.defaultPaymentTermsDays) || form.defaultPaymentTermsDays < 0 || form.defaultPaymentTermsDays > 365) { setSaveError('Das Zahlungsziel muss zwischen 0 und 365 Tagen liegen.'); return; }
    saveLock.current = true;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const result = await saveTenantDocumentSettings(tenantId, form, roleKey);
      if (!mounted.current) return;
      if (result.ok) { query.setData(result.data); setDraft(null); setSaved(true); }
      else setSaveError(result.error);
    } catch (error) {
      if (mounted.current) setSaveError(error instanceof Error ? error.message : 'Die Einstellungen konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.');
    } finally {
      saveLock.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  if (query.loading && !form) return <div className="dw-empty" role="status"><h2>Dokumentgestaltung wird geladen</h2><p>Ihre gespeicherten Einstellungen werden abgerufen.</p></div>;
  if (!form) return <div className="dw-alert" data-tone="danger" role="alert"><p>{query.error || 'Die Dokumentgestaltung konnte nicht geladen werden.'}</p><button className="dw-button" type="button" onClick={() => void query.refresh()}>Erneut versuchen</button></div>;
  const logo = safeLogo(form.logoUrl);
  const color = (value: string, fallback: string) => /^#[a-f\d]{6}$/i.test(value) ? value : fallback;

  return <>
    {!canEdit ? <div className="dw-alert dci-readonly" data-tone="info">Sie können diese Einstellungen ansehen. Zum Ändern benötigen Sie die Berechtigung zur Vorlagenverwaltung.</div> : null}
    <div className="dci-refresher"><span className="dw-muted">{dirty ? 'Ungespeicherte Änderungen' : query.data?.updatedAt && !Number.isNaN(Date.parse(query.data.updatedAt)) ? `Zuletzt gespeichert: ${new Date(query.data.updatedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Einstellungen für Ihr Unternehmen'}</span><button className="dw-button dw-button--quiet" type="button" onClick={() => void query.refresh()} disabled={dirty || saving || query.refreshing} title={dirty ? 'Speichern oder verwerfen Sie zuerst Ihre Änderungen.' : undefined}>{query.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</button></div>
    {query.refreshError ? <div className="dw-alert" data-tone="danger" role="alert">{query.refreshError}</div> : null}
    <div className="dci-layout">
      <form className="dci-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset className="dci-fieldset" disabled={!canEdit || saving}>
          <Section title="Logo & Farben" description="Legen Sie das Erscheinungsbild Ihrer Geschäftsdokumente fest.">
            <div className="dci-fields">
              <Field label="Logo-Adresse" hint="Vollständige Bildadresse. Das Seitenverhältnis des Logos bleibt erhalten." wide><input className="dw-input" type="url" value={form.logoUrl ?? ''} placeholder="https://…" onChange={(event) => { if (!canEdit || saveLock.current) return; setDraft({ ...form, logoUrl: event.target.value || null, logoNaturalWidthPx: null, logoNaturalHeightPx: null }); setSaved(false); setSaveError(null); }} /></Field>
              <Field label="Logo-Breite (mm)"><input className="dw-input" type="number" min={5} max={150} step={1} value={Number.isFinite(form.logoWidthMm) ? form.logoWidthMm : ''} onChange={(event) => patch('logoWidthMm', event.target.valueAsNumber)} required /></Field>
              <Field label="Logo-Ausrichtung"><select className="dw-select" value={form.headerLayout.logoPosition} onChange={(event) => patch('headerLayout', { ...form.headerLayout, logoPosition: event.target.value as LogoPosition })}><option value="left">Links</option><option value="center">Zentriert</option><option value="right">Rechts</option></select></Field>
              <div className="dci-colors">{([{ key: 'primaryColor', label: 'Hauptfarbe' }, { key: 'secondaryColor', label: 'Textfarbe' }, { key: 'accentColor', label: 'Akzentfarbe' }] as const).map(({ key, label }) => <div className="dw-field" key={key}><label className="dw-label" htmlFor={`dci-${key}`}>{label}</label><div className="dci-color"><input type="color" value={color(form[key], '#2457a6')} onChange={(event) => patch(key, event.target.value)} aria-label={`${label} auswählen`} tabIndex={-1} /><input id={`dci-${key}`} className="dw-input" value={form[key]} onChange={(event) => patch(key, event.target.value)} maxLength={7} spellCheck={false} required /></div></div>)}</div>
              <Field label="Schriftart" wide><input className="dw-input" list="dci-fonts" value={form.fontFamily} onChange={(event) => { if (!canEdit || saveLock.current) return; setDraft({ ...form, fontFamily: event.target.value, pageLayout: { ...form.pageLayout, fontFamily: event.target.value } }); setSaved(false); setSaveError(null); }} required /><datalist id="dci-fonts"><option value="Arial, sans-serif" /><option value="Helvetica, Arial, sans-serif" /><option value="Georgia, serif" /><option value="Times New Roman, serif" /></datalist></Field>
            </div>
          </Section>
          <Section title="Seitenkopf & Kontakt" description="Wählen Sie die Angaben im oberen Bereich Ihrer Dokumente.">
            <div className="dci-fields">
              <Field label="Ansprechperson" wide><input className="dw-input" value={form.headerLayout.contactPersonName ?? ''} onChange={(event) => patch('headerLayout', { ...form.headerLayout, contactPersonName: event.target.value })} /></Field>
              <Field label="E-Mail"><input className="dw-input" type="email" value={form.headerLayout.contactPersonEmail ?? ''} onChange={(event) => patch('headerLayout', { ...form.headerLayout, contactPersonEmail: event.target.value })} /></Field>
              <Field label="Telefon"><input className="dw-input" type="tel" value={form.headerLayout.contactPersonPhone ?? ''} onChange={(event) => patch('headerLayout', { ...form.headerLayout, contactPersonPhone: event.target.value })} /></Field>
              <div className="dci-checks dci-wide">{HEADER_OPTIONS.map((option) => <label className="dci-check" key={option.key}><input type="checkbox" checked={form.headerLayout[option.key]} onChange={(event) => patch('headerLayout', { ...form.headerLayout, [option.key]: event.target.checked })} /><span>{option.label}</span></label>)}</div>
            </div>
          </Section>
          <Section title="Bank & Zahlungsziel" description="Diese Angaben stehen den passenden Rechnungs- und Briefvorlagen zur Verfügung.">
            <div className="dci-fields">
              <Field label="Bank" wide><input className="dw-input" value={form.bankName} onChange={(event) => patch('bankName', event.target.value)} /></Field>
              <Field label="IBAN"><input className="dw-input" value={form.iban} onChange={(event) => patch('iban', event.target.value)} autoCapitalize="characters" spellCheck={false} /></Field>
              <Field label="BIC"><input className="dw-input" value={form.bic} onChange={(event) => patch('bic', event.target.value)} autoCapitalize="characters" spellCheck={false} /></Field>
              <Field label="Zahlungsziel (Tage)"><input className="dw-input" type="number" min={0} max={365} step={1} value={Number.isFinite(form.defaultPaymentTermsDays) ? form.defaultPaymentTermsDays : ''} onChange={(event) => patch('defaultPaymentTermsDays', event.target.valueAsNumber)} required /></Field>
              <Field label="Dokumentensprache"><input className="dw-input" list="dci-languages" value={form.defaultDocumentLanguage} onChange={(event) => patch('defaultDocumentLanguage', event.target.value)} required /><datalist id="dci-languages"><option value="de-DE">Deutsch</option><option value="en-GB">Englisch</option></datalist></Field>
            </div>
          </Section>
          <Section title="Wiederkehrende Texte" description="Hinterlegen Sie Ihre fachlich geprüften Standardformulierungen.">
            <div className="dci-fields">
              <Field label="Steuerhinweis" wide><textarea className="dw-input" value={form.defaultTaxNotice} onChange={(event) => patch('defaultTaxNotice', event.target.value)} /></Field>
              <Field label="Vertragsklauseln" wide><textarea className="dw-input" value={form.defaultContractClauses} onChange={(event) => patch('defaultContractClauses', event.target.value)} /></Field>
              <Field label="Mahnfristen & Zahlungserinnerung" wide><textarea className="dw-input" value={form.defaultDunningTerms} onChange={(event) => patch('defaultDunningTerms', event.target.value)} /></Field>
            </div>
          </Section>
          <Section title="Seite & Fußzeile" description="A4 im Hochformat. Passen Sie die Ränder und Schriftgrößen an Ihre Dokumente an.">
            <div className="dci-fields">
              {([{ key: 'marginLeftMm', label: 'Linker Rand (mm)', min: 0, max: 80, step: 1 }, { key: 'marginRightMm', label: 'Rechter Rand (mm)', min: 0, max: 80, step: 1 }, { key: 'marginTopMm', label: 'Oberer Rand (mm)', min: 0, max: 80, step: 1 }, { key: 'marginBottomMm', label: 'Unterer Rand (mm)', min: 0, max: 80, step: 1 }, { key: 'baseFontSizePt', label: 'Textgröße (pt)', min: 6, max: 36, step: 0.5 }, { key: 'headingFontSizePt', label: 'Überschriften (pt)', min: 6, max: 48, step: 0.5 }] as const).map(({ key, label, min, max, step }) => <Field key={key} label={label}><input className="dw-input" type="number" min={min} max={max} step={step} value={Number.isFinite(form.pageLayout[key]) ? form.pageLayout[key] : ''} onChange={(event) => patch('pageLayout', { ...form.pageLayout, [key]: event.target.valueAsNumber })} required /></Field>)}
              <div className="dci-checks dci-wide"><label className="dci-check"><input type="checkbox" checked={form.footerLayout.showPageNumber} onChange={(event) => patch('footerLayout', { ...form.footerLayout, showPageNumber: event.target.checked })} /><span>Seitenzahl in der Fußzeile</span></label><label className="dci-check"><input type="checkbox" checked={form.footerLayout.showMandatoryDisclosures} onChange={(event) => patch('footerLayout', { ...form.footerLayout, showMandatoryDisclosures: event.target.checked })} /><span>Unternehmensangaben in der Fußzeile</span></label></div>
            </div>
            {Object.keys(form.footerLayout.byDocumentType).length ? <details className="dci-custom-footer"><summary>Fußzeilen nach Dokumentart</summary>{Object.entries(form.footerLayout.byDocumentType).map(([type, settings]) => settings ? <div className="dci-footer-type" key={type}><h3>{DOCUMENT_NAMES[type] ?? type}</h3><div className="dci-checks">{([{ key: 'showBankDetails', label: 'Bankverbindung anzeigen' }, { key: 'bankRequired', label: 'Bankverbindung erforderlich' }, { key: 'showMandatoryDisclosures', label: 'Unternehmensangaben anzeigen' }] as const).map(({ key, label }) => <label className="dci-check" key={key}><input type="checkbox" checked={settings[key]} onChange={(event) => patch('footerLayout', { ...form.footerLayout, byDocumentType: { ...form.footerLayout.byDocumentType, [type]: { ...settings, [key]: event.target.checked } } })} /><span>{label}</span></label>)}</div><Field label="Eigener Fußzeilentext"><textarea className="dw-input" value={settings.customText ?? ''} onChange={(event) => patch('footerLayout', { ...form.footerLayout, byDocumentType: { ...form.footerLayout.byDocumentType, [type]: { ...settings, customText: event.target.value } } })} /></Field></div> : null)}</details> : null}
          </Section>
          <label className="dci-check"><input type="checkbox" checked={form.ciEnforcementEnabled} onChange={(event) => patch('ciEnforcementEnabled', event.target.checked)} /><span><strong>Vollständige Angaben vor Abschluss prüfen</strong><small>Dokumente mit fehlenden erforderlichen Unternehmensangaben können erst nach Ergänzung abgeschlossen werden.</small></span></label>
        </fieldset>
        {saveError ? <div className="dw-alert" data-tone="danger" role="alert">{saveError}</div> : null}
        {saved ? <div className="dw-alert" data-tone="success" role="status">Die Dokumentgestaltung wurde gespeichert.</div> : null}
        {canEdit ? <div className="dci-savebar"><p>{saving ? 'Ihre Einstellungen werden gespeichert …' : dirty ? 'Ihre Änderungen sind noch nicht gespeichert.' : 'Alle Änderungen sind gespeichert.'}</p><div className="dci-save-actions"><button type="button" className="dw-button dw-button--quiet" disabled={!dirty || saving} onClick={() => { setDraft(null); setSaved(false); setSaveError(null); }}>Verwerfen</button><button type="submit" className="dw-button dw-button--primary" disabled={!dirty || saving}>{saving ? 'Wird gespeichert …' : 'Änderungen speichern'}</button></div></div> : null}
      </form>
      <aside className="dci-preview" aria-label="Schematische Gestaltungsvorschau">
        <h2 className="dci-preview-heading">Gestaltung im Überblick</h2>
        <div className="dci-sheet" style={{ '--dci-primary': color(form.primaryColor, '#2457a6'), '--dci-secondary': color(form.secondaryColor, '#334155'), '--dci-accent': color(form.accentColor, '#3b82f6'), fontFamily: form.fontFamily } as CSSProperties} aria-hidden="true">
          <div className="dci-sheet-header" data-position={form.headerLayout.logoPosition}>{logo && logo !== logoFailed ? <img className="dci-sheet-logo" src={logo} alt="" onLoad={(event) => { if (!canEdit || saveLock.current || !draft || draft.logoUrl === query.data?.logoUrl) return; const image = event.currentTarget; if (!image.naturalWidth || !image.naturalHeight) return; const width = image.naturalWidth; const height = image.naturalHeight; setDraft((current) => current?.logoUrl === form.logoUrl ? { ...current, logoNaturalWidthPx: width, logoNaturalHeightPx: height } : current); }} onError={() => setLogoFailed(logo)} /> : <span className="dci-sheet-logo-placeholder">{logoFailed === logo && logo ? 'Logo nicht erreichbar' : 'Ihr Logo'}</span>}{form.headerLayout.showCompanyName ? <strong>Ihr Unternehmen</strong> : null}</div>
          {form.headerLayout.showAccentLine ? <div className="dci-sheet-accent" /> : <div style={{ height: 35 }} />}
          <div className="dci-sheet-address"><div className="dci-sheet-line" /><div className="dci-sheet-line" /><div className="dci-sheet-line" /></div>
          <p className="dci-sheet-subject">{form.headerLayout.showDocumentType ? 'Geschäftsdokument' : 'Betreff'}</p>
          <div className="dci-sheet-body">{Array.from({ length: 7 }, (_, index) => <div key={index} className="dci-sheet-line" />)}</div>
          <div className="dci-sheet-signature" />
          <div className="dci-sheet-footer">{form.footerLayout.showMandatoryDisclosures ? <span>Unternehmensangaben</span> : null}{form.footerLayout.showPageNumber ? <span>Seite 1</span> : null}</div>
        </div>
        <div className="dci-dimensions"><span className="dw-chip">A4 · Hochformat</span><span className="dw-chip">{form.pageLayout.baseFontSizePt || '–'} pt</span></div>
        <p className="dci-preview-note">Die Skizze zeigt Farben, Logo und Ausrichtung. Den genauen Seitenumbruch sehen Sie in der Vorschau des jeweiligen Dokuments.</p>
        {logo && logoFailed === logo ? <p className="dw-alert" data-tone="danger" role="status">Das Logo konnte nicht geladen werden. Bitte prüfen Sie die Bildadresse.</p> : null}
      </aside>
    </div>
  </>;
}

export function DocumentCiLayoutSettingsScreen() {
  const router = useRouter();
  const editing = useRef({ dirty: false, saving: false });
  const onStatusChange = useCallback((dirty: boolean, saving: boolean) => { editing.current = { dirty, saving }; }, []);
  const beforeNavigate = () => !editing.current.saving && (!editing.current.dirty || window.confirm('Ihre Änderungen sind noch nicht gespeichert. Möchten Sie die Seite trotzdem verlassen?'));
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check } = usePermissions();
  const canView = can('office.catalogs.view');
  return <DocumentsWorkspaceShell active="settings" title="Dokumentgestaltung" description="Logo, Briefpapier und Standardangaben für Ihre eigenen Vorlagen." beforeNavigate={beforeNavigate} back={{ label: 'Vorlageneinstellungen', onClick: () => router.push('/business/templates/documents-hub' as never) }}>
    <style>{css}</style>
    {!canView ? <div className="dw-alert" data-tone="danger" role="alert">{check('office.catalogs.view').reason ?? 'Sie dürfen die Dokumenteinstellungen nicht ansehen.'}</div> : !tenantId ? <div className="dw-empty"><h2>Kein Unternehmen ausgewählt</h2><p>Wählen Sie zuerst Ihr Unternehmen, um dessen Dokumentgestaltung zu öffnen.</p></div> : <LayoutSettingsForm key={`${tenantId}:${profile?.roleKey ?? ''}`} tenantId={tenantId} roleKey={profile?.roleKey} canEdit={can('office.catalogs.edit')} onStatusChange={onStatusChange} />}
  </DocumentsWorkspaceShell>;
}
