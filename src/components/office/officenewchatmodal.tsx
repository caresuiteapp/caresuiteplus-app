import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { PremiumInput } from '@/components/ui';
import { fetchClientList, fetchEmployeeList } from '@/lib/office';
import { listInternalUsers } from '@/lib/auth/accessManagementService';
import { createOfficeMessageThread } from '@/lib/office/messageservice';
import { fetchOfficeMessageCategories } from '@/lib/office/messagethreadservice';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { spacing, radius } from '@/theme';
import type {
  OfficeMessageCategory,
  OfficeThreadType,
} from '@/types/office/messaging';

export type NewChatMode = 'client' | 'employee' | 'internal';

type OfficeNewChatModalProps = {
  visible: boolean;
  mode: NewChatMode;
  onClose: () => void;
  onCreated: (threadId: string) => void;
};

const MODE_TITLES: Record<NewChatMode, string> = {
  client: 'Neuer Klient:innen-Chat',
  employee: 'Neuer Mitarbeitenden-Chat',
  internal: 'Neuer interner Chat',
};

const MODE_THREAD_TYPE: Record<NewChatMode, OfficeThreadType> = {
  client: 'client_office',
  employee: 'employee_office',
  internal: 'internal',
};

const MODE_AUDIENCE: Record<NewChatMode, OfficeMessageCategory['audience']> = {
  client: 'client',
  employee: 'employee',
  internal: 'internal',
};

type PickerItem = { id: string; label: string; subtitle?: string };

export function OfficeNewChatModal({
  visible,
  mode,
  onClose,
  onCreated,
}: OfficeNewChatModalProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [subject, setSubject] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<OfficeMessageCategory[]>([]);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { gap: spacing.sm },
        label: { ...typography.caption, color: c.muted, textTransform: 'uppercase' },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        chip: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.capsule,
          borderWidth: 1,
          borderColor: c.border,
        },
        chipActive: { backgroundColor: `${c.violet}22`, borderColor: c.violet },
        chipText: { ...typography.caption, color: c.muted },
        chipTextActive: { color: c.violet, fontWeight: '700' },
        row: {
          padding: spacing.sm,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.border,
          gap: 2,
        },
        rowActive: { borderColor: c.violet, backgroundColor: `${c.violet}11` },
        rowTitle: { ...typography.body, color: c.text, fontWeight: '600' },
        rowSubtitle: { ...typography.caption, color: c.muted },
        error: { ...typography.caption, color: c.danger },
        list: { maxHeight: 220 },
      }),
    [c, typography],
  );

  const reset = useCallback(() => {
    setSubject('');
    setInitialMessage('');
    setSearch('');
    setSelectedId(null);
    setSelectedLabel(null);
    setSelectedParticipantIds([]);
    setCategoryId(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!visible || !tenantId) return;
    reset();
    setLoading(true);
    void (async () => {
      const categoriesResult = await fetchOfficeMessageCategories(tenantId, profile?.roleKey);
      if (categoriesResult.ok) {
        const filtered = categoriesResult.data.filter(
          (category) => category.audience === MODE_AUDIENCE[mode] || category.audience === 'all',
        );
        setCategories(filtered);
        setCategoryId(filtered[0]?.id ?? null);
      }

      if (mode === 'client') {
        const result = await fetchClientList(tenantId, profile?.roleKey);
        if (result.ok) {
          setItems(
            result.data.map((client) => ({
              id: client.id,
              label: `${client.firstName} ${client.lastName}`.trim(),
              subtitle: client.city ?? undefined,
            })),
          );
        }
      } else if (mode === 'employee') {
        const result = await fetchEmployeeList(tenantId, profile?.roleKey);
        if (result.ok) {
          setItems(
            result.data.map((employee) => ({
              id: employee.id,
              label: `${employee.firstName} ${employee.lastName}`.trim(),
              subtitle: employee.jobTitle ?? undefined,
            })),
          );
        }
      } else {
        const users = listInternalUsers(tenantId);
        setItems(
          users.map((user) => ({
            id: user.id,
            label: user.displayName,
            subtitle: user.roleKey,
          })),
        );
      }
      setLoading(false);
    })();
  }, [visible, tenantId, mode, profile?.roleKey, reset]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(term) ||
        (item.subtitle ?? '').toLowerCase().includes(term),
    );
  }, [items, search]);

  const toggleParticipant = (id: string, label: string) => {
    if (mode !== 'internal') {
      setSelectedId(id);
      setSelectedLabel(label);
      return;
    }
    setSelectedParticipantIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      return [...current, id];
    });
    setSelectedLabel(label);
  };

  const handleCreate = async () => {
    if (!tenantId || !categoryId) return;
    if (!subject.trim()) {
      setError('Bitte einen Betreff eingeben.');
      return;
    }
    if (mode !== 'internal' && !selectedId) {
      setError('Bitte eine:n Empfänger:in auswählen.');
      return;
    }
    if (mode === 'internal' && selectedParticipantIds.length === 0) {
      setError('Bitte mindestens eine:n Büro-Teilnehmer:in auswählen.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await createOfficeMessageThread(
      tenantId,
      {
        threadType: MODE_THREAD_TYPE[mode],
        categoryId,
        subject: subject.trim(),
        clientId: mode === 'client' ? selectedId : null,
        employeeId: mode === 'employee' ? selectedId : null,
        participantProfileIds: mode === 'internal' ? selectedParticipantIds : undefined,
        initialMessage: initialMessage.trim() || undefined,
      },
      profile?.roleKey,
      profile?.id,
      {
        clientName: mode === 'client' ? selectedLabel : null,
        employeeName: mode === 'employee' ? selectedLabel : null,
      },
    );
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.data.id);
    onClose();
  };

  return (
    <PlatformModal
      visible={visible}
      title={MODE_TITLES[mode]}
      onClose={onClose}
      footerActions={[
        { title: 'Abbrechen', onPress: onClose, variant: 'secondary' },
        {
          title: 'Chat erstellen',
          onPress: handleCreate,
          loading: submitting,
          disabled: loading,
        },
      ]}
      maxWidth={640}
    >
      <View style={styles.section}>
        <Text style={styles.label}>Kategorie</Text>
        <View style={styles.chips}>
          {categories.map((category) => {
            const active = category.id === categoryId;
            return (
              <Pressable
                key={category.id}
                onPress={() => setCategoryId(category.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <PremiumInput label="Betreff *" value={subject} onChangeText={setSubject} />
      <PremiumInput
        label="Erste Nachricht (optional)"
        value={initialMessage}
        onChangeText={setInitialMessage}
        multiline
      />

      <View style={styles.section}>
        <Text style={styles.label}>
          {mode === 'internal' ? 'Teilnehmer:innen' : 'Empfänger:in'}
        </Text>
        <PremiumInput value={search} onChangeText={setSearch} placeholder="Suchen…" />
        <FlatList
          style={styles.list}
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const active =
              mode === 'internal'
                ? selectedParticipantIds.includes(item.id)
                : selectedId === item.id;
            return (
              <Pressable
                onPress={() => toggleParticipant(item.id, item.label)}
                style={[styles.row, active && styles.rowActive]}
              >
                <Text style={styles.rowTitle}>{item.label}</Text>
                {item.subtitle ? <Text style={styles.rowSubtitle}>{item.subtitle}</Text> : null}
              </Pressable>
            );
          }}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </PlatformModal>
  );
}
