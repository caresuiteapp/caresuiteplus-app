import { TenantCompanyEditorForms } from './forms/TenantCompanyEditorForms.native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { MobileButton, MobileSheet, m } from '@/components/mobile/MobileWorkspace';
import { TenantLogoPicker } from './TenantLogoPicker';
import { COMPANY_EDITOR_TITLES, validateCompanyEditor } from './forms/companyEditorModel';
import { usePermissions } from '@/hooks/usePermissions';
import { saveTenantBankAccounts, saveTenantCompanyProfile, saveTenantContactProfile, saveTenantLegalProfile, saveTenantModuleSettings, saveTenantPaymentTerms, saveTenantRegisterProfile, saveTenantRepresentatives, saveTenantTaxProfile } from '@/lib/tenant/tenantCenterService';
import { saveTenantBrandingProfile } from '@/lib/tenant/tenantBrandingService';
import { EMPTY_TENANT_LOGO, hasTenantLogoChanges, type TenantLogoValue } from '@/lib/tenant/tenantLogoService';
import type { TenantCenterSectionKey, TenantCenterSnapshot } from '@/types/tenant/tenantCenter';
import type { PermissionKey, ServiceResult } from '@/types';

type Props = { activeSection: TenantCenterSectionKey | null; snapshot: TenantCenterSnapshot; tenantId: string; effectivePermissions?: readonly PermissionKey[]; onClose: () => void; onSaved: (saved?: TenantCenterSnapshot) => void };
export function TenantCenterSectionModals(props: Props) {
  return props.activeSection ? <Editor key={`${props.tenantId}:${props.activeSection}`} {...props} section={props.activeSection} /> : null;
}
function Editor({ section, snapshot, tenantId, effectivePermissions, onClose, onSaved }: Props & { section: TenantCenterSectionKey }) {
  const { roleKey, can } = usePermissions(); const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(snapshot)) as TenantCenterSnapshot);
  const [logo, setLogo] = useState<TenantLogoValue>({ ...EMPTY_TENANT_LOGO, displayUri: snapshot.branding.logoUrl || null });
  const [logoPicking, setLogoPicking] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const lock = useRef(false); const mounted = useRef(true); useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const allowed = snapshot.tenantId === tenantId && (effectivePermissions ? effectivePermissions.includes('business.tenant.manage') : can('business.tenant.manage'));
  const dirty = JSON.stringify(draft) !== JSON.stringify(snapshot) || hasTenantLogoChanges(logo, snapshot.branding.logoUrl);
  const close = () => { if (lock.current || logoPicking) return; if (!dirty) { onClose(); return; } Alert.alert('Änderungen verwerfen?', 'Ihre Änderungen wurden noch nicht gespeichert.', [{ text: 'Weiter bearbeiten', style: 'cancel' }, { text: 'Verwerfen', style: 'destructive', onPress: onClose }]); };
  const removed = <T extends { id?: string }>(before: T[], after: T[]) => before.flatMap(row => row.id && !after.some(next => next.id === row.id) ? [row.id] : []);
  const save = async () => {
    if (lock.current || logoPicking || !allowed) return;
    const errors = validateCompanyEditor(section, draft); if (Object.keys(errors).length) { setError(Object.values(errors).join('\n')); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      let result: ServiceResult<TenantCenterSnapshot>;
      switch (section) {
        case 'company': result = await saveTenantCompanyProfile(tenantId, draft.company, roleKey); break;
        case 'legal': result = await saveTenantLegalProfile(tenantId, draft.legal, roleKey); break;
        case 'tax': result = await saveTenantTaxProfile(tenantId, draft.tax, roleKey); break;
        case 'register': result = await saveTenantRegisterProfile(tenantId, draft.register, roleKey); break;
        case 'contact': result = await saveTenantContactProfile(tenantId, draft.contact, roleKey, { removedIds: removed(snapshot.contact.contactPersons, draft.contact.contactPersons) }); break;
        case 'representatives': result = await saveTenantRepresentatives(tenantId, draft.representatives, roleKey, { removedIds: removed(snapshot.representatives, draft.representatives) }); break;
        case 'bank': result = await saveTenantBankAccounts(tenantId, draft.bankAccounts, roleKey, { removedIds: removed(snapshot.bankAccounts, draft.bankAccounts) }); break;
        case 'payment': result = await saveTenantPaymentTerms(tenantId, draft.payment, roleKey); break;
        case 'modules': result = await saveTenantModuleSettings(tenantId, draft.modules, roleKey); break;
        case 'branding': { const branding = await saveTenantBrandingProfile(tenantId, draft.branding, logo, roleKey); result = branding.ok ? { ok: true, data: { ...snapshot, branding: branding.data } } : branding; break; }
        default: throw new Error('Für diesen Bereich ist kein Editor verfügbar.');
      }
      if (!mounted.current) return;
      if (!result.ok) { setError(result.error); return; }
      onSaved(result.data); onClose();
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Die Änderungen konnten nicht gespeichert werden.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return <MobileSheet visible title={COMPANY_EDITOR_TITLES[section] ?? 'Unternehmen'} onClose={close} footer={<><Text accessibilityRole="alert" style={m.error}>{error}</Text><MobileButton primary label="Änderungen speichern" icon="check" busy={busy} disabled={!allowed || !dirty || logoPicking} onPress={() => void save()} /></>}>
    <View pointerEvents={busy ? 'none' : 'auto'} style={m.stack}>
      <TenantCompanyEditorForms section={section} value={draft} onChange={setDraft} />
      {section === 'branding' ? <TenantLogoPicker companyName={draft.company.name} value={logo} onChange={setLogo} onPickingChange={setLogoPicking} disabled={!allowed || busy} /> : null}
    </View>
  </MobileSheet>;
}
