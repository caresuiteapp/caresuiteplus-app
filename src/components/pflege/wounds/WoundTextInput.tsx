import { useMemo, useRef, useState, type ComponentProps, type MouseEvent } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { ErrorState, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { appendWoundTemplates, mergeWoundCatalogItems, WOUND_CATALOG_LABELS, type WoundCatalogItem } from '@/lib/pflege/woundRecordDomain';
import type { WoundRecordUserScope } from '@/lib/pflege/woundRecordService';
import { readWoundTemplateCode, WOUND_TEMPLATE_FIELDS, woundTemplateMatches, type WoundTemplateField } from '@/lib/pflege/woundTemplates';
import { spacing, typography } from '@/theme';
import { useWoundCatalog } from './useWoundCatalog';
import { WoundTabs } from './WoundWorkspaceLayout';

type Props = ComponentProps<typeof PremiumInput> & {
  scope?: WoundRecordUserScope;
  templateField?: WoundTemplateField;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
};

export function WoundTextInput({ scope, templateField, label, value, onChangeText, editable = true, multiline,
  maxLength = 2000, onPressIn, ...props }: Props) {
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const input = useRef<TextInput>(null);
  const lastTap = useRef(0);
  const { c } = useCareLightPalette();
  const identity = scope?.tenantId && scope.actorId && scope.role
    ? [scope.tenantId, scope.actorId, scope.role].join(':') : null;
  const enabled = !!identity && editable && !props.readOnly && !props.secureTextEntry;
  if (openedFor && (!enabled || openedFor !== identity)) setOpenedFor(null);
  function open() {
    if (!enabled) return;
    if (Platform.OS !== 'web') Keyboard.dismiss();
    setOpenedFor(identity);
  }
  function close() {
    setOpenedFor(null);
    if (Platform.OS === 'web') requestAnimationFrame(() => input.current?.focus());
  }
  function doubleClick(event: MouseEvent<HTMLDivElement>) {
    const tag = (event.target as HTMLElement).tagName;
    if (!enabled || (tag !== 'INPUT' && tag !== 'TEXTAREA')) return;
    event.preventDefault();
    open();
  }
  const control = <PremiumInput {...props} label={label} accessibilityLabel={props.accessibilityLabel ?? label}
    inputRef={input} value={value} onChangeText={onChangeText}
    maxLength={maxLength} editable={editable} multiline={multiline}
    onPressIn={Platform.OS === 'web' ? onPressIn : event => {
      onPressIn?.(event);
      if (!enabled) return;
      const now = Date.now();
      if (now - lastTap.current < 300) { lastTap.current = 0; open(); }
      else lastTap.current = now;
    }}
    labelAccessory={enabled ? <Pressable style={inputStyles.trigger} hitSlop={7} onPress={open}
      accessibilityRole="button" accessibilityLabel={`Textbausteine für ${label.replace(/\s*\*$/, '')}`}>
      <Feather name="file-text" size={16} color={c.text} accessible={false} />
    </Pressable> : undefined} />;
  return <>
    {Platform.OS === 'web' && enabled ? <div style={{ minWidth: 0 }} onDoubleClick={doubleClick}>{control}</div> : control}
    {enabled && scope && openedFor === identity && <WoundTemplatesPopup key={identity} scope={scope}
      label={label} field={templateField} value={value} maxLength={maxLength} multiline={!!multiline} close={close}
      onInsert={next => { if (enabled && next.length <= maxLength) { onChangeText(next); close(); } }} />}
  </>;
}

const inputStyles = StyleSheet.create({
  trigger: { minWidth: 30, minHeight: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
});

const TEMPLATE_PAGE = 18;
const TEMPLATE_TABS = [
  { key: 'field', label: 'Für dieses Feld', icon: 'align-left' },
  { key: 'all', label: 'Alle Vorlagen', icon: 'layers' },
] as const;

function WoundTemplatesPopup({ scope, label, field, value, maxLength, multiline, close, onInsert }: {
  scope: WoundRecordUserScope; label: string; field?: WoundTemplateField; value: string; maxLength: number; multiline: boolean;
  close: () => void; onInsert: (value: string) => void;
}) {
  const { c } = useCareLightPalette();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'field' | 'all'>(field ? 'field' : 'all');
  const [limit, setLimit] = useState(TEMPLATE_PAGE);
  const [selected, setSelected] = useState<WoundCatalogItem[]>([]);
  const query = useWoundCatalog(scope);
  const items = useMemo(() => [
    ...mergeWoundCatalogItems(query.data ?? [], 'description'),
    ...mergeWoundCatalogItems(query.data ?? [], 'treatment'),
  ], [query.data]);
  const activeView = search.trim() ? 'all' : view;
  const received = !!query.data || !!query.error || !!query.refreshError;
  const visible = (received ? items : [])
    .map(item => {
      const itemField = readWoundTemplateCode(item.code)?.field;
      return { item, field: itemField, label: itemField ? WOUND_TEMPLATE_FIELDS[itemField].label : WOUND_CATALOG_LABELS[item.kind] };
    })
    .filter(row => (activeView === 'all' || row.field === field)
      && woundTemplateMatches([row.item.name, row.item.text, row.label, WOUND_CATALOG_LABELS[row.item.kind]], search));
  const next = appendWoundTemplates(value, selected.map(item => item.text), multiline);
  const overLimit = next.length > maxLength;
  const styles = useMemo(() => StyleSheet.create({
    stack: { gap: spacing.sm, minWidth: 0 },
    options: { gap: spacing.xs, minWidth: 0 },
    item: {
      minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
      padding: spacing.sm, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border,
    },
    checked: { backgroundColor: c.surfaceAlt, borderColor: c.cyan },
    copy: { flex: 1, minWidth: 0, gap: spacing.xs },
    title: { ...typography.label, color: c.text },
    text: { ...typography.body, color: c.text },
    muted: { ...typography.caption, color: c.muted },
  }), [c]);
  function toggle(item: WoundCatalogItem) {
    setSelected(previous => previous.some(row => row.id === item.id)
      ? previous.filter(row => row.id !== item.id) : [...previous, item]);
  }
  return <PlatformModal visible title="Textbausteine" subtitle={label.replace(/\s*\*$/, '')}
    maxWidth={710} maxHeightRatio={0.88} onClose={close}
    footerActions={[
      { title: 'Abbrechen', variant: 'secondary', onPress: close },
      { title: 'In Feld einfügen', variant: 'primary', disabled: !selected.length || overLimit, onPress: () => onInsert(next) },
    ]}
    footerContent={<Text accessibilityLiveRegion="polite" style={styles.muted}>
      {selected.length === 1 ? '1 Baustein ausgewählt' : `${selected.length} Bausteine ausgewählt`}
      {overLimit ? ` · ${next.length - maxLength} Zeichen zu viel` : ''}
    </Text>}>
    <View style={styles.stack}>
      {field && <WoundTabs tabs={TEMPLATE_TABS} value={activeView} label="Vorlagenauswahl"
        onChange={nextView => { setView(nextView); setLimit(TEMPLATE_PAGE); if (nextView === 'field') setSearch(''); }} />}
      <PremiumInput label="Textbausteine suchen" accessibilityLabel="Textbausteine suchen"
        placeholder="In allen Vorlagen suchen" value={search} onChangeText={text => { setSearch(text); setLimit(TEMPLATE_PAGE); }} />
      {!received && <LoadingState message="Textbausteine werden geladen …" />}
      {(query.error || query.refreshError) && <ErrorState message={query.error || query.refreshError || ''} onRetry={query.refresh} />}
      {received && !visible.length && <Text style={styles.muted}>Keine passenden Textbausteine.</Text>}
      <View style={styles.options}>
        {visible.slice(0, limit).map(({ item, label: topicLabel }) => {
          const checked = selected.some(row => row.id === item.id);
          return <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked }}
            style={[styles.item, checked && styles.checked]} onPress={() => toggle(item)}>
            <Feather name={checked ? 'check-square' : 'square'} size={19} color={c.text} accessible={false} />
            <View style={styles.copy}>
              <Text style={styles.title}>{item.name}</Text>
              {activeView === 'all' && <Text style={styles.muted}>{topicLabel}</Text>}
              <Text style={styles.text}>{item.text}</Text>
            </View>
          </Pressable>;
        })}
      </View>
      {visible.length > limit && <PremiumButton title="Weitere Vorlagen anzeigen" size="sm" variant="secondary"
        onPress={() => setLimit(value => value + TEMPLATE_PAGE)} />}
    </View>
  </PlatformModal>;
}
