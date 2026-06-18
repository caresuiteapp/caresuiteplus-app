import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { GradientModalHeader } from '@/components/layout/platform';
import { PremiumButton, PremiumCard, PremiumInput, SectionPanel } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { createClientContact, deleteClientContact } from '@/lib/clients/clientContactsService';
import {
  findContactByType,
  formatContactPersonName,
  listOtherContacts,
} from '@/lib/clients/clientContactGroups';
import { clientEditRoute } from '@/lib/navigation/clientRoutes';
import type { ClientFullDetail } from '@/types/modules/client';
import {
  CLIENT_CONTACT_TYPE_LABELS,
  FIXED_CLIENT_CONTACT_TYPES,
  type ClientContactRecord,
} from '@/types/modules/client/clientContact';
import { colors, spacing, typography } from '@/theme';

type Props = {
  client: ClientFullDetail;
  onRefresh?: () => void;
};

function ContactCategorySection({
  title,
  contact,
  canEdit,
  onEdit,
}: {
  title: string;
  contact: ClientContactRecord | null;
  canEdit: boolean;
  onEdit?: () => void;
}) {
  const displayName = formatContactPersonName(contact);

  return (
    <SectionPanel title={title}>
      <View style={styles.sectionHeader}>
        {canEdit && onEdit ? (
          <PremiumButton title="Bearbeiten" size="sm" variant="ghost" onPress={onEdit} />
        ) : null}
      </View>
      {!contact || (!displayName && !contact.phone && !contact.email) ? (
        <Text style={styles.empty}>Nicht hinterlegt</Text>
      ) : (
        <PremiumCard style={styles.card}>
          <Text style={styles.cardTitle}>{displayName ?? '—'}</Text>
          <DetailInfoRow label="Telefon" value={contact.phone} />
          <DetailInfoRow label="E-Mail" value={contact.email} />
          {contact.notes ? <DetailInfoRow label="Hinweis" value={contact.notes} /> : null}
          {contact.relationshipLabel && contact.contactType === 'other' ? (
            <DetailInfoRow label="Beziehung" value={contact.relationshipLabel} />
          ) : null}
        </PremiumCard>
      )}
    </SectionPanel>
  );
}

export function ClientRecordContactsPanel({ client, onRefresh }: Props) {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { can } = usePermissions();
  const canEdit = can('office.clients.edit');
  const canManageContacts = can('office.clients.manage_contacts') || canEdit;

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const otherContacts = listOtherContacts(client.contacts);

  const openEditWizard = () => {
    router.push(clientEditRoute(client.id, 1) as never);
  };

  const resetModal = () => {
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setSaveError(null);
  };

  const handleAddOther = async () => {
    if (!tenantId || !name.trim()) {
      setSaveError('Bitte einen Namen angeben.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const parts = name.trim().split(/\s+/);
    const result = await createClientContact(tenantId, client.id, {
      firstName: parts[0] ?? name.trim(),
      lastName: parts.slice(1).join(' '),
      contactType: 'other',
      relationship: 'sonstige',
      relationshipLabel: notes.trim() || 'Sonstige',
      phone: phone.trim() || null,
      email: email.trim() || null,
      isEmergency: false,
      isPortalUser: false,
      portalPermissions: {
        canViewAppointments: false,
        canViewDocuments: false,
        canViewCarePlan: false,
        canSendMessages: false,
        canViewBilling: false,
      },
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setModalOpen(false);
    resetModal();
    onRefresh?.();
  };

  const handleDeleteOther = async (contactId: string) => {
    if (!tenantId) return;
    const result = await deleteClientContact(tenantId, client.id, contactId);
    if (result.ok) onRefresh?.();
  };

  return (
    <View style={styles.panel}>
      <SectionPanel title="Erreichbarkeit" subtitle="Klient:in direkt">
        <DetailInfoRow label="Telefon" value={client.phone} />
        <DetailInfoRow label="E-Mail" value={client.email} />
      </SectionPanel>

      {FIXED_CLIENT_CONTACT_TYPES.map((type) => (
        <ContactCategorySection
          key={type}
          title={CLIENT_CONTACT_TYPE_LABELS[type]}
          contact={findContactByType(client.contacts, type)}
          canEdit={canEdit}
          onEdit={openEditWizard}
        />
      ))}

      <SectionPanel title="Sonstige Kontakte">
        {otherContacts.length === 0 ? (
          <Text style={styles.empty}>Keine sonstigen Kontakte hinterlegt.</Text>
        ) : (
          otherContacts.map((c) => (
            <PremiumCard key={c.id} style={styles.card}>
              <View style={styles.otherHeader}>
                <Text style={styles.cardTitle}>
                  {formatContactPersonName(c) ?? 'Kontakt'}
                </Text>
                {canManageContacts ? (
                  <Pressable onPress={() => handleDeleteOther(c.id)}>
                    <Text style={styles.deleteLink}>Entfernen</Text>
                  </Pressable>
                ) : null}
              </View>
              <DetailInfoRow label="Telefon" value={c.phone} />
              <DetailInfoRow label="E-Mail" value={c.email} />
              {c.notes ? <DetailInfoRow label="Hinweis" value={c.notes} /> : null}
              {c.relationshipLabel ? <DetailInfoRow label="Beziehung" value={c.relationshipLabel} /> : null}
            </PremiumCard>
          ))
        )}
        {canManageContacts ? (
          <PremiumButton
            title="Sonstigen Kontakt hinzufügen"
            variant="secondary"
            onPress={() => {
              resetModal();
              setModalOpen(true);
            }}
          />
        ) : null}
      </SectionPanel>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <GradientModalHeader
              title="Sonstigen Kontakt hinzufügen"
              onClose={() => setModalOpen(false)}
            />
            <View style={styles.modalBody}>
              <PremiumInput label="Name" value={name} onChangeText={setName} />
              <PremiumInput label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <PremiumInput label="E-Mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <PremiumInput label="Hinweis / Beziehung" value={notes} onChangeText={setNotes} multiline />
              {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
              <View style={styles.modalActions}>
                <PremiumButton title="Abbrechen" variant="ghost" onPress={() => setModalOpen(false)} />
                <PremiumButton title="Speichern" onPress={handleAddOther} loading={saving} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.xs },
  card: { marginBottom: spacing.sm },
  cardTitle: { ...typography.bodyStrong, marginBottom: spacing.xs },
  empty: { ...typography.body, color: colors.textMuted },
  otherHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteLink: { ...typography.caption, color: colors.error },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: { ...typography.h3, marginBottom: spacing.xs },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  error: { ...typography.caption, color: colors.error },
});
