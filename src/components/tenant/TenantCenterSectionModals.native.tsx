// Generated native presentation from src/components/tenant/TenantCenterSectionModals.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeP,NativeButton,NativeStrong,NativeStyle,NativeArticle,NativeTime,NativeForm,NativeFieldset,NativeSection,NativeHeader,NativeH3,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PlatformModal } from "../layout/platform/platformmodal.tsx";
import { TenantLogoPicker } from '@/components/tenant/TenantLogoPicker';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchTenantCenter, saveTenantBankAccounts, saveTenantCompanyProfile, saveTenantContactProfile, saveTenantLegalProfile, saveTenantModuleSettings, saveTenantPaymentTerms, saveTenantRegisterProfile, saveTenantRepresentatives, saveTenantTaxProfile, } from '@/lib/tenant/tenantCenterService';
import { saveTenantBrandingProfile } from '@/lib/tenant/tenantBrandingService';
import { EMPTY_TENANT_LOGO, hasTenantLogoChanges, type TenantLogoValue } from '@/lib/tenant/tenantLogoService';
import type { TenantCenterSectionKey, TenantCenterSnapshot } from '@/types/tenant/tenantCenter';
import type { PermissionKey, ServiceResult } from '@/types';
import { COMPANY_EDITOR_TITLES, validateCompanyEditor } from './forms/companyEditorModel';
import { COMPANY_EDITOR_CSS, TenantCompanyEditorForms } from "./forms/TenantCompanyEditorForms.native.tsx";
type Props = {
    activeSection: TenantCenterSectionKey | null;
    snapshot: TenantCenterSnapshot;
    tenantId: string;
    effectivePermissions?: readonly PermissionKey[];
    onClose: () => void;
    onSaved: (saved?: TenantCenterSnapshot, section?: TenantCenterSectionKey) => void;
    onReloaded?: (saved: TenantCenterSnapshot, section: TenantCenterSectionKey) => void;
};
/** Each opening starts from the saved snapshot; background refreshes never erase an open draft. */
export function TenantCenterSectionModals(props: Props) {
    if (!props.activeSection)
        return null;
    return <NativeWorkspaceStyleScope css={[COMPANY_EDITOR_CSS]}>{<CompanySectionEditor key={`${props.tenantId}:${props.activeSection}`} {...props} section={props.activeSection}/>}</NativeWorkspaceStyleScope>;
}
function CompanySectionEditor({ snapshot, tenantId, section, onClose, onSaved, onReloaded, effectivePermissions }: Props & {
    section: TenantCenterSectionKey;
}) {
    const window = useNativeWorkflowWindow();
    const { roleKey, can } = usePermissions();
    const allowed = (effectivePermissions ? effectivePermissions.includes('business.tenant.manage') : can('business.tenant.manage')) && snapshot.tenantId === tenantId;
    const [initial, setInitial] = useState<TenantCenterSnapshot>(() => JSON.parse(JSON.stringify(snapshot)) as TenantCenterSnapshot);
    const [draft, setDraft] = useState(initial);
    const [baseline, setBaseline] = useState(() => JSON.stringify(sectionValue(initial, section)));
    const [logo, setLogo] = useState<TenantLogoValue>(() => ({ ...EMPTY_TENANT_LOGO, displayUri: snapshot.branding.logoUrl || null }));
    const [logoPicking, setLogoPicking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [needsReload, setNeedsReload] = useState(false);
    const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);
    const [reloading, setReloading] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const pending = useRef(false);
    const mounted = useRef(true);
    const allowedRef = useRef(allowed);
    allowedRef.current = allowed;
    const editorRef = useRef<HTMLDivElement>(null);
    const editable = section !== 'audit' && !!COMPANY_EDITOR_TITLES[section];
    const dirty = section === 'branding' ? hasTenantLogoChanges(logo, initial.branding.logoUrl) : JSON.stringify(sectionValue(draft, section)) !== baseline;
    const title = COMPANY_EDITOR_TITLES[section] ?? 'Unternehmen';
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    useEffect(() => {
        if (!dirty && !saving && !reloading)
            return;
        const blockReload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', blockReload);
        return () => window.removeEventListener('beforeunload', blockReload);
    }, [dirty, saving, reloading]);
    const requestClose = useCallback(() => {
        if (pending.current || logoPicking)
            return;
        if (dirty) {
            setDiscardOpen(true);
            return;
        }
        onClose();
    }, [dirty, logoPicking, onClose]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented)
                return;
            event.preventDefault();
            requestClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [requestClose]);
    const updateDraft = (next: TenantCenterSnapshot) => {
        if (pending.current || needsReload)
            return;
        setDraft(next);
        setError(null);
        setDiscardOpen(false);
        if (Object.keys(errors).length)
            setErrors(validateCompanyEditor(section, next));
    };
    const save = async () => {
        if (pending.current || logoPicking || needsReload || !dirty || !editable)
            return;
        if (!allowed) {
            setError('Sie haben keine Berechtigung, diese Unternehmensdaten zu ändern.');
            return;
        }
        const fieldErrors = validateCompanyEditor(section, draft);
        setErrors(fieldErrors);
        if (Object.keys(fieldErrors).length) {
            setError('Bitte prüfen Sie die markierten Angaben. Ihre Änderungen bleiben erhalten.');
            requestAnimationFrame(() => editorRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
            return;
        }
        pending.current = true;
        setSaving(true);
        setError(null);
        setDiscardOpen(false);
        const removedIds = <T extends {
            id?: string;
        }>(before: T[], after: T[]) => before.flatMap(row => row.id && !after.some(next => next.id === row.id) ? [row.id] : []);
        try {
            let result: ServiceResult<TenantCenterSnapshot>;
            switch (section) {
                case 'company':
                    result = await saveTenantCompanyProfile(tenantId, draft.company, roleKey);
                    break;
                case 'legal':
                    result = await saveTenantLegalProfile(tenantId, draft.legal, roleKey);
                    break;
                case 'tax':
                    result = await saveTenantTaxProfile(tenantId, draft.tax, roleKey);
                    break;
                case 'register':
                    result = await saveTenantRegisterProfile(tenantId, draft.register, roleKey);
                    break;
                case 'contact':
                    result = await saveTenantContactProfile(tenantId, draft.contact, roleKey, { removedIds: removedIds(initial.contact.contactPersons, draft.contact.contactPersons) });
                    break;
                case 'representatives':
                    result = await saveTenantRepresentatives(tenantId, draft.representatives, roleKey, { removedIds: removedIds(initial.representatives, draft.representatives) });
                    break;
                case 'bank':
                    result = await saveTenantBankAccounts(tenantId, draft.bankAccounts, roleKey, { removedIds: removedIds(initial.bankAccounts, draft.bankAccounts) });
                    break;
                case 'payment':
                    result = await saveTenantPaymentTerms(tenantId, draft.payment, roleKey);
                    break;
                case 'modules':
                    result = await saveTenantModuleSettings(tenantId, draft.modules, roleKey);
                    break;
                case 'branding': {
                    const branding = await saveTenantBrandingProfile(tenantId, draft.branding, logo, roleKey);
                    result = branding.ok ? { ok: true, data: { ...snapshot, branding: branding.data } } : branding;
                    break;
                }
                default: return;
            }
            if (!mounted.current)
                return;
            if (!result.ok) {
                setError(result.error || 'Die Änderungen konnten nicht gespeichert werden. Bitte erneut versuchen.');
                if (result.error.startsWith('Die Änderungen wurden nicht vollständig gespeichert.'))
                    setNeedsReload(true);
                return;
            }
            onSaved(result.data, section);
            onClose();
        }
        catch {
            if (mounted.current) {
                const multipleRequests = section === 'contact' || section === 'representatives' || section === 'bank';
                if (multipleRequests) {
                    setNeedsReload(true);
                    setError('Die Verbindung wurde unterbrochen. Einige Änderungen könnten bereits gespeichert sein. Laden Sie den gespeicherten Stand neu, bevor Sie weitere Änderungen speichern. Ihre bisherigen Eingaben bleiben bis dahin sichtbar.');
                }
                else {
                    setError('Die Verbindung wurde unterbrochen. Ihre Eingaben bleiben erhalten. Bitte versuchen Sie das Speichern erneut.');
                }
            }
        }
        finally {
            pending.current = false;
            if (mounted.current)
                setSaving(false);
        }
    };
    const reloadSaved = async () => {
        if (pending.current || !needsReload || !reloadConfirmOpen)
            return;
        if (!allowed) {
            setError('Sie haben keine Berechtigung, diese Unternehmensdaten neu zu laden.');
            return;
        }
        pending.current = true;
        setReloading(true);
        setError(null);
        setDiscardOpen(false);
        try {
            const result = await fetchTenantCenter(tenantId, roleKey);
            if (!mounted.current)
                return;
            if (!allowedRef.current) {
                setError('Ihre Berechtigung hat sich geändert. Die Daten wurden nicht übernommen.');
                return;
            }
            if (!result.ok) {
                setError(`Der gespeicherte Stand konnte nicht geladen werden. ${result.error} Ihre bisherigen Eingaben bleiben erhalten.`);
                return;
            }
            if (result.data.tenantId !== tenantId) {
                setError('Die geladenen Daten gehören nicht zu diesem Unternehmen. Ihre bisherigen Eingaben bleiben erhalten.');
                return;
            }
            const next = JSON.parse(JSON.stringify(result.data)) as TenantCenterSnapshot;
            setInitial(next);
            setDraft(next);
            setBaseline(JSON.stringify(sectionValue(next, section)));
            setLogo({ ...EMPTY_TENANT_LOGO, displayUri: next.branding.logoUrl || null });
            setErrors({});
            setError(null);
            setNeedsReload(false);
            setReloadConfirmOpen(false);
            onReloaded?.(next, section);
        }
        catch {
            if (mounted.current)
                setError('Der gespeicherte Stand konnte nicht geladen werden. Bitte versuchen Sie das Neuladen erneut. Ihre bisherigen Eingaben bleiben erhalten.');
        }
        finally {
            pending.current = false;
            if (mounted.current)
                setReloading(false);
        }
    };
    const footer = <NativeDiv className="cs-company-editor">
    {discardOpen ? <NativeDiv className="cs-company-discard" role="alert"><NativeP>Ungespeicherte Änderungen verwerfen?</NativeP><NativeDiv className="cs-company-editor-actions">
      <NativeButton type="button" onClick={() => setDiscardOpen(false)}>Weiter bearbeiten</NativeButton><NativeButton type="button" className="cs-company-remove" onClick={onClose}>Änderungen verwerfen</NativeButton>
    </NativeDiv></NativeDiv> : null}
    <NativeDiv className="cs-company-editor-status"><NativeP aria-live="polite">{reloading ? 'Gespeicherter Stand wird geladen …' : saving ? 'Änderungen werden gespeichert …' : needsReload ? 'Vor dem Speichern neu laden' : logoPicking ? 'Logo wird eingelesen …' : dirty ? <NativeStrong>Noch nicht gespeichert</NativeStrong> : editable ? 'Gespeicherter Stand' : 'Unternehmensakte'}</NativeP>
      <NativeDiv className="cs-company-editor-actions"><NativeButton type="button" onClick={requestClose} disabled={saving || reloading || logoPicking}>{editable ? 'Abbrechen' : 'Schließen'}</NativeButton>
        {editable && allowed ? <NativeButton type="button" className="cs-company-primary" disabled={saving || reloading || needsReload || logoPicking || !dirty} onClick={() => void save()}>{saving ? 'Wird gespeichert …' : 'Änderungen speichern'}</NativeButton> : null}
      </NativeDiv>
    </NativeDiv>
  </NativeDiv>;
    return <NativeWorkspaceStyleScope css={[COMPANY_EDITOR_CSS, COMPANY_EDITOR_CSS]}>{<PlatformModal surfaceScope="company" visible title={title} subtitle="Unternehmen" onClose={requestClose} maxWidth={860} maxHeightRatio={0.92} dismissOnBackdrop={false} bodyStyle={{ backgroundColor: '#f4f8fd', padding: 18 }} sheetStyle={{ backgroundColor: '#f4f8fd' }} footerContent={footer}>
    <NativeDiv className="cs-company-editor" ref={editorRef}>
      <NativeStyle>{COMPANY_EDITOR_CSS}</NativeStyle>
      {error ? <NativeDiv className="cs-company-save-error" role="alert">{error}</NativeDiv> : null}
      {needsReload ? <NativeDiv className="cs-company-discard" role="alert">
        {reloadConfirmOpen ? <><NativeP>Gespeicherten Stand neu laden?</NativeP><NativeP>Dabei werden Ihre noch nicht gespeicherten Eingaben verworfen. Bereits gespeicherte Änderungen bleiben erhalten.</NativeP><NativeDiv className="cs-company-editor-actions">
          <NativeButton type="button" disabled={reloading} onClick={() => setReloadConfirmOpen(false)}>Zurück zum Entwurf</NativeButton>
          <NativeButton type="button" className="cs-company-primary" disabled={reloading || !allowed} onClick={() => void reloadSaved()}>{reloading ? 'Wird neu geladen …' : 'Neu laden und Eingaben verwerfen'}</NativeButton>
        </NativeDiv></> : <><NativeP>Ein erneutes Speichern ist erst möglich, wenn der gespeicherte Stand geladen wurde. So werden bereits angelegte Einträge nicht doppelt erstellt.</NativeP><NativeButton type="button" disabled={!allowed} onClick={() => { setReloadConfirmOpen(true); setDiscardOpen(false); }}>Gespeicherten Stand neu laden</NativeButton></>}
      </NativeDiv> : null}
      {!allowed && editable ? <NativeDiv className="cs-company-save-error" role="alert">Sie haben keine Berechtigung, diese Unternehmensdaten zu ändern.</NativeDiv> : null}
      {section === 'audit' ? <NativeDiv className="cs-company-audit">{snapshot.auditLogs.length ? snapshot.auditLogs.map(entry => <NativeArticle key={entry.id}>
        <NativeStrong>{entry.title ?? entry.action}</NativeStrong><NativeTime dateTime={entry.createdAt}>{formatAuditDate(entry.createdAt)}</NativeTime>{entry.description ? <NativeP>{entry.description}</NativeP> : null}
      </NativeArticle>) : <NativeP className="cs-company-empty">Noch keine Änderungen protokolliert.</NativeP>}</NativeDiv> : editable ?
            <NativeForm noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
          <NativeFieldset disabled={saving || reloading || needsReload || !allowed}>
            {section === 'branding' ? <NativeSection className="cs-company-form-group"><NativeHeader><NativeH3>Ihr Unternehmenslogo</NativeH3><NativeP>Wählen Sie eine Datei aus oder entfernen Sie das bisherige Logo. Die Änderung wird erst mit „Änderungen speichern“ übernommen.</NativeP></NativeHeader>
              <NativeDiv style={{ background: '#eff4fa', border: '1px solid #d6e2ef', borderRadius: 16, padding: 16 }}>
                <TenantLogoPicker companyName={draft.company.name} value={logo} onChange={next => { setLogo(next); setError(null); setDiscardOpen(false); }} onPickingChange={setLogoPicking} disabled={saving || !allowed}/>
              </NativeDiv>
            </NativeSection> : <TenantCompanyEditorForms section={section} value={draft} onChange={updateDraft} errors={errors}/>}
          </NativeFieldset>
        </NativeForm> : <NativeP className="cs-company-empty">Dieser Bereich kann hier noch nicht bearbeitet werden.</NativeP>}
    </NativeDiv>
  </PlatformModal>}</NativeWorkspaceStyleScope>;
}
function formatAuditDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function sectionValue(snapshot: TenantCenterSnapshot, section: TenantCenterSectionKey): unknown {
    if (section === 'bank')
        return snapshot.bankAccounts;
    if (section === 'audit')
        return snapshot.auditLogs;
    return section in snapshot ? snapshot[section as keyof TenantCenterSnapshot] : null;
}
