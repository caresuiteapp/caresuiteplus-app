import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppGlassModal } from '@/components/layout/platform/AppGlassModal';
import { DetailInfoRow } from '@/components/detail';
import { PremiumButton, PremiumCard, PremiumInput, SectionPanel } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { createClientContact, deleteClientContact } from '@/lib/clients/clientContactsService';
import { formatContactPersonName } from '@/lib/clients/clientContactGroups';
import {
  buildMedicalContactInput,
  listMedicalContacts,
  medicalContactCategoryLabel,
  MEDICAL_CONTACT_CATEGORY_OPTIONS,
  storedMedicalContactChannels,
  type MedicalContactCategory,
} from '@/lib/clients/clientMedicalContacts.web';
import type { ClientFullDetail } from '@/types/modules/client';
import { colors, spacing, typography } from '@/theme';

type Props = { client: ClientFullDetail; onRefresh: () => void | Promise<void> };

export function ClientRecordMedicalContactsPanel({ client, onRefresh }: Props) {
  const tenantId = useServiceTenantId();
  const { can, roleKey } = usePermissions();
  const canManage = can('office.clients.manage_contacts');
  const contacts = listMedicalContacts(client.contacts);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<MedicalContactCategory>('general_practice');
  const [name, setName] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCategory('general_practice');
    setName('');
    setResponsibility('');
    setPhone('');
    setEmail('');
    setError(null);
  }

  async function save() {
    if (!tenantId || !canManage) return;
    const prepared = buildMedicalContactInput({ category, name, responsibility, phone, email });
    if (!prepared.ok) {
      setError(prepared.error);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createClientContact(tenantId, client.id, prepared.input, roleKey);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    reset();
    await onRefresh();
  }

  async function remove(contactId: string) {
    if (!tenantId || !canManage) return;
    const result = await deleteClientContact(tenantId, client.id, contactId, roleKey);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await onRefresh();
  }

  return <>
    <SectionPanel
      title="Ärztliche und weitere Versorgungskontakte"
      subtitle="Kategorie, Zuständigkeit und gespeicherte Kontaktwege bleiben getrennt"
    >
      <View style={styles.list}>
        {contacts.length === 0 ? <Text style={styles.empty}>Keine Versorgungskontakte hinterlegt.</Text> : contacts.map(contact => {
          const channels = storedMedicalContactChannels(contact);
          return <PremiumCard key={contact.id} style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>{formatContactPersonName(contact) ?? 'Kontakt'}</Text>
              {canManage ? <Pressable accessibilityRole="button" accessibilityLabel="Versorgungskontakt entfernen" onPress={() => remove(contact.id)}>
                <Text style={styles.delete}>Entfernen</Text>
              </Pressable> : null}
            </View>
            <DetailInfoRow label="Kategorie" value={medicalContactCategoryLabel(contact)} />
            <DetailInfoRow label="Zuständigkeit" value={contact.notes} />
            {channels.map(channel => <DetailInfoRow key={channel.kind} label={channel.label} value={channel.value} />)}
            <DetailInfoRow label="Sicherer Kontaktweg" value="Nicht bestätigt" />
            <Text style={styles.hint}>Gespeicherte Telefon- oder E-Mail-Daten belegen weder Identität noch sichere Übertragung oder eine tatsächliche Kontaktaufnahme.</Text>
          </PremiumCard>;
        })}
        {canManage ? <PremiumButton title="Versorgungskontakt hinzufügen" variant="secondary" onPress={() => { reset(); setOpen(true); }} /> : null}
        {error && !open ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SectionPanel>
    <AppGlassModal
      visible={open}
      title="Versorgungskontakt hinzufügen"
      onClose={() => setOpen(false)}
      maxWidth={560}
      footerActions={[
        { title: 'Abbrechen', onPress: () => setOpen(false), variant: 'secondary' },
        { title: 'Speichern', onPress: save, loading: saving, variant: 'glass' },
      ]}
    >
      <Text style={styles.label}>Kategorie</Text>
      <View style={styles.categories}>
        {MEDICAL_CONTACT_CATEGORY_OPTIONS.map(option => <PremiumButton
          key={option.value}
          title={option.label}
          size="sm"
          variant={category === option.value ? 'primary' : 'secondary'}
          onPress={() => setCategory(option.value)}
        />)}
      </View>
      <PremiumInput label="Name oder Einrichtung" value={name} onChangeText={setName} />
      <PremiumInput label="Konkrete Zuständigkeit" value={responsibility} onChangeText={setResponsibility} multiline />
      <PremiumInput label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <PremiumInput label="E-Mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Text style={styles.hint}>Mindestens ein Kontaktweg ist erforderlich. Telefon und E-Mail werden nicht automatisch als sicher bestätigt.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppGlassModal>
  </>;
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: { gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.bodyStrong, flexShrink: 1 },
  empty: { ...typography.body, color: colors.textMuted },
  delete: { ...typography.caption, color: colors.error },
  label: { ...typography.caption, color: colors.textMuted },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  hint: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.error },
});
