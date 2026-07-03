import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { PremiumInput } from '@/components/ui';
import { fetchEmployeeList } from '@/lib/office';
import { createEmployeeGroupChat } from '@/lib/office/employeeGroupChatService';
import { resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import { fetchOfficeMessageCategories } from '@/lib/office/messagethreadservice';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { spacing, radius } from '@/theme';
import type { OfficeMessageCategory } from '@/types/office/messaging';

type OfficeNewGroupChatModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (threadId: string) => void;
};

type PickerItem = { id: string; label: string; subtitle?: string };

export function OfficeNewGroupChatModal({
  visible,
  onClose,
  onCreated,
}: OfficeNewGroupChatModalProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [subject, setSubject] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
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
        hint: { ...typography.caption, color: c.muted },
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
        selectionSummary: {
          ...typography.caption,
          color: c.violet,
          fontWeight: '600',
        },
      }),
    [c, typography],
  );

  const reset = useCallback(() => {
    setSubject('');
    setInitialMessage('');
    setSearch('');
    setSelectedEmployeeIds([]);
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
          (category) => category.audience === 'employee' || category.audience === 'all',
        );
        setCategories(filtered);
        setCategoryId(filtered[0]?.id ?? null);
      }

      const result = await fetchEmployeeList(tenantId, profile?.roleKey);
      if (result.ok) {
        setItems(
          result.data.map((employee) => ({
            id: employee.id,
            label: `${employee.firstName} ${employee.lastName}`.trim(),
            subtitle: employee.jobTitle ? resolveEmployeeRoleLabel(employee.jobTitle) : undefined,
          })),
        );
      }
      setLoading(false);
    })();
  }, [visible, tenantId, profile?.roleKey, reset]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(term) ||
        (item.subtitle ?? '').toLowerCase().includes(term),
    );
  }, [items, search]);

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      return [...current, id];
    });
  };

  const handleCreate = async () => {
    if (!tenantId || !categoryId) return;
    if (!subject.trim()) {
      setError('Bitte einen Gruppennamen eingeben.');
      return;
    }
    if (selectedEmployeeIds.length < 2) {
      setError('Bitte mindestens zwei Mitarbeitende auswählen.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await createEmployeeGroupChat(
      tenantId,
      {
        subject: subject.trim(),
        categoryId,
        employeeIds: selectedEmployeeIds,
        initialMessage: initialMessage.trim() || undefined,
      },
      profile?.roleKey,
      profile?.id,
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
      title="Neuer Gruppen-Chat"
      onClose={onClose}
      footerActions={[
        { title: 'Abbrechen', onPress: onClose, variant: 'secondary' },
        {
          title: 'Gruppen-Chat erstellen',
          onPress: handleCreate,
          loading: submitting,
          disabled: loading,
        },
      ]}
      maxWidth={640}
    >
      <Text style={styles.hint}>
        Erstellen Sie einen Chat mit mehreren Mitarbeitenden — z. B. Team Nord oder Schichtplanung.
      </Text>

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

      <PremiumInput label="Gruppenname *" value={subject} onChangeText={setSubject} />
      <PremiumInput
        label="Erste Nachricht (optional)"
        value={initialMessage}
        onChangeText={setInitialMessage}
        multiline
      />

      <View style={styles.section}>
        <Text style={styles.label}>Mitarbeitende *</Text>
        {selectedEmployeeIds.length > 0 ? (
          <Text style={styles.selectionSummary}>
            {selectedEmployeeIds.length} ausgewählt
          </Text>
        ) : null}
        <PremiumInput value={search} onChangeText={setSearch} placeholder="Suchen…" />
        <FlatList
          style={styles.list}
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const active = selectedEmployeeIds.includes(item.id);
            return (
              <Pressable
                onPress={() => toggleEmployee(item.id)}
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
