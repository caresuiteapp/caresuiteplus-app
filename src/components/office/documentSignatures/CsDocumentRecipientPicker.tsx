import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumInput, SectionPanel, InfoBanner } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography, radius } from '@/theme';
import type { RoleKey } from '@/types';
import type {
  CsDocumentClientRecipient,
  CsDocumentEmployeeRecipient,
} from '@/types/documents/csDocumentRecipients';
import {
  searchCsDocumentClientRecipients,
  searchCsDocumentEmployeeRecipients,
} from '@/lib/documents/csTemplates/csDocumentRecipientSearchService';

type EmployeePickerProps = {
  tenantId: string;
  actorRoleKey?: RoleKey | null;
  selectedId: string | null;
  onSelect: (recipient: CsDocumentEmployeeRecipient | null) => void;
  errorMessage?: string | null;
};

type ClientPickerProps = {
  tenantId: string;
  actorRoleKey?: RoleKey | null;
  selectedId: string | null;
  onSelect: (recipient: CsDocumentClientRecipient | null) => void;
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

export function CsDocumentEmployeeRecipientPicker({
  tenantId,
  actorRoleKey,
  selectedId,
  onSelect,
  errorMessage,
}: EmployeePickerProps) {
  const text = useAuroraAdaptiveText();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [rows, setRows] = useState<CsDocumentEmployeeRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void searchCsDocumentEmployeeRecipients(tenantId, actorRoleKey ?? undefined, debouncedSearch).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.error);
        setRows([]);
        return;
      }
      setLoadError(null);
      setRows(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, actorRoleKey, debouncedSearch]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        label: { ...typography.caption, color: text.muted, marginBottom: spacing.xs },
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
        list: { maxHeight: 280 },
      }),
    [text],
  );

  return (
    <SectionPanel title="Mitarbeitende auswählen" subtitle="Suche nach Name, E-Mail oder Rolle">
      <PremiumInput
        value={search}
        onChangeText={setSearch}
        placeholder="Mitarbeitende suchen…"
        accessibilityLabel="Mitarbeitende suchen"
      />
      {errorMessage ? <InfoBanner variant="danger" message={errorMessage} /> : null}
      {loadError ? <InfoBanner variant="warning" message={loadError} /> : null}
      {loading ? <Text style={styles.meta}>Suche läuft…</Text> : null}
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(item) => item.id}
        nestedScrollEnabled
        ListEmptyComponent={
          !loading ? <Text style={styles.meta}>Keine Mitarbeitenden gefunden.</Text> : null
        }
        renderItem={({ item }) => {
          const active = selectedId === item.id;
          return (
            <Pressable
              style={[styles.row, active ? styles.rowActive : null]}
              onPress={() => onSelect(active ? null : item)}
              testID={`cs-employee-recipient-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Mitarbeitende auswählen: ${item.fullName}`}
            >
              <Text style={styles.title}>{item.fullName}</Text>
              <Text style={styles.meta}>
                {[item.email, item.jobTitle].filter(Boolean).join(' · ') || 'Keine Kontaktdaten'}
              </Text>
              <View style={styles.badgeRow}>
                <PremiumBadge label={item.statusLabel} variant="muted" />
                <PremiumBadge
                  label={item.portalLabel}
                  variant={item.portalActive ? 'green' : 'orange'}
                />
              </View>
              {!item.portalActive ? (
                <InfoBanner
                  variant="warning"
                  message="Kein aktiver Mitarbeiterportal-Zugang — Dokument kann trotzdem gesendet werden."
                />
              ) : null}
              {item.lastLoginAt ? (
                <Text style={styles.meta}>
                  Letzter Login: {new Date(item.lastLoginAt).toLocaleString('de-DE')}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </SectionPanel>
  );
}

export function CsDocumentClientRecipientPicker({
  tenantId,
  actorRoleKey,
  selectedId,
  onSelect,
  errorMessage,
}: ClientPickerProps) {
  const text = useAuroraAdaptiveText();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [rows, setRows] = useState<CsDocumentClientRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void searchCsDocumentClientRecipients(tenantId, actorRoleKey ?? undefined, debouncedSearch).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.error);
        setRows([]);
        return;
      }
      setLoadError(null);
      setRows(result.data);
    });
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
        list: { maxHeight: 280 },
      }),
    [text],
  );

  return (
    <SectionPanel title="Klient:in auswählen" subtitle="Suche nach Name, Ort oder Kostenträger">
      <PremiumInput
        value={search}
        onChangeText={setSearch}
        placeholder="Klient:in suchen…"
        accessibilityLabel="Klient:in suchen"
      />
      {errorMessage ? <InfoBanner variant="danger" message={errorMessage} /> : null}
      {loadError ? <InfoBanner variant="warning" message={loadError} /> : null}
      {loading ? <Text style={styles.meta}>Suche läuft…</Text> : null}
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(item) => item.id}
        nestedScrollEnabled
        ListEmptyComponent={
          !loading ? <Text style={styles.meta}>Keine Klient:innen gefunden.</Text> : null
        }
        renderItem={({ item }) => {
          const active = selectedId === item.id;
          return (
            <Pressable
              style={[styles.row, active ? styles.rowActive : null]}
              onPress={() => onSelect(active ? null : item)}
            >
              <Text style={styles.title}>{item.fullName}</Text>
              <Text style={styles.meta}>
                {[item.locationLabel, item.careLevel, item.payorName].filter(Boolean).join(' · ')}
              </Text>
              {item.representativeName ? (
                <Text style={styles.meta}>Vertretung: {item.representativeName}</Text>
              ) : null}
              <View style={styles.badgeRow}>
                <PremiumBadge label={item.statusLabel} variant="muted" />
                <PremiumBadge
                  label={item.portalLabel}
                  variant={item.portalActive ? 'green' : 'orange'}
                />
              </View>
            </Pressable>
          );
        }}
      />
    </SectionPanel>
  );
}
