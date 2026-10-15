import { useCallback, useEffect, useRef, useState } from 'react';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { TenantLogoPicker } from '@/components/tenant/TenantLogoPicker';
import { usePermissions } from '@/hooks/usePermissions';
import {
  fetchTenantCenter,
  saveTenantBankAccounts, saveTenantCompanyProfile, saveTenantContactProfile, saveTenantLegalProfile,
  saveTenantModuleSettings, saveTenantPaymentTerms, saveTenantRegisterProfile, saveTenantRepresentatives, saveTenantTaxProfile,
} from '@/lib/tenant/tenantCenterService';
import { saveTenantBrandingProfile } from '@/lib/tenant/tenantBrandingService';
import { EMPTY_TENANT_LOGO, hasTenantLogoChanges, type TenantLogoValue } from '@/lib/tenant/tenantLogoService';
import type { TenantCenterSectionKey, TenantCenterSnapshot } from '@/types/tenant/tenantCenter';
import type { ServiceResult } from '@/types';
import { COMPANY_EDITOR_TITLES, validateCompanyEditor } from './forms/companyEditorModel';
import { COMPANY_EDITOR_CSS, TenantCompanyEditorForms } from './forms/TenantCompanyEditorForms.web';

type Props = {
  activeSection: TenantCenterSectionKey | null;
  snapshot: TenantCenterSnapshot;
  tenantId: string;
  onClose: () => void;
  onSaved: (saved?: TenantCenterSnapshot, section?: TenantCenterSectionKey) => void;
  onReloaded?: (saved: TenantCenterSnapshot, section: TenantCenterSectionKey) => void;
};

/** Each opening starts from the saved snapshot; background refreshes never erase an open draft. */
export function TenantCenterSectionModals(props: Props) {
  if (!props.activeSection) return null;
  return <CompanySectionEditor key={`${props.tenantId}:${props.activeSection}`} {...props} section={props.activeSection} />;
}

