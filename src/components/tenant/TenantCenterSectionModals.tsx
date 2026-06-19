import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TenantCenterGlassModal } from '@/components/tenant/TenantCenterGlassModal';
import { TenantCompanyProfileForm } from '@/components/tenant/forms/TenantCompanyProfileForm';
import {
  TenantLegalProfileForm,
  TenantRegisterProfileForm,
  TenantTaxProfileForm,
} from '@/components/tenant/forms/TenantProfileForms';
import {
  TenantBankAccountsForm,
  TenantContactProfileForm,
  TenantModuleSettingsForm,
  TenantPaymentTermsForm,
  TenantRepresentativesForm,
} from '@/components/tenant/forms/TenantExtendedProfileForms';
import { TenantLogoPicker } from '@/components/tenant/TenantLogoPicker';
import { PremiumInput } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import type { TenantCenterSectionKey, TenantCenterSnapshot } from '@/types/tenant/tenantCenter';
import {
  saveTenantBankAccounts,
  saveTenantCompanyProfile,
  saveTenantContactProfile,
  saveTenantLegalProfile,
  saveTenantModuleSettings,
  saveTenantPaymentTerms,
  saveTenantRegisterProfile,
  saveTenantRepresentatives,
  saveTenantTaxProfile,
} from '@/lib/tenant/tenantCenterService';
import { saveTenantBrandingProfile } from '@/lib/tenant/tenantBrandingService';
import { EMPTY_TENANT_LOGO, type TenantLogoValue } from '@/lib/tenant/tenantLogoService';
import { usePermissions } from '@/hooks/usePermissions';

