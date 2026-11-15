import { useMemo, useState, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PremiumInput } from '@/components/ui';
import { VitalMeasurementArtwork } from './VitalMeasurementArtwork';
import type { VitalReadingType } from '@/types/modules/pflege';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { vitalSearchText } from '@/lib/pflege/vitalCaptureOptions';
import type { VitalClient } from '@/lib/pflege/vitalDocumentationService';
import { typography } from '@/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export function VitalWorkspaceHero({ title, description, artwork = 'pulse', children }: {
  title: string;
  description?: string;
  artwork?: VitalReadingType;
  children?: ReactNode;
}) {
  const styles = useVitalStyles();
  return <LinearGradient colors={['#102846', '#123754', '#11566A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.72 }} style={styles.hero}>
    <View style={styles.heroContent}>
      <Text accessibilityRole="header" style={styles.heroTitle}>{title}</Text>
      {description ? <Text style={styles.heroDescription}>{description}</Text> : null}
      {children}
    </View>
    <View style={styles.heroArtwork}><VitalMeasurementArtwork kind={artwork} size={114} /></View>
  </LinearGradient>;
}

export function VitalAction({ title, icon, variant = 'primary', onPress, disabled, style }: {
  title: string;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'light';
  onPress(): void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const styles = useVitalStyles(), primary = variant === 'primary';
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
    onPress={onPress} style={({ pressed }) => [
      styles.action, primary ? styles.actionPrimary : variant === 'light' ? styles.actionLight : styles.actionSecondary,
      disabled && styles.disabled, pressed && styles.pressed, style,
    ]}>
    {icon ? <MaterialCommunityIcons name={icon} size={17} color={primary ? '#FFFFFF' : '#10476A'} /> : null}
    <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{title}</Text>
  </Pressable>;
}

export function VitalPills({ options, value, onChange, disabled, label, compact }: {
  options: readonly { key: string; label: string }[];
  value: string;
  onChange(key: string): void;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const styles = useVitalStyles();
  return <View accessibilityLabel={label} style={styles.pills}>
    {options.map(option => {
      const selected = value === option.key;
      return <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected, disabled }}
        accessibilityLabel={label ? `${label}: ${option.label}` : option.label} disabled={disabled}
        onPress={() => onChange(option.key)} style={({ pressed }) => [
          styles.pill, compact && styles.pillCompact, selected && styles.pillActive,
          disabled && styles.disabled, pressed && styles.pressed,
        ]}>
        <Text style={[styles.pillText, selected && styles.pillTextActive]}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

function personQualifier(person: VitalClient) {
  const birth = person.birthDate?.split('-').reverse().join('.');
  return [person.number, birth].filter(Boolean).join(' · ') || `Akten-ID …${person.id.slice(-8)}`;
}

export function VitalCasePicker({ people, selectedId, onSelect, disabled }: {
  people: readonly VitalClient[];
  selectedId: string;
  onSelect(id: string): void | Promise<void>;
  disabled?: boolean;
}) {
  const styles = useVitalStyles();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(8);
  const selected = people.find(person => person.id === selectedId);
  const names = useMemo(() => {
    const result = new Map<string, number>();
    for (const person of people) result.set(person.name, (result.get(person.name) ?? 0) + 1);
    return result;
  }, [people]);
  const words = vitalSearchText(search.trim()).split(/\s+/).filter(Boolean);
  const matching = people.filter(person => {
    const text = vitalSearchText(`${person.name} ${personQualifier(person)}`);
    return words.every(word => text.includes(word));
  });

  return <View style={styles.stack}>
    <Pressable accessibilityRole="button" accessibilityLabel={selected ? `Klient:in wechseln. ${selected.name}` : 'Klient:in auswählen'}
      accessibilityState={{ expanded: open && !disabled, disabled }}
      disabled={disabled} onPress={() => { setSearch(''); setLimit(8); setOpen(!open); }}
      style={({ pressed }) => [styles.caseButton, disabled && styles.disabled, pressed && styles.pressed]}>
      <View style={styles.caseIcon}><MaterialCommunityIcons name="account-outline" color="#13648A" size={20} /></View>
      <View style={styles.flex}>
        <Text style={styles.caseLabel}>{selected?.name ?? 'Klient:in auswählen'}</Text>
        {selected && (names.get(selected.name) ?? 0) > 1 ? <Text style={styles.muted}>{personQualifier(selected)}</Text> : null}
      </View>
      <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} color="#386480" size={19} />
    </Pressable>
    {open && !disabled ? <View style={styles.caseResults}>
      <PremiumInput label="Klient:innen suchen" placeholder="Name oder Aktennummer" value={search}
        autoCorrect={false} onChangeText={value => { setSearch(value); setLimit(8); }} />
      {matching.length ? matching.slice(0, limit).map(person => <Pressable key={person.id}
        accessibilityRole="button" accessibilityState={{ selected: person.id === selectedId }} onPress={() => {
          setOpen(false);
          void onSelect(person.id);
        }} style={({ pressed }) => [styles.person, person.id === selectedId && styles.pillActive, pressed && styles.pressed]}>
        <View style={styles.flex}><Text style={styles.label}>{person.name}</Text>
          {(names.get(person.name) ?? 0) > 1 ? <Text style={styles.muted}>{personQualifier(person)}</Text> : null}
        </View>
        <MaterialCommunityIcons name={person.id === selectedId ? 'check-circle-outline' : 'chevron-right'} color="#257696" size={18} />
      </Pressable>) : <Text accessibilityLiveRegion="polite" style={styles.muted}>Kein passender Name gefunden.</Text>}
      {matching.length > limit ? <VitalAction variant="secondary" title={`Weitere anzeigen (${matching.length - limit})`} onPress={() => setLimit(limit + 12)} /> : null}
    </View> : null}
  </View>;
}

export function useVitalStyles() {
  const { c } = useCareLightPalette();
  return useMemo(() => StyleSheet.create({
    root: { flex: 1, minHeight: 0, minWidth: 0 },
    scroll: { flex: 1, minHeight: 0 },
    page: { width: '100%', maxWidth: 1560, alignSelf: 'center', gap: 16, paddingBottom: 16, minWidth: 0 },
    flex: { flex: 1, minWidth: 0 },
    stack: { gap: 9, minWidth: 0 },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9, minWidth: 0 },
    titleRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    heading: { ...typography.h3, fontSize: 21, lineHeight: 28, color: c.text },
    label: { ...typography.label, color: c.text, fontWeight: '700' },
    muted: { ...typography.caption, color: c.muted, lineHeight: 19 },
    body: { ...typography.body, color: c.text, lineHeight: 22 },
    value: { ...typography.h2, fontVariant: ['tabular-nums'], color: c.text },
    hero: { position: 'relative', overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#3B7896', paddingHorizontal: 20, paddingVertical: 16, minHeight: 98, justifyContent: 'center' },
    heroContent: { gap: 5, maxWidth: '88%', zIndex: 1 },
    heroTitle: { ...typography.h2, color: '#FFFFFF', fontSize: 27, lineHeight: 35, fontWeight: '800' },
    heroDescription: { ...typography.body, color: '#D4EBF6', lineHeight: 22 },
    heroArtwork: { position: 'absolute', width: 120, height: 112, right: 15, bottom: -10, opacity: 0.60, pointerEvents: 'none', transform: [{ rotate: '10deg' }] },
    panel: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, gap: 14, padding: 15, minWidth: 0 },
    sectionItem: { flexGrow: 1, flexBasis: 260, minWidth: 0, gap: 6 },
    transaction: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 },
    transactionPanel: { zIndex: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'stretch' },
    columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
    catalogColumn: { flex: 1, minWidth: 0 },
    editorColumn: { width: '40%', minWidth: 350, maxWidth: 530 },
    tile: { minHeight: 129, minWidth: 0, gap: 5, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 9, alignItems: 'center', backgroundColor: c.surfaceAlt },
    tileSelected: { backgroundColor: c.isDark ? '#16394B' : '#E4F7FB', borderColor: '#097C9E' },
    tileArt: { alignSelf: 'center', justifyContent: 'center', alignItems: 'center', minHeight: 74 },
    tileLabel: { ...typography.label, fontSize: 13, lineHeight: 17, textAlign: 'center', color: c.text, fontWeight: '700' },
    tileUnit: { ...typography.caption, fontSize: 12, lineHeight: 16, textAlign: 'center', color: c.muted },
    tileMarker: { position: 'absolute', right: 6, top: 6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
    editorTitle: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    editorArtwork: { backgroundColor: c.surfaceAlt, borderRadius: 16, width: 84, height: 82, justifyContent: 'center', alignItems: 'center' },
    numericFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, minWidth: 0 },
    numericField: { flexBasis: 132, flexGrow: 1, minWidth: 0 },
    numeric: { fontVariant: ['tabular-nums'], fontSize: 24, minHeight: 55, fontWeight: '700' },
    result: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, gap: 2, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
    footer: { alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row', flexWrap: 'wrap', width: '100%', maxWidth: 1560, alignSelf: 'center', gap: 9, padding: 11, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    footerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    action: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, borderWidth: 1, minWidth: 0, maxWidth: '100%' },
    actionPrimary: { backgroundColor: '#09638B', borderColor: '#09638B' },
    actionSecondary: { backgroundColor: '#F0F8FE', borderColor: '#C5DDED' },
    actionLight: { backgroundColor: '#E3F8FC', borderColor: '#B9ECF5' },
    actionText: { ...typography.label, fontWeight: '700', color: '#10476A', flexShrink: 1, textAlign: 'center' },
    actionTextPrimary: { color: '#FFFFFF' },
    disabled: { opacity: 0.60 },
    pressed: { opacity: 0.73 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pill: { minHeight: 42, minWidth: 42, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: c.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
    pillCompact: { minHeight: 36, borderRadius: 12 },
    pillActive: { borderColor: '#0A7A9A', backgroundColor: c.isDark ? '#173F51' : '#DCFAFC' },
    pillText: { ...typography.label, color: c.text, fontSize: 13, lineHeight: 18, textAlign: 'center' },
    pillTextActive: { fontWeight: '800' },
    caseButton: { minHeight: 46, borderRadius: 11, borderColor: c.border, borderWidth: 1, backgroundColor: c.surfaceAlt, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, paddingVertical: 5 },
    caseIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#E4F4FC' },
    caseLabel: { ...typography.label, color: c.text, fontWeight: '700', flexShrink: 1 },
    caseResults: { gap: 5, borderRadius: 13, padding: 9, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    person: { borderWidth: 1, borderColor: 'transparent', minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: c.surfaceAlt },
    histories: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' },
    historyCard: { flexGrow: 1, flexBasis: 420, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, gap: 9, minWidth: 0 },
    historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    condition: { flexGrow: 1, flexBasis: 185, gap: 4, padding: 10, borderRadius: 10, backgroundColor: c.surfaceAlt, minWidth: 0 },
    historyContext: { padding: 9, gap: 4, borderRadius: 9, backgroundColor: c.surfaceAlt },
  }), [c]);
}
