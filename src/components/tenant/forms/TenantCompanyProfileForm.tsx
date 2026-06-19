import { StyleSheet, Text, View } from 'react-native';
import { PremiumInput } from '@/components/ui';
import type { TenantCompanyProfile } from '@/types/tenant/tenantCenter';

type Props = {
  value: TenantCompanyProfile;
  onChange: (next: TenantCompanyProfile) => void;
};

export function TenantCompanyProfileForm({ value, onChange }: Props) {
  const patch = <K extends keyof TenantCompanyProfile>(key: K, next: TenantCompanyProfile[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <View style={styles.form}>
      <PremiumInput label="Firmenname" value={value.name} onChangeText={(v) => patch('name', v)} />
      <PremiumInput label="Rechtlicher Name" value={value.legalName} onChangeText={(v) => patch('legalName', v)} />
      <PremiumInput label="Rechtsform" value={value.legalForm} onChangeText={(v) => patch('legalForm', v)} placeholder="z. B. GmbH, UG" />
      <PremiumInput label="Branche" value={value.industry} onChangeText={(v) => patch('industry', v)} />
      <PremiumInput label="Straße" value={value.street} onChangeText={(v) => patch('street', v)} />
      <PremiumInput label="Hausnummer" value={value.houseNumber} onChangeText={(v) => patch('houseNumber', v)} />
      <PremiumInput label="PLZ" value={value.zip} onChangeText={(v) => patch('zip', v)} />
      <PremiumInput label="Ort" value={value.city} onChangeText={(v) => patch('city', v)} />
      <PremiumInput label="Land" value={value.country} onChangeText={(v) => patch('country', v)} />
      <PremiumInput label="Telefon" value={value.phone} onChangeText={(v) => patch('phone', v)} keyboardType="phone-pad" />
      <PremiumInput label="Fax" value={value.fax} onChangeText={(v) => patch('fax', v)} />
      <PremiumInput label="E-Mail" value={value.email} onChangeText={(v) => patch('email', v)} keyboardType="email-address" autoCapitalize="none" />
      <PremiumInput label="Website" value={value.website} onChangeText={(v) => patch('website', v)} autoCapitalize="none" />
      <PremiumInput label="Interne Notizen" value={value.notes} onChangeText={(v) => patch('notes', v)} multiline />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 8,
  },
});