function CompanySectionEditor({ snapshot, tenantId, section, onClose, onSaved, onReloaded }: Props & { section: TenantCenterSectionKey }) {
  const { roleKey, can } = usePermissions();
  const allowed = can('business.tenant.manage') && snapshot.tenantId === tenantId;
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
    if (!dirty && !saving && !reloading) return;
    const blockReload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', blockReload);
    return () => window.removeEventListener('beforeunload', blockReload);
  }, [dirty, saving, reloading]);

  const requestClose = useCallback(() => {
    if (pending.current || logoPicking) return;
    if (dirty) { setDiscardOpen(true); return; }
    onClose();
  }, [dirty, logoPicking, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault(); requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  const updateDraft = (next: TenantCenterSnapshot) => {
    if (pending.current || needsReload) return;
    setDraft(next); setError(null); setDiscardOpen(false);
    if (Object.keys(errors).length) setErrors(validateCompanyEditor(section, next));
  };

  const save = async () => {
    if (pending.current || logoPicking || needsReload || !dirty || !editable) return;
    if (!allowed) { setError('Sie haben keine Berechtigung, diese Unternehmensdaten zu ändern.'); return; }
    const fieldErrors = validateCompanyEditor(section, draft);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) {
      setError('Bitte prüfen Sie die markierten Angaben. Ihre Änderungen bleiben erhalten.');
      requestAnimationFrame(() => editorRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    pending.current = true; setSaving(true); setError(null); setDiscardOpen(false);
    const removedIds = <T extends { id?: string }>(before: T[], after: T[]) => before.flatMap(row => row.id && !after.some(next => next.id === row.id) ? [row.id] : []);
    try {
      let result: ServiceResult<TenantCenterSnapshot>;
      switch (section) {
        case 'company': result = await saveTenantCompanyProfile(tenantId, draft.company, roleKey); break;
        case 'legal': result = await saveTenantLegalProfile(tenantId, draft.legal, roleKey); break;
        case 'tax': result = await saveTenantTaxProfile(tenantId, draft.tax, roleKey); break;
        case 'register': result = await saveTenantRegisterProfile(tenantId, draft.register, roleKey); break;
        case 'contact': result = await saveTenantContactProfile(tenantId, draft.contact, roleKey, { removedIds: removedIds(initial.contact.contactPersons, draft.contact.contactPersons) }); break;
        case 'representatives': result = await saveTenantRepresentatives(tenantId, draft.representatives, roleKey, { removedIds: removedIds(initial.representatives, draft.representatives) }); break;
        case 'bank': result = await saveTenantBankAccounts(tenantId, draft.bankAccounts, roleKey, { removedIds: removedIds(initial.bankAccounts, draft.bankAccounts) }); break;
        case 'payment': result = await saveTenantPaymentTerms(tenantId, draft.payment, roleKey); break;
        case 'modules': result = await saveTenantModuleSettings(tenantId, draft.modules, roleKey); break;
        case 'branding': {
          const branding = await saveTenantBrandingProfile(tenantId, draft.branding, logo, roleKey);
          result = branding.ok ? { ok: true, data: { ...snapshot, branding: branding.data } } : branding;
          break;
        }
        default: return;
      }
      if (!mounted.current) return;
      if (!result.ok) {
        setError(result.error || 'Die Änderungen konnten nicht gespeichert werden. Bitte erneut versuchen.');
        if (result.error.startsWith('Die Änderungen wurden nicht vollständig gespeichert.')) setNeedsReload(true);
        return;
      }
      onSaved(result.data, section);
      onClose();
    } catch {
      if (mounted.current) {
        const multipleRequests = section === 'contact' || section === 'representatives' || section === 'bank';
        if (multipleRequests) {
          setNeedsReload(true);
          setError('Die Verbindung wurde unterbrochen. Einige Änderungen könnten bereits gespeichert sein. Laden Sie den gespeicherten Stand neu, bevor Sie weitere Änderungen speichern. Ihre bisherigen Eingaben bleiben bis dahin sichtbar.');
        } else {
          setError('Die Verbindung wurde unterbrochen. Ihre Eingaben bleiben erhalten. Bitte versuchen Sie das Speichern erneut.');
        }
      }
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const reloadSaved = async () => {
    if (pending.current || !needsReload || !reloadConfirmOpen) return;
    if (!allowed) { setError('Sie haben keine Berechtigung, diese Unternehmensdaten neu zu laden.'); return; }
    pending.current = true; setReloading(true); setError(null); setDiscardOpen(false);
    try {
      const result = await fetchTenantCenter(tenantId, roleKey);
      if (!mounted.current) return;
      if (!allowedRef.current) { setError('Ihre Berechtigung hat sich geändert. Die Daten wurden nicht übernommen.'); return; }
      if (!result.ok) { setError(`Der gespeicherte Stand konnte nicht geladen werden. ${result.error} Ihre bisherigen Eingaben bleiben erhalten.`); return; }
      if (result.data.tenantId !== tenantId) { setError('Die geladenen Daten gehören nicht zu diesem Unternehmen. Ihre bisherigen Eingaben bleiben erhalten.'); return; }
      const next = JSON.parse(JSON.stringify(result.data)) as TenantCenterSnapshot;
      setInitial(next); setDraft(next); setBaseline(JSON.stringify(sectionValue(next, section)));
      setLogo({ ...EMPTY_TENANT_LOGO, displayUri: next.branding.logoUrl || null });
      setErrors({}); setError(null); setNeedsReload(false); setReloadConfirmOpen(false);
      onReloaded?.(next, section);
    } catch {
      if (mounted.current) setError('Der gespeicherte Stand konnte nicht geladen werden. Bitte versuchen Sie das Neuladen erneut. Ihre bisherigen Eingaben bleiben erhalten.');
    } finally {
      pending.current = false;
      if (mounted.current) setReloading(false);
    }
  };

  const footer = <div className="cs-company-editor">
    {discardOpen ? <div className="cs-company-discard" role="alert"><p>Ungespeicherte Änderungen verwerfen?</p><div className="cs-company-editor-actions">
      <button type="button" onClick={() => setDiscardOpen(false)}>Weiter bearbeiten</button><button type="button" className="cs-company-remove" onClick={onClose}>Änderungen verwerfen</button>
    </div></div> : null}
    <div className="cs-company-editor-status"><p aria-live="polite">{reloading ? 'Gespeicherter Stand wird geladen …' : saving ? 'Änderungen werden gespeichert …' : needsReload ? 'Vor dem Speichern neu laden' : logoPicking ? 'Logo wird eingelesen …' : dirty ? <strong>Noch nicht gespeichert</strong> : editable ? 'Gespeicherter Stand' : 'Unternehmensakte'}</p>
      <div className="cs-company-editor-actions"><button type="button" onClick={requestClose} disabled={saving || reloading || logoPicking}>{editable ? 'Abbrechen' : 'Schließen'}</button>
        {editable && allowed ? <button type="button" className="cs-company-primary" disabled={saving || reloading || needsReload || logoPicking || !dirty} onClick={() => void save()}>{saving ? 'Wird gespeichert …' : 'Änderungen speichern'}</button> : null}
      </div>
    </div>
  </div>;

  return <PlatformModal surfaceScope="company" visible title={title} subtitle="Unternehmen" onClose={requestClose} maxWidth={860} maxHeightRatio={0.92}
    dismissOnBackdrop={false} bodyStyle={{ backgroundColor: '#08172a', padding: 18 }} sheetStyle={{ backgroundColor: '#08172a' }} footerContent={footer}>
    <div className="cs-company-editor" ref={editorRef}>
      <style>{COMPANY_EDITOR_CSS}</style>
      {error ? <div className="cs-company-save-error" role="alert">{error}</div> : null}
      {needsReload ? <div className="cs-company-discard" role="alert">
        {reloadConfirmOpen ? <><p>Gespeicherten Stand neu laden?</p><p>Dabei werden Ihre noch nicht gespeicherten Eingaben verworfen. Bereits gespeicherte Änderungen bleiben erhalten.</p><div className="cs-company-editor-actions">
          <button type="button" disabled={reloading} onClick={() => setReloadConfirmOpen(false)}>Zurück zum Entwurf</button>
          <button type="button" className="cs-company-primary" disabled={reloading || !allowed} onClick={() => void reloadSaved()}>{reloading ? 'Wird neu geladen …' : 'Neu laden und Eingaben verwerfen'}</button>
        </div></> : <><p>Ein erneutes Speichern ist erst möglich, wenn der gespeicherte Stand geladen wurde. So werden bereits angelegte Einträge nicht doppelt erstellt.</p><button type="button" disabled={!allowed} onClick={() => { setReloadConfirmOpen(true); setDiscardOpen(false); }}>Gespeicherten Stand neu laden</button></>}
      </div> : null}
      {!allowed && editable ? <div className="cs-company-save-error" role="alert">Sie haben keine Berechtigung, diese Unternehmensdaten zu ändern.</div> : null}
      {section === 'audit' ? <div className="cs-company-audit">{snapshot.auditLogs.length ? snapshot.auditLogs.map(entry => <article key={entry.id}>
        <strong>{entry.title ?? entry.action}</strong><time dateTime={entry.createdAt}>{formatAuditDate(entry.createdAt)}</time>{entry.description ? <p>{entry.description}</p> : null}
      </article>) : <p className="cs-company-empty">Noch keine Änderungen protokolliert.</p>}</div> : editable ?
        <form noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
          <fieldset disabled={saving || reloading || needsReload || !allowed}>
            {section === 'branding' ? <section className="cs-company-form-group"><header><h3>Ihr Unternehmenslogo</h3><p>Wählen Sie eine Datei aus oder entfernen Sie das bisherige Logo. Die Änderung wird erst mit „Änderungen speichern“ übernommen.</p></header>
              <div style={{ background: '#eff4fa', border: '1px solid #d6e2ef', borderRadius: 16, padding: 16 }}>
                <TenantLogoPicker companyName={draft.company.name} value={logo} onChange={next => { setLogo(next); setError(null); setDiscardOpen(false); }} onPickingChange={setLogoPicking} disabled={saving || !allowed} />
              </div>
            </section> : <TenantCompanyEditorForms section={section} value={draft} onChange={updateDraft} errors={errors} />}
          </fieldset>
        </form> : <p className="cs-company-empty">Dieser Bereich kann hier noch nicht bearbeitet werden.</p>}
    </div>
  </PlatformModal>;
}

function formatAuditDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function sectionValue(snapshot: TenantCenterSnapshot, section: TenantCenterSectionKey): unknown {
  if (section === 'bank') return snapshot.bankAccounts;
  if (section === 'audit') return snapshot.auditLogs;
  return section in snapshot ? snapshot[section as keyof TenantCenterSnapshot] : null;
}
