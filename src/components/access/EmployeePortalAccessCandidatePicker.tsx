import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { InfoBanner, PremiumBadge, PremiumInput, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { fetchEmployeePortalAccessCandidates } from '@/lib/access/employeePortalAccessCandidateService';
import type { RoleKey } from '@/types';
import type { EmployeePortalAccessCandidate } from '@/types/modules/employeePortalAccess';
import { radius, spacing, typography } from '@/theme';

type EmployeePortalAccessCandidatePickerProps = {
  tenantId: string;
  actorRoleKey?: RoleKey | null;
  selectedId: string | null;
  onSelect: (candidate: EmployeePortalAccessCandidate | null) => void;
  errorMessage?: string | null;
};

function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function EmployeePortalAccessCandidatePicker({
  tenantId,
  actorRoleKey,
  selectedId,
  onSelect,
  errorMessage,
}: EmployeePortalAccessCandidatePickerProps) {
  const text = useAuroraAdaptiveText();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [rows, setRows] = useState<EmployeePortalAccessCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchEmployeePortalAccessCandidates(tenantId, actorRoleKey ?? undefined, debouncedSearch).then(
      (result) => {
        if (cancelled) return;
        setLoading(false);
        if (!result.ok) {
          setLoadError(result.error);
          setRows([]);
          return;
        }
        setLoadError(null);
        setRows(result.data);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tenantId, actorRoleKey, debouncedSearch]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          padding: spacing.sm,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: text.border,
          marginBottom: spacing.xs,
          gap: spacing.xs,
        },
        rowActive: { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.08)' },
        title: { ...typography.body, fontWeight: '600', color: text.primary },
        meta: { ...typography.caption, color: text.muted },
        badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        list: { maxHeight: 360 },
      }),
    [text],
  );

  return (
    <SectionPanel
      title="Mitarbeitende ohne Portalzugang"
      subtitle="Personalnummer auswählen — nur Mitarbeitende ohne bestehenden Zugang"
    >
      <PremiumInput
        value={search}
        onChangeText={setSearch}
        placeholder="Nach Name oder Personalnummer suchen…"
        accessibilityLabel="Mitarbeitende suchen"
      />
      {errorMessage ? <InfoBanner variant="danger" message={errorMessage} /> : null}
      {loadError ? <InfoBanner variant="warning" message={loadError} /> : null}
      {loading ? <Text style={styles.meta}>Mitarbeitende werden geladen…</Text> : null}
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(item) => item.id}
        nestedScrollEnabled
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.meta}>
              {debouncedSearch.trim()
                ? 'Keine passenden Mitarbeitenden ohne Portalzugang gefunden.'
                : 'Alle Mitarbeitenden haben bereits einen Portalzugang.'}
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const active = selectedId === item.id;
          return (
            <Pressable
              style={[styles.row, active ? styles.rowActive : null]}
              onPress={() => onSelect(active ? null : item)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.badgeRow}>
                <PremiumBadge
                  label={item.employeeNumber ?? 'Ohne Personalnummer'}
                  variant={item.employeeNumber ? 'cyan' : 'muted'}
                />
                {active ? <PremiumBadge label="Ausgewählt" variant="green" /> : null}
              </View>
              <Text style={styles.title}>{item.fullName}</Text>
              <Text style={styles.meta}>
                {[item.jobTitle, item.email].filter(Boolean).join(' · ') || 'Keine weiteren Angaben'}
              </Text>
            </Pressable>
          );
        }}
      />
    </SectionPanel>
  );
}
