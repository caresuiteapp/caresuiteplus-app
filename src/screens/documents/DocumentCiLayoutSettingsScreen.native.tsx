// Generated native presentation from src/screens/documents/DocumentCiLayoutSettingsScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeURL as URL,nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeLabel,NativeSpan,NativeSection,NativeDiv,NativeH2,NativeP,NativeButton,NativeForm,NativeFieldset,NativeImg,NativeStrong,NativeInput,NativeSelect,NativeOption,NativeDatalist,NativeTextarea,NativeDetails,NativeSummary,NativeH3,NativeSmall,NativeAside,NativeStyle,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { DocumentsWorkspaceShell } from "../../components/documents/DocumentsWorkspaceShell.native.tsx";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchTenantDocumentSettings, saveTenantDocumentSettings } from '@/lib/documents';
import { validateTenantDocumentSettingsForm } from "../../lib/documents/tenantDocumentSettingsService.ts";
import { DOCUMENT_LOGO_ACCEPT, prepareDocumentLogo, uploadDocumentLogo, type PreparedDocumentLogo } from "../../lib/documents/documentLogoUpload.native.ts";
import type { RoleKey } from '@/types';
import type { HeaderLayoutConfig, LogoPosition, TenantDocumentSettings, TenantDocumentSettingsForm } from '@/types/documents/tenantDocumentSettings';
const css = `
.dci-logo-upload{display:flex;align-items:center;gap:20px;padding:20px;border:1px dashed #b9cee7;border-radius:16px;background:#f7faff;min-width:0}.dci-logo-image{display:grid;place-items:center;flex:0 0 124px;width:124px;height:92px;padding:12px;border:1px solid #dfE8f3;border-radius:12px;background:#fff;color:#61748c;font-size:12px}.dci-logo-image img{display:block;max-width:100%;max-height:100%;object-fit:contain}.dci-logo-controls{display:grid;gap:9px;min-width:0;flex:1}.dci-logo-controls strong{font-size:13px;overflow-wrap:anywhere}.dci-logo-actions{display:flex;flex-wrap:wrap;gap:8px}.dci-logo-input{display:none}.dci-logo-controls p{margin:0}.dci-logo-actions .dw-button{width:auto}.dci-logo-upload[data-busy=true]{opacity:.75}@container(max-width:520px){.dci-logo-upload{flex-direction:column;align-items:stretch;gap:14px;padding:15px}.dci-logo-image{align-self:center;flex-basis:92px}.dci-logo-actions .dw-button{flex:1}}
.dci-layout{display:grid;grid-template-columns:minmax(0,1fr) 286px;gap:24px;align-items:start}.dci-form{display:grid;gap:20px;min-width:0}.dci-section{padding:25px;border:1px solid #d9e4f1;border-radius:21px;background:#fff;box-shadow:0 4px 15px #254d7e08}.dci-section-heading{margin-bottom:21px}.dci-section-heading h2{margin:0;font-size:18px;color:#173451}.dci-section-heading p{font-size:13px;color:#526780;line-height:1.5;margin:7px 0 0}.dci-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.dci-fields>.dci-wide{grid-column:1/-1}.dci-hint{font-size:12px;color:#64758a;line-height:1.5;margin:5px 0 0}.dci-fieldset{padding:0;margin:0;border:0;min-width:0;display:contents}.dci-fieldset input:disabled,.dci-fieldset textarea:disabled,.dci-fieldset select:disabled{cursor:not-allowed;background:#f3f6fb;color:#63758b}.dci-colors{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;grid-column:1/-1}.dci-color{display:flex;align-items:center;gap:8px;padding:6px;border:1px solid #d6e2ef;background:#fbfdff;border-radius:12px}.dci-color input[type=color]{flex:0 0 34px;width:34px;height:34px;padding:0;border:0;cursor:pointer;background:none}.dci-color .dw-input{border:0;background:transparent;padding:4px 6px;min-width:0;box-shadow:none!important}.dci-check{display:flex;align-items:flex-start;gap:11px;padding:13px 15px;background:#f6f9fd;border:1px solid #e0e8f3;border-radius:12px;font-size:13px;color:#284461;line-height:1.5}.dci-check input{width:17px;height:17px;flex:0 0 17px;margin:2px 0 0;accent-color:#3678cb}.dci-check strong{display:block;font-weight:600}.dci-check small{display:block;margin-top:3px;color:#61738b;font-size:12px}.dci-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.dci-savebar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:18px 22px;border:1px solid #d4e2f4;border-radius:18px;background:#f4f8ff}.dci-savebar p{margin:0;font-size:13px;line-height:1.5;color:#526681}.dci-save-actions{display:flex;gap:10px;flex-wrap:wrap}.dci-preview{position:sticky;top:20px;display:grid;gap:14px}.dci-preview-heading{font-size:13px;font-weight:600;color:#405d7e;margin:0}.dci-sheet{background:#fff;border:1px solid #d6e1ef;border-radius:5px;box-shadow:0 12px 32px #17375414;aspect-ratio:210/297;min-width:0;padding:25px 23px;display:flex;flex-direction:column;position:relative;overflow:hidden;transition:box-shadow .2s,transform .2s}.dci-sheet:hover{box-shadow:0 18px 35px #17375420;transform:translateY(-2px)}.dci-sheet-header{display:flex;flex-direction:column;min-height:52px;color:var(--dci-primary);gap:6px}.dci-sheet-header[data-position=left]{align-items:flex-start}.dci-sheet-header[data-position=center]{align-items:center;text-align:center}.dci-sheet-header[data-position=right]{align-items:flex-end;text-align:right}.dci-sheet-header strong{font-size:13px;overflow-wrap:anywhere;line-height:1.3}.dci-sheet-logo{max-height:44px;object-fit:contain;max-width:100%;width:auto}.dci-sheet-logo-placeholder{padding:8px 12px;border-radius:6px;border:1px dashed #c9d8e9;font-size:10px;color:#697d94}.dci-sheet-accent{height:3px;background:var(--dci-accent);border-radius:2px;margin:12px 0 26px}.dci-sheet-address{width:65%;display:grid;gap:5px;margin-bottom:26px}.dci-sheet-line{height:4px;border-radius:3px;background:#e4ebf4}.dci-sheet-address .dci-sheet-line:last-child{width:72%}.dci-sheet-subject{font-size:12px;font-weight:700;color:var(--dci-primary);margin:0 0 15px}.dci-sheet-body{display:grid;gap:7px}.dci-sheet-body .dci-sheet-line{background:var(--dci-secondary);opacity:.22;height:3px}.dci-sheet-body .dci-sheet-line:last-child{width:75%}.dci-sheet-signature{width:46%;height:1px;background:#aabbd0;margin-top:32px}.dci-sheet-footer{margin-top:auto;padding-top:15px;display:grid;gap:5px;color:#687c95;font-size:8px;line-height:1.5;overflow-wrap:anywhere}.dci-sheet-footer:before{content:'';height:1px;background:#dfe7f1;margin-bottom:5px}.dci-preview-note{font-size:12px;color:#61748c;line-height:1.6;margin:0}.dci-dimensions{display:flex;gap:8px;flex-wrap:wrap}.dci-refresher{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}.dci-form textarea{min-height:105px;resize:vertical;font:inherit;line-height:1.55}.dci-readonly{margin-bottom:20px}.dci-layout small{font-family:inherit}.dci-subheading{font-size:14px;color:#2b4564;margin:5px 0 12px}.dci-custom-footer{margin-top:18px}.dci-custom-footer summary{cursor:pointer;font-size:13px;color:#315c94;padding:10px 0}.dci-custom-footer summary:focus-visible{outline:3px solid #93b8ed;border-radius:6px}.dci-footer-type{border-top:1px solid #e0e8f3;padding-top:16px;margin-top:16px}.dci-footer-type h3{font-size:14px;color:#254461;margin:0 0 12px}.dci-footer-type .dw-field{margin-top:12px}
@container (max-width:1050px){.dci-layout{grid-template-columns:minmax(0,1fr) 235px}.dci-section{padding:21px}.dci-colors{grid-template-columns:1fr}.dci-sheet{padding:20px 18px}}
@container (max-width:780px){.dci-layout{grid-template-columns:1fr}.dci-preview{position:static;display:grid;grid-template-columns:minmax(180px,260px) minmax(0,1fr);align-items:start}.dci-preview-heading{grid-column:1/-1}.dci-sheet{grid-row:2/5}.dci-fields{grid-template-columns:1fr}.dci-checks{grid-template-columns:1fr}.dci-colors{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container (max-width:520px){.dci-colors{grid-template-columns:1fr}.dci-preview{display:flex;flex-direction:column;align-items:stretch}.dci-sheet{width:240px;max-width:100%;align-self:center}.dci-save-actions{width:100%}.dci-save-actions .dw-button{flex:1}.dci-section{padding:18px}.dci-savebar{padding:16px}}
@media(prefers-reduced-motion:reduce){.dci-sheet{transition:none}.dci-sheet:hover{transform:none}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
const HEADER_OPTIONS: {
    key: keyof Pick<HeaderLayoutConfig, 'showCompanyName' | 'showBrandLine' | 'showSlogan' | 'showDocumentType' | 'showAccentLine' | 'showDocumentNumber' | 'showPageNumber'>;
    label: string;
}[] = [
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
    if (!value?.trim())
        return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.href : null;
    }
    catch {
        return null;
    }
}
function Field({ label, hint, children, wide = false }: {
    label: string;
    hint?: string;
    children: ReactNode;
    wide?: boolean;
}) {
    return <NativeWorkspaceStyleScope css={[css]}>{<NativeLabel className={`dw-field${wide ? ' dci-wide' : ''}`}><NativeSpan className="dw-label">{label}</NativeSpan>{children}{hint ? <NativeSpan className="dci-hint">{hint}</NativeSpan> : null}</NativeLabel>}</NativeWorkspaceStyleScope>;
}
function Section({ title, description, children }: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return <NativeWorkspaceStyleScope css={[css]}>{<NativeSection className="dci-section"><NativeDiv className="dci-section-heading"><NativeH2>{title}</NativeH2><NativeP>{description}</NativeP></NativeDiv>{children}</NativeSection>}</NativeWorkspaceStyleScope>;
}
function LayoutSettingsForm({ tenantId, roleKey, canEdit, onStatusChange }: {
    tenantId: string;
    roleKey: RoleKey | null | undefined;
    canEdit: boolean;
    onStatusChange: (dirty: boolean, saving: boolean) => void;
}) {
    const window = useNativeWorkflowWindow();
    const query = useAsyncQuery(() => fetchTenantDocumentSettings(tenantId, roleKey), [tenantId, roleKey], { queryKey: `document-layout:${tenantId}:${roleKey ?? ''}` });
    const [draft, setDraft] = useState<TenantDocumentSettingsForm | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [logoFailed, setLogoFailed] = useState<string | null>(null);
    const [pendingLogo, setPendingLogo] = useState<PreparedDocumentLogo | null>(null);
    const [preparingLogo, setPreparingLogo] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const uploadedLogo = useRef<{
        uploadId: string;
        url: string;
    } | null>(null);
    const editable = useRef(canEdit);
    editable.current = canEdit;
    const saveLock = useRef(false);
    const mounted = useRef(true);
    const form = draft ?? (query.data ? toForm(query.data) : null);
    const dirty = draft !== null || pendingLogo !== null;
    const busy = saving || preparingLogo;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { onStatusChange(dirty, busy); return () => onStatusChange(false, false); }, [dirty, busy, onStatusChange]);
    useEffect(() => { const url = pendingLogo?.previewUrl; return () => { if (url)
        URL.revokeObjectURL(url); }; }, [pendingLogo?.previewUrl]);
    useEffect(() => {
        if (!dirty && !busy)
            return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty, busy]);
    const patch = <K extends keyof TenantDocumentSettingsForm,>(key: K, value: TenantDocumentSettingsForm[K]) => {
        if (!form || !canEdit || saveLock.current)
            return;
        setDraft({ ...form, [key]: value });
        setSaved(false);
        setSaveError(null);
    };
    const selectLogo = async (file: File) => {
        if (!form || !canEdit || saveLock.current)
            return;
        saveLock.current = true;
        setPreparingLogo(true);
        setSaved(false);
        setSaveError(null);
        onStatusChange(true, true);
        try {
            const prepared = await prepareDocumentLogo(file);
            if (!mounted.current || !editable.current) {
                if (prepared.ok)
                    URL.revokeObjectURL(prepared.data.previewUrl);
                return;
            }
            if (!prepared.ok) {
                setSaveError(prepared.error);
                return;
            }
            uploadedLogo.current = null;
            setPendingLogo(prepared.data);
            setLogoFailed(null);
        }
        catch {
            if (mounted.current)
                setSaveError('Das Logo konnte nicht gelesen werden. Bitte wählen Sie die Datei erneut aus.');
        }
        finally {
            saveLock.current = false;
            if (mounted.current)
                setPreparingLogo(false);
        }
    };
    const removeLogo = () => {
        if (!form || !canEdit || saveLock.current)
            return;
        setPendingLogo(null);
        uploadedLogo.current = null;
        setDraft({ ...form, logoUrl: null, logoNaturalWidthPx: null, logoNaturalHeightPx: null });
        setLogoFailed(null);
        setSaved(false);
        setSaveError(null);
    };
    const save = async () => {
        if (!form || !canEdit || !dirty || saveLock.current)
            return;
        const invalid = validateTenantDocumentSettingsForm(form);
        if (invalid) {
            setSaveError(invalid);
            return;
        }
        saveLock.current = true;
        setSaving(true);
        setSaveError(null);
        setSaved(false);
        onStatusChange(true, true);
        try {
            let next = form;
            if (pendingLogo) {
                let logoUrl = uploadedLogo.current?.uploadId === pendingLogo.uploadId ? uploadedLogo.current.url : null;
                if (!logoUrl) {
                    const upload = await uploadDocumentLogo(tenantId, pendingLogo, roleKey);
                    if (!mounted.current || !editable.current)
                        return;
                    if (!upload.ok) {
                        setSaveError(upload.error);
                        return;
                    }
                    logoUrl = upload.data;
                    uploadedLogo.current = { uploadId: pendingLogo.uploadId, url: logoUrl };
                }
                next = { ...form, logoUrl, logoNaturalWidthPx: pendingLogo.width, logoNaturalHeightPx: pendingLogo.height };
            }
            if (!mounted.current || !editable.current)
                return;
            const result = await saveTenantDocumentSettings(tenantId, next, roleKey);
            if (!mounted.current)
                return;
            if (result.ok) {
                query.setData(result.data);
                setDraft(null);
                setPendingLogo(null);
                uploadedLogo.current = null;
                setSaved(true);
            }
            else
                setSaveError(result.error);
        }
        catch (error) {
            if (mounted.current)
                setSaveError(error instanceof Error ? error.message : 'Die Einstellungen konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.');
        }
        finally {
            saveLock.current = false;
            if (mounted.current)
                setSaving(false);
        }
    };
    if (query.loading && !form)
        return <NativeWorkspaceStyleScope css={[css]}>{<NativeDiv className="dw-empty" role="status"><NativeH2>Dokumentgestaltung wird geladen</NativeH2><NativeP>Ihre gespeicherten Einstellungen werden abgerufen.</NativeP></NativeDiv>}</NativeWorkspaceStyleScope>;
    if (!form)
        return <NativeWorkspaceStyleScope css={[css]}>{<NativeDiv className="dw-alert" data-tone="danger" role="alert"><NativeP>{query.error || 'Die Dokumentgestaltung konnte nicht geladen werden.'}</NativeP><NativeButton className="dw-button" type="button" onClick={() => void query.refresh()}>Erneut versuchen</NativeButton></NativeDiv>}</NativeWorkspaceStyleScope>;
    const logo = pendingLogo?.previewUrl ?? safeLogo(form.logoUrl);
    const color = (value: string, fallback: string) => /^#[a-f\d]{6}$/i.test(value) ? value : fallback;
    return <NativeWorkspaceStyleScope css={[css]}>{<>
    {!canEdit ? <NativeDiv className="dw-alert dci-readonly" data-tone="info">Sie können diese Einstellungen ansehen. Zum Ändern benötigen Sie die Berechtigung zur Vorlagenverwaltung.</NativeDiv> : null}
    <NativeDiv className="dci-refresher"><NativeSpan className="dw-muted">{dirty ? 'Ungespeicherte Änderungen' : query.data?.updatedAt && !Number.isNaN(Date.parse(query.data.updatedAt)) ? `Zuletzt gespeichert: ${new Date(query.data.updatedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Einstellungen für Ihr Unternehmen'}</NativeSpan><NativeButton className="dw-button dw-button--quiet" type="button" onClick={() => void query.refresh()} disabled={dirty || busy || query.refreshing} title={dirty ? 'Speichern oder verwerfen Sie zuerst Ihre Änderungen.' : undefined}>{query.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</NativeButton></NativeDiv>
    {query.refreshError ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{query.refreshError}</NativeDiv> : null}
    <NativeDiv className="dci-layout">
      <NativeForm className="dci-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <NativeFieldset className="dci-fieldset" disabled={!canEdit || busy}>
          <Section title="Logo & Farben" description="Legen Sie das Erscheinungsbild Ihrer Geschäftsdokumente fest.">
            <NativeDiv className="dci-fields">
              <NativeDiv className="dw-field dci-wide"><NativeSpan className="dw-label" id="dci-logo-label">Unternehmenslogo</NativeSpan><NativeDiv className="dci-logo-upload" data-busy={busy}>
                <NativeDiv className="dci-logo-image">{logo && logo !== logoFailed ? <NativeImg src={logo} alt="Ausgewähltes Unternehmenslogo" onError={() => setLogoFailed(logo)}/> : <NativeSpan>{logo ? 'Logo nicht verfügbar' : 'Ihr Logo'}</NativeSpan>}</NativeDiv>
                <NativeDiv className="dci-logo-controls"><NativeStrong>{preparingLogo ? 'Logo wird geprüft …' : pendingLogo?.file.name ?? (logo ? 'Gespeichertes Logo' : 'Logo als Datei auswählen')}</NativeStrong><NativeP className="dci-hint">PNG, JPG oder WebP · maximal 5 MB. Das Seitenverhältnis bleibt erhalten.</NativeP>
                  {canEdit ? <><NativeInput ref={fileInput} className="dci-logo-input" type="file" accept={DOCUMENT_LOGO_ACCEPT} aria-labelledby="dci-logo-label" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file)
        void selectLogo(file); }}/><NativeDiv className="dci-logo-actions"><NativeButton type="button" className="dw-button dw-button--primary" onClick={() => fileInput.current?.click()}>{logo ? 'Logo ersetzen' : 'Logo hochladen'}</NativeButton>{logo ? <NativeButton type="button" className="dw-button dw-button--quiet" onClick={removeLogo}>Logo entfernen</NativeButton> : null}</NativeDiv></> : null}
                  {pendingLogo ? <NativeP className="dci-hint" role="status">Ausgewählt – wird mit „Änderungen speichern“ hochgeladen.</NativeP> : null}
                </NativeDiv>
              </NativeDiv></NativeDiv>
              <Field label="Logo-Breite (mm)"><NativeInput className="dw-input" type="number" min={5} max={150} step={1} value={Number.isFinite(form.logoWidthMm) ? form.logoWidthMm : ''} onChange={(event) => patch('logoWidthMm', event.target.valueAsNumber)} required/></Field>
              <Field label="Logo-Ausrichtung"><NativeSelect className="dw-select" value={form.headerLayout.logoPosition} onChange={(event) => patch('headerLayout', { ...form.headerLayout, logoPosition: event.target.value as LogoPosition })}><NativeOption value="left">Links</NativeOption><NativeOption value="center">Zentriert</NativeOption><NativeOption value="right">Rechts</NativeOption></NativeSelect></Field>
              <NativeDiv className="dci-colors">{([{ key: 'primaryColor', label: 'Hauptfarbe' }, { key: 'secondaryColor', label: 'Textfarbe' }, { key: 'accentColor', label: 'Akzentfarbe' }] as const).map(({ key, label }) => <NativeDiv className="dw-field" key={key}><NativeLabel className="dw-label" htmlFor={`dci-${key}`}>{label}</NativeLabel><NativeDiv className="dci-color"><NativeInput type="color" value={color(form[key], '#2457a6')} onChange={(event) => patch(key, event.target.value)} aria-label={`${label} auswählen`} tabIndex={-1}/><NativeInput id={`dci-${key}`} className="dw-input" value={form[key]} onChange={(event) => patch(key, event.target.value)} maxLength={7} spellCheck={false} required/></NativeDiv></NativeDiv>)}</NativeDiv>
              <Field label="Schriftart" wide><NativeInput className="dw-input" list="dci-fonts" value={form.fontFamily} onChange={(event) => { if (!canEdit || saveLock.current)
        return; setDraft({ ...form, fontFamily: event.target.value, pageLayout: { ...form.pageLayout, fontFamily: event.target.value } }); setSaved(false); setSaveError(null); }} required/><NativeDatalist id="dci-fonts"><NativeOption value="Arial, sans-serif"/><NativeOption value="Helvetica, Arial, sans-serif"/><NativeOption value="Georgia, serif"/><NativeOption value="Times New Roman, serif"/></NativeDatalist></Field>
            </NativeDiv>
          </Section>
          <Section title="Seitenkopf & Kontakt" description="Wählen Sie die Angaben im oberen Bereich Ihrer Dokumente.">
            <NativeDiv className="dci-fields">
              <Field label="Ansprechperson" wide><NativeInput className="dw-input" value={form.headerLayout.contactPersonName ?? ''} onChange={(event) => patch('headerLayout', { ...form.headerLayout, contactPersonName: event.target.value })}/></Field>
              <Field label="E-Mail"><NativeInput className="dw-input" type="email" value={form.headerLayout.contactPersonEmail ?? ''} onChange={(event) => patch('headerLayout', { ...form.headerLayout, contactPersonEmail: event.target.value })}/></Field>
              <Field label="Telefon"><NativeInput className="dw-input" type="tel" value={form.headerLayout.contactPersonPhone ?? ''} onChange={(event) => patch('headerLayout', { ...form.headerLayout, contactPersonPhone: event.target.value })}/></Field>
              <NativeDiv className="dci-checks dci-wide">{HEADER_OPTIONS.map((option) => <NativeLabel className="dci-check" key={option.key}><NativeInput type="checkbox" checked={form.headerLayout[option.key]} onChange={(event) => patch('headerLayout', { ...form.headerLayout, [option.key]: event.target.checked })}/><NativeSpan>{option.label}</NativeSpan></NativeLabel>)}</NativeDiv>
            </NativeDiv>
          </Section>
          <Section title="Bank & Zahlungsziel" description="Diese Angaben stehen den passenden Rechnungs- und Briefvorlagen zur Verfügung.">
            <NativeDiv className="dci-fields">
              <Field label="Bank" wide><NativeInput className="dw-input" value={form.bankName} onChange={(event) => patch('bankName', event.target.value)}/></Field>
              <Field label="IBAN"><NativeInput className="dw-input" value={form.iban} onChange={(event) => patch('iban', event.target.value)} autoCapitalize="characters" spellCheck={false}/></Field>
              <Field label="BIC"><NativeInput className="dw-input" value={form.bic} onChange={(event) => patch('bic', event.target.value)} autoCapitalize="characters" spellCheck={false}/></Field>
              <Field label="Zahlungsziel (Tage)"><NativeInput className="dw-input" type="number" min={0} max={365} step={1} value={Number.isFinite(form.defaultPaymentTermsDays) ? form.defaultPaymentTermsDays : ''} onChange={(event) => patch('defaultPaymentTermsDays', event.target.valueAsNumber)} required/></Field>
              <Field label="Dokumentensprache"><NativeInput className="dw-input" list="dci-languages" value={form.defaultDocumentLanguage} onChange={(event) => patch('defaultDocumentLanguage', event.target.value)} required/><NativeDatalist id="dci-languages"><NativeOption value="de-DE">Deutsch</NativeOption><NativeOption value="en-GB">Englisch</NativeOption></NativeDatalist></Field>
            </NativeDiv>
          </Section>
          <Section title="Wiederkehrende Texte" description="Hinterlegen Sie Ihre fachlich geprüften Standardformulierungen.">
            <NativeDiv className="dci-fields">
              <Field label="Steuerhinweis" wide><NativeTextarea className="dw-input" value={form.defaultTaxNotice} onChange={(event) => patch('defaultTaxNotice', event.target.value)}/></Field>
              <Field label="Vertragsklauseln" wide><NativeTextarea className="dw-input" value={form.defaultContractClauses} onChange={(event) => patch('defaultContractClauses', event.target.value)}/></Field>
              <Field label="Mahnfristen & Zahlungserinnerung" wide><NativeTextarea className="dw-input" value={form.defaultDunningTerms} onChange={(event) => patch('defaultDunningTerms', event.target.value)}/></Field>
            </NativeDiv>
          </Section>
          <Section title="Seite & Fußzeile" description="A4 im Hochformat. Passen Sie die Ränder und Schriftgrößen an Ihre Dokumente an.">
            <NativeDiv className="dci-fields">
              {([{ key: 'marginLeftMm', label: 'Linker Rand (mm)', min: 0, max: 80, step: 1 }, { key: 'marginRightMm', label: 'Rechter Rand (mm)', min: 0, max: 80, step: 1 }, { key: 'marginTopMm', label: 'Oberer Rand (mm)', min: 0, max: 80, step: 1 }, { key: 'marginBottomMm', label: 'Unterer Rand (mm)', min: 0, max: 80, step: 1 }, { key: 'baseFontSizePt', label: 'Textgröße (pt)', min: 6, max: 36, step: 0.5 }, { key: 'headingFontSizePt', label: 'Überschriften (pt)', min: 6, max: 48, step: 0.5 }] as const).map(({ key, label, min, max, step }) => <Field key={key} label={label}><NativeInput className="dw-input" type="number" min={min} max={max} step={step} value={Number.isFinite(form.pageLayout[key]) ? form.pageLayout[key] : ''} onChange={(event) => patch('pageLayout', { ...form.pageLayout, [key]: event.target.valueAsNumber })} required/></Field>)}
              <NativeDiv className="dci-checks dci-wide"><NativeLabel className="dci-check"><NativeInput type="checkbox" checked={form.footerLayout.showPageNumber} onChange={(event) => patch('footerLayout', { ...form.footerLayout, showPageNumber: event.target.checked })}/><NativeSpan>Seitenzahl in der Fußzeile</NativeSpan></NativeLabel><NativeLabel className="dci-check"><NativeInput type="checkbox" checked={form.footerLayout.showMandatoryDisclosures} onChange={(event) => patch('footerLayout', { ...form.footerLayout, showMandatoryDisclosures: event.target.checked })}/><NativeSpan>Unternehmensangaben in der Fußzeile</NativeSpan></NativeLabel></NativeDiv>
            </NativeDiv>
            {Object.keys(form.footerLayout.byDocumentType).length ? <NativeDetails className="dci-custom-footer"><NativeSummary>Fußzeilen nach Dokumentart</NativeSummary>{Object.entries(form.footerLayout.byDocumentType).map(([type, settings]) => settings ? <NativeDiv className="dci-footer-type" key={type}><NativeH3>{DOCUMENT_NAMES[type] ?? type}</NativeH3><NativeDiv className="dci-checks">{([{ key: 'showBankDetails', label: 'Bankverbindung anzeigen' }, { key: 'bankRequired', label: 'Bankverbindung erforderlich' }, { key: 'showMandatoryDisclosures', label: 'Unternehmensangaben anzeigen' }] as const).map(({ key, label }) => <NativeLabel className="dci-check" key={key}><NativeInput type="checkbox" checked={settings[key]} onChange={(event) => patch('footerLayout', { ...form.footerLayout, byDocumentType: { ...form.footerLayout.byDocumentType, [type]: { ...settings, [key]: event.target.checked } } })}/><NativeSpan>{label}</NativeSpan></NativeLabel>)}</NativeDiv><Field label="Eigener Fußzeilentext"><NativeTextarea className="dw-input" value={settings.customText ?? ''} onChange={(event) => patch('footerLayout', { ...form.footerLayout, byDocumentType: { ...form.footerLayout.byDocumentType, [type]: { ...settings, customText: event.target.value } } })}/></Field></NativeDiv> : null)}</NativeDetails> : null}
          </Section>
          <NativeLabel className="dci-check"><NativeInput type="checkbox" checked={form.ciEnforcementEnabled} onChange={(event) => patch('ciEnforcementEnabled', event.target.checked)}/><NativeSpan><NativeStrong>Vollständige Angaben vor Abschluss prüfen</NativeStrong><NativeSmall>Dokumente mit fehlenden erforderlichen Unternehmensangaben können erst nach Ergänzung abgeschlossen werden.</NativeSmall></NativeSpan></NativeLabel>
        </NativeFieldset>
        {saveError ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{saveError}</NativeDiv> : null}
        {saved ? <NativeDiv className="dw-alert" data-tone="success" role="status">Die Dokumentgestaltung wurde gespeichert.</NativeDiv> : null}
        {canEdit ? <NativeDiv className="dci-savebar"><NativeP>{preparingLogo ? 'Das Logo wird vorbereitet …' : saving ? 'Logo und Einstellungen werden gespeichert …' : dirty ? 'Ihre Änderungen sind noch nicht gespeichert.' : 'Alle Änderungen sind gespeichert.'}</NativeP><NativeDiv className="dci-save-actions"><NativeButton type="button" className="dw-button dw-button--quiet" disabled={!dirty || busy} onClick={() => { if (saveLock.current)
        return; setDraft(null); setPendingLogo(null); uploadedLogo.current = null; setLogoFailed(null); setSaved(false); setSaveError(null); }}>Verwerfen</NativeButton><NativeButton type="submit" className="dw-button dw-button--primary" disabled={!dirty || busy}>{saving ? 'Wird gespeichert …' : 'Änderungen speichern'}</NativeButton></NativeDiv></NativeDiv> : null}
      </NativeForm>
      <NativeAside className="dci-preview" aria-label="Schematische Gestaltungsvorschau">
        <NativeH2 className="dci-preview-heading">Gestaltung im Überblick</NativeH2>
        <NativeDiv className="dci-sheet" style={{ '--dci-primary': color(form.primaryColor, '#2457a6'), '--dci-secondary': color(form.secondaryColor, '#334155'), '--dci-accent': color(form.accentColor, '#3b82f6'), fontFamily: form.fontFamily } as CSSProperties} aria-hidden="true">
          <NativeDiv className="dci-sheet-header" data-position={form.headerLayout.logoPosition}>{logo && logo !== logoFailed ? <NativeImg className="dci-sheet-logo" src={logo} alt="" onError={() => setLogoFailed(logo)}/> : <NativeSpan className="dci-sheet-logo-placeholder">{logoFailed === logo && logo ? 'Logo nicht erreichbar' : 'Ihr Logo'}</NativeSpan>}{form.headerLayout.showCompanyName ? <NativeStrong>Ihr Unternehmen</NativeStrong> : null}</NativeDiv>
          {form.headerLayout.showAccentLine ? <NativeDiv className="dci-sheet-accent"/> : <NativeDiv style={{ height: 35 }}/>}
          <NativeDiv className="dci-sheet-address"><NativeDiv className="dci-sheet-line"/><NativeDiv className="dci-sheet-line"/><NativeDiv className="dci-sheet-line"/></NativeDiv>
          <NativeP className="dci-sheet-subject">{form.headerLayout.showDocumentType ? 'Geschäftsdokument' : 'Betreff'}</NativeP>
          <NativeDiv className="dci-sheet-body">{Array.from({ length: 7 }, (_, index) => <NativeDiv key={index} className="dci-sheet-line"/>)}</NativeDiv>
          <NativeDiv className="dci-sheet-signature"/>
          <NativeDiv className="dci-sheet-footer">{form.footerLayout.showMandatoryDisclosures ? <NativeSpan>Unternehmensangaben</NativeSpan> : null}{form.footerLayout.showPageNumber ? <NativeSpan>Seite 1</NativeSpan> : null}</NativeDiv>
        </NativeDiv>
        <NativeDiv className="dci-dimensions"><NativeSpan className="dw-chip">A4 · Hochformat</NativeSpan><NativeSpan className="dw-chip">{form.pageLayout.baseFontSizePt || '–'} pt</NativeSpan></NativeDiv>
        <NativeP className="dci-preview-note">Die Skizze zeigt Farben, Logo und Ausrichtung. Den genauen Seitenumbruch sehen Sie in der Vorschau des jeweiligen Dokuments.</NativeP>
        {logo && logoFailed === logo ? <NativeP className="dw-alert" data-tone="danger" role="status">Das Logo konnte nicht geladen werden. Bitte wählen Sie die Logo-Datei erneut aus.</NativeP> : null}
      </NativeAside>
    </NativeDiv>
  </>}</NativeWorkspaceStyleScope>;
}
export function DocumentCiLayoutSettingsScreen() {
    const router = useRouter();
    const editing = useRef({ dirty: false, saving: false });
    const onStatusChange = useCallback((dirty: boolean, saving: boolean) => { editing.current = { dirty, saving }; }, []);
    const beforeNavigate = async () => !editing.current.saving && (!editing.current.dirty || await confirmNativeWorkspaceAction('Ihre Änderungen sind noch nicht gespeichert. Möchten Sie die Seite trotzdem verlassen?'));
    const { profile } = useAuth();
    const tenantId = useServiceTenantId();
    const { can, check } = usePermissions();
    const canView = can('office.catalogs.view');
    return <NativeWorkspaceStyleScope css={[css, css]}>{<DocumentsWorkspaceShell active="settings" title="Dokumentgestaltung" description="Logo, Briefpapier und Standardangaben für Ihre eigenen Vorlagen." beforeNavigate={beforeNavigate} back={{ label: 'Vorlageneinstellungen', onClick: () => router.push('/business/templates/documents-hub' as never) }}>
    <NativeStyle>{css}</NativeStyle>
    {!canView ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{check('office.catalogs.view').reason ?? 'Sie dürfen die Dokumenteinstellungen nicht ansehen.'}</NativeDiv> : !tenantId ? <NativeDiv className="dw-empty"><NativeH2>Kein Unternehmen ausgewählt</NativeH2><NativeP>Wählen Sie zuerst Ihr Unternehmen, um dessen Dokumentgestaltung zu öffnen.</NativeP></NativeDiv> : <LayoutSettingsForm key={`${tenantId}:${profile?.roleKey ?? ''}`} tenantId={tenantId} roleKey={profile?.roleKey} canEdit={can('office.catalogs.edit')} onStatusChange={onStatusChange}/>}
  </DocumentsWorkspaceShell>}</NativeWorkspaceStyleScope>;
}
