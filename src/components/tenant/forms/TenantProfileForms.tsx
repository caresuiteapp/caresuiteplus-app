import { StyleSheet, View } from 'react-native';
import { PremiumInput } from '@/components/ui';
import type { TenantLegalProfile, TenantRegisterProfile, TenantTaxProfile } from '@/types/tenant/tenantCenter';

export function TenantLegalProfileForm({
  value,
  onChange,
}: {
  value: TenantLegalProfile;
  onChange: (next: TenantLegalProfile) => void;
}) {
  const patch = <K extends keyof TenantLegalProfile>(key: K, next: TenantLegalProfile[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <View style={styles.form}>
      <PremiumInput label="Haftpflichtversicherung" value={value.liabilityInsurance} onChangeText={(v) => patch('liabilityInsurance', v)} />
      <PremiumInput label="Versicherer" value={value.liabilityInsurer} onChangeText={(v) => patch('liabilityInsurer', v)} />
      <PremiumInput label="Policennummer" value={value.liabilityPolicyNumber} onChangeText={(v) => patch('liabilityPolicyNumber', v)} />
      <PremiumInput label="Kammerzugehörigkeit" value={value.chamberMembership} onChangeText={(v) => patch('chamberMembership', v)} />
      <PremiumInput label="Berufsverband" value={value.professionalAssociation} onChangeText={(v) => patch('professionalAssociation', v)} />
      <PremiumInput label="Anmerkungen" value={value.legalNotes} onChangeText={(v) => patch('legalNotes', v)} multiline />
    </View>
  );
}

export function TenantTaxProfileForm({
  value,
  onChange,
}: {
  value: TenantTaxProfile;
  onChange: (next: TenantTaxProfile) => void;
}) {
  const patch = <K extends keyof TenantTaxProfile>(key: K, next: TenantTaxProfile[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <View style={styles.form}>
      <PremiumInput label="Steuernummer" value={value.taxNumber} onChangeText={(v) => patch('taxNumber', v)} />
      <PremiumInput label="USt-IdNr." value={value.vatId} onChangeText={(v) => patch('vatId', v)} autoCapitalize="characters" />
      <PremiumInput label="Finanzamt" value={value.taxOffice} onChangeText={(v) => patch('taxOffice', v)} />
      <PremiumInput label="Steuerhinweise" value={value.taxNotes} onChangeText={(v) => patch('taxNotes', v)} multiline />
    </View>
  );
}

export function TenantRegisterProfileForm({
  value,
  onChange,
}: {
  value: TenantRegisterProfile;
  onChange: (next: TenantRegisterProfile) => void;
}) {
  const patch = <K extends keyof TenantRegisterProfile>(key: K, next: TenantRegisterProfile[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <View style={styles.form}>
      <PremiumInput label="Registergericht" value={value.registerCourt} onChangeText={(v) => patch('registerCourt', v)} />
      <PremiumInput label="Registernummer" value={value.registerNumber} onChangeText={(v) => patch('registerNumber', v)} />
      <PremiumInput label="Registerart" value={value.registerType} onChangeText={(v) => patch('registerType', v)} placeholder="HRB, HRA, …" />
      <PremiumInput label="Registerdatum" value={value.registerDate} onChangeText={(v) => patch('registerDate', v)} placeholder="YYYY-MM-DD" />
      <PremiumInput label="Stammkapital" value={value.shareCapital} onChangeText={(v) => patch('shareCapital', v)} />
      <PremiumInput label="IK-Nummer" value={value.ikNumber} onChangeText={(v) => patch('ikNumber', v)} />
      <PremiumInput label="Aufsichtsbehörde" value={value.supervisoryAuthority} onChangeText={(v) => patch('supervisoryAuthority', v)} />
      <PremiumInput label="Anmerkungen" value={value.registerNotes} onChangeText={(v) => patch('registerNotes', v)} multiline />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8 },
});
