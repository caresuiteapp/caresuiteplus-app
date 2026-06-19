import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import type {
  TenantBankAccount,
  TenantContactCommunication,
  TenantModuleSettings,
  TenantPaymentTerms,
  TenantRepresentative,
} from '@/types/tenant/tenantCenter';

export function TenantContactProfileForm({
  value,
  onChange,
}: {
  value: TenantContactCommunication;
  onChange: (next: TenantContactCommunication) => void;
}) {
  const patch = <K extends keyof TenantContactCommunication>(key: K, next: TenantContactCommunication[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <View style={styles.form}>
      <PremiumInput label="Abrechnungs-E-Mail" value={value.billingEmail} onChangeText={(v) => patch('billingEmail', v)} keyboardType="email-address" autoCapitalize="none" />
      <PremiumInput label="Support-E-Mail" value={value.supportEmail} onChangeText={(v) => patch('supportEmail', v)} keyboardType="email-address" autoCapitalize="none" />
      <PremiumInput label="Support-Telefon" value={value.supportPhone} onChangeText={(v) => patch('supportPhone', v)} keyboardType="phone-pad" />
    </View>
  );
}

export function TenantPaymentTermsForm({
  value,
  onChange,
}: {
  value: TenantPaymentTerms;
  onChange: (next: TenantPaymentTerms) => void;
}) {
  const patch = <K extends keyof TenantPaymentTerms>(key: K, next: TenantPaymentTerms[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <View style={styles.form}>
      <PremiumInput label="Zahlungsziel (Tage)" value={value.paymentTermsDays} onChangeText={(v) => patch('paymentTermsDays', v)} keyboardType="number-pad" />
      <PremiumInput label="Mahnfrist (Tage)" value={value.dunningAfterDays} onChangeText={(v) => patch('dunningAfterDays', v)} keyboardType="number-pad" />
      <PremiumInput label="Mahngebühr (EUR)" value={value.dunningFee} onChangeText={(v) => patch('dunningFee', v)} keyboardType="decimal-pad" />
      <PremiumInput label="Rechnungspräfix" value={value.invoicePrefix} onChangeText={(v) => patch('invoicePrefix', v)} />
      <PremiumInput label="Fußzeile Rechnung" value={value.invoiceFooterText} onChangeText={(v) => patch('invoiceFooterText', v)} multiline />
      <PremiumInput label="Rechnungshinweise" value={value.invoiceNotes} onChangeText={(v) => patch('invoiceNotes', v)} multiline />
    </View>
  );
}

function MultiRowHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  const text = useAuroraAdaptiveText();
  return (
    <View style={styles.rowHeader}>
      <Text style={{ color: text.primary, fontWeight: '700' }}>{title}</Text>
      <PremiumButton title="Zeile hinzufügen" variant="ghost" size="sm" onPress={onAdd} />
    </View>
  );
}

export function TenantRepresentativesForm({
  value,
  onChange,
}: {
  value: TenantRepresentative[];
  onChange: (next: TenantRepresentative[]) => void;
}) {
  const update = (index: number, patch: Partial<TenantRepresentative>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const add = () =>
    onChange([
      ...value,
      { salutation: '', firstName: '', lastName: '', position: '', email: '', phone: '', isPrimary: value.length === 0, sortOrder: value.length },
    ]);
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <View style={styles.form}>
      <MultiRowHeader title="Vertretungsberechtigte" onAdd={add} />
      {value.map((row, index) => (
        <View key={row.id ?? `rep-${index}`} style={styles.rowBlock}>
          <PremiumInput label="Anrede" value={row.salutation} onChangeText={(v) => update(index, { salutation: v })} />
          <PremiumInput label="Vorname" value={row.firstName} onChangeText={(v) => update(index, { firstName: v })} />
          <PremiumInput label="Nachname" value={row.lastName} onChangeText={(v) => update(index, { lastName: v })} />
          <PremiumInput label="Position" value={row.position} onChangeText={(v) => update(index, { position: v })} />
          <PremiumInput label="E-Mail" value={row.email} onChangeText={(v) => update(index, { email: v })} keyboardType="email-address" autoCapitalize="none" />
          <PremiumInput label="Telefon" value={row.phone} onChangeText={(v) => update(index, { phone: v })} keyboardType="phone-pad" />
          <PremiumButton title="Entfernen" variant="ghost" size="sm" onPress={() => remove(index)} />
        </View>
      ))}
    </View>
  );
}

export function TenantBankAccountsForm({
  value,
  onChange,
}: {
  value: TenantBankAccount[];
  onChange: (next: TenantBankAccount[]) => void;
}) {
  const update = (index: number, patch: Partial<TenantBankAccount>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const add = () =>
    onChange([
      ...value,
      { label: '', accountHolder: '', bankName: '', iban: '', bic: '', isPrimary: value.length === 0, sortOrder: value.length },
    ]);
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <View style={styles.form}>
      <MultiRowHeader title="Bankverbindungen" onAdd={add} />
      {value.map((row, index) => (
        <View key={row.id ?? `bank-${index}`} style={styles.rowBlock}>
          <PremiumInput label="Bezeichnung" value={row.label} onChangeText={(v) => update(index, { label: v })} />
          <PremiumInput label="Kontoinhaber" value={row.accountHolder} onChangeText={(v) => update(index, { accountHolder: v })} />
          <PremiumInput label="Bank" value={row.bankName} onChangeText={(v) => update(index, { bankName: v })} />
          <PremiumInput label="IBAN" value={row.iban} onChangeText={(v) => update(index, { iban: v })} autoCapitalize="characters" />
          <PremiumInput label="BIC" value={row.bic} onChangeText={(v) => update(index, { bic: v })} autoCapitalize="characters" />
          <PremiumButton title="Entfernen" variant="ghost" size="sm" onPress={() => remove(index)} />
        </View>
      ))}
    </View>
  );
}

export function TenantModuleSettingsForm({
  value,
  onChange,
}: {
  value: TenantModuleSettings;
  onChange: (next: TenantModuleSettings) => void;
}) {
  const text = useAuroraAdaptiveText();
  const toggle = (key: keyof TenantModuleSettings) => onChange({ ...value, [key]: !value[key] });
  const rows: Array<{ key: keyof TenantModuleSettings; label: string }> = [
    { key: 'assistEnabled', label: 'Assist / Alltagsbegleitung' },
    { key: 'pflegeEnabled', label: 'Pflege ambulant' },
    { key: 'stationaerEnabled', label: 'Stationär' },
    { key: 'beratungEnabled', label: 'Beratung' },
  ];
  return (
    <View style={styles.form}>
      {rows.map((row) => (
        <View key={row.key} style={styles.moduleRow}>
          <Text style={{ color: text.primary, flex: 1 }}>{row.label}</Text>
          <PremiumButton
            title={value[row.key] ? 'Aktiv' : 'Inaktiv'}
            variant={value[row.key] ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => toggle(row.key)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowBlock: { gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