type Props = {
  activeSection: TenantCenterSectionKey | null;
  snapshot: TenantCenterSnapshot;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function TenantCenterSectionModals({
  activeSection,
  snapshot,
  tenantId,
  onClose,
  onSaved,
}: Props) {
  const text = useAuroraAdaptiveText();
  const { roleKey } = usePermissions();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [company, setCompany] = useState(snapshot.company);
  const [legal, setLegal] = useState(snapshot.legal);
  const [tax, setTax] = useState(snapshot.tax);
  const [register, setRegister] = useState(snapshot.register);
  const [contact, setContact] = useState(snapshot.contact);
  const [representatives, setRepresentatives] = useState(snapshot.representatives);
  const [bankAccounts, setBankAccounts] = useState(snapshot.bankAccounts);
  const [payment, setPayment] = useState(snapshot.payment);
  const [branding, setBranding] = useState(snapshot.branding);
  const [modules, setModules] = useState(snapshot.modules);
  const [logo, setLogo] = useState<TenantLogoValue>({
    ...EMPTY_TENANT_LOGO,
    displayUri: snapshot.branding.logoUrl || null,
  });

  const runSave = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setSaving(true);
    setError(null);
    const result = await action();
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'Speichern fehlgeschlagen.');
      return;
    }
    onSaved();
    onClose();
  };

  const common = {
    onClose,
    primaryLoading: saving,
  };

  return (
    <>
      <TenantCenterGlassModal
        {...common}
        visible={activeSection === 'company'}
        title="Unternehmensdaten"
        onPrimary={() => runSave(() => saveTenantCompanyProfile(tenantId, company, roleKey))}
      >
        <TenantCompanyProfileForm value={company} onChange={setCompany} />
        {error ? <Text style={{ color: '#F87171' }}>{error}</Text> : null}
      </TenantCenterGlassModal>

      <TenantCenterGlassModal
        {...common}
        visible={activeSection === 'legal'}
        title="Rechtliche Angaben"
        onPrimary={() => runSave(() => saveTenantLegalProfile(tenantId, legal, roleKey))}
      >
        <TenantLegalProfileForm value={legal} onChange={setLegal} />
        {error ? <Text style={{ color: '#F87171' }}>{error}</Text> : null}
      </TenantCenterGlassModal>

      <TenantCenterGlassModal
        {...common}
        visible={activeSection === 'tax'}
        title="Steuerdaten"
        onPrimary={() => runSave(() => saveTenantTaxProfile(tenantId, tax, roleKey))}
      >
        <TenantTaxProfileForm value={tax} onChange={setTax} />
        {error ? <Text style={{ color: '#F87171' }}>{error}</Text> : null}
      </TenantCenterGlassModal>

      <TenantCenterGlassModal
        {...common}
        visible={activeSection === 'register'}
        title="Registerdaten"
        onPrimary={() => runSave(() => saveTenantRegisterProfile(tenantId, register, roleKey))}
      >
        <TenantRegisterProfileForm value={register} onChange={setRegister} />
        {error ? <Text style={{ color: '#F87171' }}>{error}</Text> : null}
      </TenantCenterGlassModal>

      <TenantCenterGlassModal
        {...common}
        visible={activeSection === 'contact'}
        title="Kontakt & Kommunikation"
        onPrimary={() => runSave(() => saveTenantContactProfile(tenantId, contact, roleKey))}
      >
        <TenantContactProfileForm value={contact} onChange={setContact} />
        {error ? <Text style={{ color: '#F87171' }}>{error}</Text> : null}
      </TenantCenterGlassModal>

      <TenantCenterGlassModal
        {...common}
        visible={activeSection === 'representatives'}
        title="Geschäftsführung / Vertretung"
        onPrimary={() => runSave(() => saveTenantRepresentatives(tenantId, representatives, roleKey))}
      >
        <TenantRepresentativesForm value={representatives} onChange={setRepresentatives} />
        {error ? <Text style={{ color: '#F87171' }}>{error}</Text> : null}
      </TenantCenterGlassModal>

      <TenantCenterGlassModal
        {...common}
        visible={activeSection === 'bank'}
        title="Bankverbindungen"
        onPrimary={() => runSave(() => saveTenantBankAccounts(tenantId, bankAccounts, roleKey))}
      >
        <TenantBankAccountsForm value={bankAccounts} onChange={setBankAccounts} />
        {error ? <Text style={{ color: '#F87171' }}>{error}</Text> : null}
      </TenantCenterGlassModal>

      <TenantCenterGlassModal
        {...common}
        visible={activeSection === 'payment'}
        title="Zahlungsbedingungen & Mahnwesen"
        onPrimary={() => runSave(() => saveTenantPaymentTerms(tenantId, payment, roleKey))}
      >
        <TenantPaymentTermsForm value={payment} onChange={setPayment} />
        {error ? <Text style={{ color: '#F87171' }}>{error}</Text> : null}
      </TenantCenterGlassModal>

      <TenantCenterGlassModal
        {...common}
        visible={activeSection === 'branding'}
        title="Branding & Logo"
        onPrimary={() =>
          runSave(async () => saveTenantBrandingProfile(tenantId, branding, logo, roleKey))
        }
      >
        <TenantLogoPicker companyName={company.name} value={logo} onChange={setLogo} />
        <PremiumInput label="App-Name" value={branding.appName} onChangeText={(v) => setBranding({ ...branding, appName: v })} />
        <PremiumInput label="Primärfarbe" value={branding.primaryColor} onChangeText={(v) => setBranding({ ...branding, primaryColor: v })} />
        <PremiumInput label="Akzentfarbe" value={branding.accentColor} onChangeText={(v) => setBranding({ ...branding, accentColor: v })} />
        {error ? <Text style={{ color: '#F87171' }}>{error}</Text> : null}
      </TenantCenterGlassModal>

      <TenantCenterGlassModal
        {...common}
        visible={activeSection === 'modules'}
        title="Module & Leistungsbereiche"
        onPrimary={() => runSave(() => saveTenantModuleSettings(tenantId, modules, roleKey))}
      >
        <TenantModuleSettingsForm value={modules} onChange={setModules} />
        {error ? <Text style={{ color: '#F87171' }}>{error}</Text> : null}
      </TenantCenterGlassModal>

      <TenantCenterGlassModal
        visible={activeSection === 'audit'}
        title="Audit-Log / Änderungshistorie"
        onClose={onClose}
      >
        {snapshot.auditLogs.length ? (
          snapshot.auditLogs.map((entry) => (
            <View key={entry.id} style={styles.auditRow}>
              <Text style={{ color: text.primary, fontWeight: '600' }}>{entry.title ?? entry.action}</Text>
              <Text style={{ color: text.muted, fontSize: 12 }}>{entry.createdAt}</Text>
              {entry.description ? <Text style={{ color: text.secondary }}>{entry.description}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={{ color: text.muted }}>Noch keine Einträge vorhanden.</Text>
        )}
      </TenantCenterGlassModal>

      <TenantCenterGlassModal
        visible={!!activeSection && ['supervisory', 'locations', 'documentLayout', 'ikNumbers', 'travelSurcharges'].includes(activeSection)}
        title="Demnächst"
        onClose={onClose}
      >
        <Text style={{ color: text.secondary }}>
          Dieser Bereich ist in Phase 1 als Karte verfügbar und wird in einer späteren Phase vollständig angebunden.
        </Text>
      </TenantCenterGlassModal>
    </>
  );
}

const styles = StyleSheet.create({
  auditRow: {
    gap: 4,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
});
