import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COMPANY_CONTACT_FUNCTIONS, resolveCompanyContactFunction } from '@/lib/catalogs/companyContactFunctionCatalog';
import {
  COMPANY_REGISTRATION_CATALOG,
  resolveCompanyCatalogChoice,
  type CompanyCatalogKind,
} from '@/lib/catalogs/companyRegistrationCatalog';
import { liquidColors, liquidRadius } from '../foundation/tokens';

type Props = {
  kind: CompanyCatalogKind | 'contact_function';
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showError?: boolean;
};

/** Native catalog picker; custom entries retain the shared explicit Sonstige value. */
export function CompanyRegistrationSelect({ kind, label, value, onChange, disabled = false, showError = false }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
  const choices = kind === 'contact_function' ? COMPANY_CONTACT_FUNCTIONS : COMPANY_REGISTRATION_CATALOG[kind];
  const choice = kind === 'contact_function' ? resolveCompanyContactFunction(value) : resolveCompanyCatalogChoice(kind, value);
  const other = choice?.key === 'sonstige';
  const detail = other && /^sonstige:/i.test(value) ? value.replace(/^sonstige:\s?/i, '') : '';
  const invalid = showError && (!choice || (other && (detail.trim().length < 2 || detail.trim().length > 180)));
  const hint = !choice && value.trim()
    ? `Bisherige Angabe: ${value}. Bitte ordnen Sie diese einer Vorgabe zu oder wählen Sie „Sonstige“.`
    : kind === 'legal_form'
      ? 'Wählen Sie die Rechtsform, unter der Ihr Unternehmen geführt wird.'
      : kind === 'industry'
        ? 'Wählen Sie den hauptsächlichen Leistungsbereich Ihrer Einrichtung.'
        : 'Wählen Sie die Funktion der Ansprechperson im Unternehmen.';
  const otherLabel = kind === 'legal_form' ? 'Andere Rechtsform angeben' : kind === 'industry' ? 'Anderen Einrichtungstyp angeben' : 'Andere Funktion angeben';
  const needle = search.trim().toLocaleLowerCase('de-DE');
  const filtered = choices.filter(row => !needle || [row.label, row.optionLabel ?? '', ...row.aliases].join(' ').toLocaleLowerCase('de-DE').includes(needle));

  const close = () => { setOpen(false); setSearch(''); };
  useEffect(() => { if (disabled) { setOpen(false); setSearch(''); } }, [disabled]);

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label} <Text style={styles.required}>*</Text></Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${choice?.label ?? 'Bitte auswählen'}`}
        accessibilityHint={hint}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => { if (!disabled) setOpen(true); }}
        style={[styles.control, styles.trigger, invalid && styles.invalid, disabled && styles.disabled]}
      >
        <Text style={styles.value}>{choice?.label ?? 'Bitte auswählen …'}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      {other ? (
        <View style={styles.root}>
          <Text style={styles.label}>{otherLabel} <Text style={styles.required}>*</Text></Text>
          <TextInput
            accessibilityLabel={otherLabel}
            accessibilityHint="Bitte mit 2 bis 180 Zeichen genauer beschreiben."
            value={detail}
            maxLength={180}
            editable={!disabled}
            placeholder="Bitte genauer beschreiben"
            placeholderTextColor={liquidColors.white56}
            onChangeText={text => { if (!disabled) onChange(`Sonstige: ${text}`); }}
            style={[styles.control, invalid && styles.invalid, disabled && styles.disabled]}
          />
        </View>
      ) : null}
      <Text style={styles.hint}>{hint}</Text>
      {invalid ? <Text accessibilityRole="alert" style={styles.error}>{other ? 'Bitte „Sonstige“ mit 2 bis 180 Zeichen genauer beschreiben.' : 'Bitte eine Vorgabe auswählen.'}</Text> : null}
      <Modal visible={open && !disabled} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.backdrop, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>{label}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Auswahl schließen" onPress={close} style={styles.close}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <TextInput accessibilityLabel={`${label} durchsuchen`} value={search} onChangeText={setSearch} placeholder="Vorgaben durchsuchen …" placeholderTextColor={liquidColors.white56} style={styles.control} autoCorrect={false} />
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {filtered.length ? filtered.map(row => (
                <Pressable
                  key={row.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: row.key === choice?.key }}
                  onPress={() => { if (!disabled) { onChange(row.key === 'sonstige' ? 'Sonstige: ' : row.label); close(); } }}
                  style={[styles.option, row.key === choice?.key && styles.selected]}
                >
                  <Text style={styles.value}>{row.label}</Text>
                </Pressable>
              )) : <Text style={styles.hint}>Keine passenden Vorgaben gefunden.</Text>}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', minWidth: 0, gap: 8 },
  label: { color: liquidColors.white, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  required: { color: liquidColors.blue500 },
  control: { minHeight: 50, width: '100%', borderWidth: 1, borderColor: '#C8D5E5', borderRadius: liquidRadius.control, paddingHorizontal: 14, paddingVertical: 12, color: liquidColors.white, backgroundColor: '#FFFFFF', fontSize: 16, lineHeight: 24 },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { color: liquidColors.white, fontSize: 16, lineHeight: 24, flexShrink: 1 },
  chevron: { marginLeft: 'auto', color: liquidColors.blue500, fontSize: 20 },
  hint: { color: '#48627D', fontSize: 14, lineHeight: 21 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 21 },
  invalid: { borderColor: '#B42318' },
  disabled: { opacity: 0.65 },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, backgroundColor: 'rgba(0,7,20,0.65)' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '90%', minHeight: 0, borderRadius: liquidRadius.card, backgroundColor: '#FFFFFF', padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, color: liquidColors.white, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  close: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: liquidColors.white, fontSize: 28 },
  list: { flexShrink: 1 },
  option: { paddingHorizontal: 12, paddingVertical: 14, minHeight: 48, borderRadius: liquidRadius.control },
  selected: { backgroundColor: '#EAF3FF' },
});
