import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PremiumInput } from '@/components/ui/PremiumInput';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { colors, radius, spacing, typography } from '@/theme';
import { SYSTEM_LIQUID_COLORS } from '@/design/tokens/systemLiquidGlass';

export type CareEntityOption = {
  value: string;
  label: string;
  description?: string;
};

type Props = {
  label: string;
  value: string;
  options: CareEntityOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  error?: string | null;
  required?: boolean;
  loading?: boolean;
};

/**
 * Strukturierte Auswahl für Personen, Stammdaten und andere Systemobjekte.
 * Die Suche filtert nur vorhandene Datensätze und wird niemals gespeichert.
 */
export function CareEntitySelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Bitte auswählen',
  searchPlaceholder = 'Vorhandene Einträge durchsuchen…',
  emptyMessage = 'Keine passenden Einträge vorhanden.',
  error,
  required = false,
  loading = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const text = useAuroraAdaptiveText();
  const { isLight } = useLegacyTheme();
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('de-DE');
    if (!needle) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ''}`.toLocaleLowerCase('de-DE').includes(needle),
    );
  }, [options, search]);

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: text.primary }]}>
        {label}{required ? ' *' : ''}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          isLight ? styles.triggerLight : styles.triggerDark,
          error ? styles.triggerError : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={styles.triggerCopy}>
          <Text style={[styles.triggerText, { color: selected ? text.primary : text.muted }]} numberOfLines={1}>
            {loading ? 'Einträge werden geladen…' : (selected?.label ?? placeholder)}
          </Text>
          {selected?.description ? (
            <Text style={[styles.description, { color: text.muted }]} numberOfLines={1}>
              {selected.description}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.chevron, { color: text.primary }]}>▾</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable
            style={[styles.sheet, isLight ? styles.sheetLight : styles.sheetDark]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeading}>
                <Text style={[styles.sheetTitle, { color: text.primary }]}>{label}</Text>
                <Text style={[styles.sheetHint, { color: text.muted }]}>Nur vorhandene Systemeinträge</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Auswahl schließen" onPress={close} style={styles.closeButton}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            {options.length > 7 ? (
              <PremiumInput
                viewContext="form"
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder}
                accessibilityLabel={`${label} durchsuchen`}
              />
            ) : null}
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={[styles.empty, { color: text.muted }]}>{emptyMessage}</Text>
              ) : (
                filtered.map((option) => {
                  const active = option.value === value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        onChange(option.value);
                        close();
                      }}
                      style={[styles.option, active ? styles.optionActive : null]}
                    >
                      <View style={styles.optionCopy}>
                        <Text style={[styles.optionLabel, { color: text.primary }]}>{option.label}</Text>
                        {option.description ? (
                          <Text style={[styles.optionDescription, { color: text.muted }]}>{option.description}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.check}>{active ? '✓' : '›'}</Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, marginBottom: spacing.sm },
  label: { ...typography.label },
  trigger: {
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  triggerLight: { backgroundColor: 'rgba(246,249,255,0.88)', borderColor: '#BFD4FF' },
  triggerDark: { backgroundColor: colors.bgInput, borderColor: colors.borderSoft },
  triggerError: { borderColor: colors.error },
  pressed: { opacity: 0.78 },
  triggerCopy: { flex: 1, gap: 2 },
  triggerText: { fontSize: 16, fontWeight: '600' },
  description: { ...typography.caption },
  chevron: { fontSize: 18, fontWeight: '700' },
  error: { ...typography.caption, color: colors.error },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '82%',
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetLight: { backgroundColor: '#F8FAFF', borderColor: '#C9D8FA' },
  sheetDark: { backgroundColor: colors.bgSurface, borderColor: colors.borderSoft },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sheetHeading: { flex: 1, gap: 2 },
  sheetTitle: { ...typography.h3 },
  sheetHint: { ...typography.caption },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.12)',
  },
  closeText: { color: SYSTEM_LIQUID_COLORS.electricBlue, fontSize: 26, lineHeight: 28 },
  list: { maxHeight: 440 },
  option: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionActive: { backgroundColor: 'rgba(139,92,246,0.12)', borderRadius: radius.md },
  optionCopy: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 16, fontWeight: '700' },
  optionDescription: { ...typography.caption },
  check: { color: SYSTEM_LIQUID_COLORS.electricBlue, fontSize: 20, fontWeight: '800' },
  empty: { paddingVertical: spacing.xl, textAlign: 'center' },
});
