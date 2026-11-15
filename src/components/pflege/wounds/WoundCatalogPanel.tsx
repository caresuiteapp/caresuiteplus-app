import { useState } from 'react';
import { Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { DEFAULT_WOUND_SNIPPETS, woundNumber, type WoundCatalogItem, type WoundCatalogKind } from '@/lib/pflege/woundRecordDomain';
import { readWoundCatalog, saveWoundCatalogItem, type WoundRecordScope } from '@/lib/pflege/woundRecordService';
import { WOUND_STARTER_ARTICLES } from '@/lib/pflege/woundStarterCatalog';
import { useWoundRecordStyles } from './woundRecordStyles';

type CatalogScope = Pick<WoundRecordScope, 'tenantId' | 'actorId' | 'role'>;
const LABELS = { description: 'Wundbeschreibung', treatment: 'Wundbehandlung', article: 'Pflegehilfsmittel und Material' };
const EMPTY = { name: '', text: '', supplier: '', code: '', unit: '', unit_cents: null };
const EMPTY_SEARCH = 'Bezeichnung, Lieferant oder Artikelnummer suchen';

export function WoundCatalogPanel({ scope, kind, onInsert, embedded = false, edit, disabled = false }: {
  scope: CatalogScope; kind: WoundCatalogKind; onInsert?: (item: WoundCatalogItem) => void;
  embedded?: boolean; edit: boolean; disabled?: boolean;
}) {
  const styles = useWoundRecordStyles();
  const [shown, setShown] = useState(!embedded), [search, setSearch] = useState('');
  const [count, setCount] = useState(12);
  const [draft, setDraft] = useState<WoundCatalogItem | null>(null), [price, setPrice] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const query = useAsyncQuery(() => readWoundCatalog(scope), [scope.tenantId, scope.actorId, scope.role],
    { enabled: shown && !!scope.tenantId && !!scope.actorId, queryKey: [scope.tenantId, scope.actorId, scope.role, 'wound-catalog'].join(':') });
  const searchLabel = kind === 'article' ? EMPTY_SEARCH : 'Textbausteine durchsuchen';
  const rows = query.data?.filter(item => item.kind === kind) ?? [];
  const defaults = kind === 'article' ? WOUND_STARTER_ARTICLES : DEFAULT_WOUND_SNIPPETS.filter(item => item.kind === kind).map(item => ({ ...EMPTY, ...item, updated_at: '' }));
  const visible = [...rows, ...defaults.filter(item => !rows.some(row => row.name === item.name && row.supplier === item.supplier))].filter(item =>
    [item.name, item.supplier, item.code, item.text].some(field => field.toLocaleLowerCase('de').includes(search.trim().toLocaleLowerCase('de'))));
  const update = (key: 'name' | 'text' | 'supplier' | 'code' | 'unit', value: string) => setDraft(prev => prev ? { ...prev, [key]: value } : prev);

  function open(item?: WoundCatalogItem) {
    setError('');
    setPrice(item?.unit_cents == null ? '' : String(item.unit_cents / 100).replace('.', ','));
    setDraft(item?.updated_at ? item : { ...EMPTY, ...item, id: Crypto.randomUUID(), kind, updated_at: '' });
  }

  async function save() {
    if (!draft || busy || disabled) return;
    const parsedPrice = price.trim() ? woundNumber(price) : null;
    if (!draft.name.trim() || (kind === 'article' ? !draft.unit.trim() : !draft.text.trim())
      || (price.trim() && (parsedPrice === null || !/^\d+([.,]\d{1,2})?$/.test(price.trim()) || parsedPrice > 1e6))) {
      setError('Bitte Bezeichnung, Inhalt oder Einheit und gegebenenfalls den Einheitspreis prüfen.'); return;
    }
    setBusy(true); setError('');
    try {
      const result = await saveWoundCatalogItem(scope, { ...draft, name: draft.name.trim(), unit_cents: parsedPrice == null ? null : Math.round(parsedPrice * 100) });
      if (!result.ok) { setError(result.error); return; }
      setDraft(null);
      await query.refresh();
    } finally { setBusy(false); }
  }

  if (!shown) return <PremiumButton title={kind === 'article' ? 'Aus Materialkatalog übernehmen' : 'Textbausteine öffnen'}
    variant="secondary" size="sm" disabled={disabled} onPress={() => setShown(true)} />;
  return <SectionPanel title={kind === 'article' ? LABELS[kind] : 'Textbausteine · ' + LABELS[kind]}>
    <View style={styles.stack}>
      <PremiumInput label={searchLabel} accessibilityLabel={searchLabel} value={search}
        onChangeText={value => { setSearch(value); setCount(12); }} editable={!disabled} />
      <View style={styles.row}>
        {edit && !draft && <PremiumButton title={kind === 'article' ? 'Neuen Artikel anlegen' : 'Neuen Baustein anlegen'}
          size="sm" disabled={disabled} onPress={() => open()} />}
        {embedded && <PremiumButton title="Schließen" size="sm" variant="secondary" disabled={busy}
          onPress={() => { setShown(false); setDraft(null); }} />}
      </View>
      {query.loading && <LoadingState message="Katalog wird geladen …" />}
      {(query.error || query.refreshError) && <ErrorState message={query.error || query.refreshError || ''} onRetry={query.refresh} />}
      {!!error && <ErrorState message={error} />}
      {draft && <View style={styles.panel}>
        <Text style={styles.title}>{draft.updated_at ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</Text>
        <PremiumInput label="Bezeichnung" accessibilityLabel="Bezeichnung" value={draft.name} onChangeText={value => update('name', value)} maxLength={160} editable={!disabled && !busy} />
        {kind === 'article' ? <View style={styles.row}>
          {([['supplier', 'Lieferant oder Hersteller', 160], ['code', 'Artikelnummer oder PZN', 80], ['unit', 'Einheit', 40]] as const).map(([key, label, max]) =>
            <View key={key} style={styles.field}><PremiumInput label={label} accessibilityLabel={label} value={draft[key]} onChangeText={value => update(key, value)}
              maxLength={max} editable={!disabled && !busy} /></View>)}
          <View style={styles.field}><PremiumInput label="Einheitspreis in Euro" accessibilityLabel="Einheitspreis in Euro" value={price} onChangeText={setPrice}
            keyboardType="decimal-pad" editable={!disabled && !busy} /></View>
        </View> : null}
        <PremiumInput label={kind === 'article' ? 'Beschreibung und Hinweise zum Artikel' : 'Textbaustein'}
          accessibilityLabel={kind === 'article' ? 'Beschreibung und Hinweise zum Artikel' : 'Textbaustein'}
          value={draft.text} onChangeText={value => update('text', value)} maxLength={2000} multiline editable={!disabled && !busy} />
        <View style={styles.row}>
          <PremiumButton title="Änderung speichern" onPress={save} disabled={disabled || busy} />
          <PremiumButton title="Abbrechen" variant="secondary" onPress={() => setDraft(null)} disabled={busy} />
        </View>
      </View>}
      {!visible.length && !query.loading && <Text style={styles.muted}>Keine passenden Einträge im Katalog.</Text>}
      {visible.slice(0, count).map(item => <View key={item.id} style={styles.panel}>
        <Text style={styles.title}>{item.name}</Text>
        {kind === 'article' && <Text style={styles.muted}>{[item.supplier, item.code, item.unit,
          !item.updated_at ? 'Produktfamilie' : item.unit_cents == null ? 'Preis offen' : (item.unit_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })].filter(Boolean).join(' · ')}</Text>}
        {!!item.text && <Text style={styles.text}>{item.text}</Text>}
        <View style={styles.row}>
          {onInsert && <PremiumButton title="Übernehmen" size="sm" disabled={disabled} onPress={() => onInsert(item)} />}
          {edit && <PremiumButton title={item.updated_at ? 'Bearbeiten' : 'Eigene Fassung speichern'} size="sm"
            variant="secondary" disabled={disabled || busy} onPress={() => open(item)} />}
        </View>
      </View>)}
      {visible.length > count && <PremiumButton title="Weitere Einträge laden" variant="secondary" onPress={() => setCount(n => n + 20)} />}
    </View>
  </SectionPanel>;
}

export function WoundCatalogEditor({ scope, edit }: { scope: CatalogScope; edit: boolean }) {
  const styles = useWoundRecordStyles();
  const [kind, setKind] = useState<WoundCatalogKind>('article');
  return <View style={styles.stack}>
    <FilterChipGroup wrap options={Object.entries(LABELS).map(([key, label]) => ({ key, label }))} value={kind}
      onChange={key => setKind(key as WoundCatalogKind)} />
    <WoundCatalogPanel key={kind} scope={scope} kind={kind} edit={edit} />
  </View>;
}
