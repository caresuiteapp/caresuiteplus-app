import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { PremiumButton, PremiumCard } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { MAX_CATALOG_FILE_BYTES, parseBfarmCatalog } from '@/lib/pflege/bfarmCatalogImport';
import {
  importMedicationPackages, importPhysicians, validateMedicationPackageFeed, validatePhysicianFeed,
  type MedicationPackageFeed, type PhysicianFeed,
} from '@/lib/pflege/medicationMasterData';

type Mode = 'bfarm' | 'products' | 'physicians';
type Prepared = { kind: 'products'; feed: MedicationPackageFeed } | { kind: 'physicians'; feed: PhysicianFeed };
const modes: { key: Mode; title: string; help: string }[] = [
  { key: 'bfarm', title: 'BfArM-Referenz', help: 'Alle drei entpackten DSV-Dateien desselben Lieferdatums auswählen. Marke und Hersteller bleiben ohne ergänzende Quelle leer.' },
  { key: 'products', title: 'Präparate (JSON)', help: 'Freigegebene Präparatedatei mit Quelle, Datenstand und PZN-Datensätzen auswählen.' },
  { key: 'physicians', title: 'Arztverzeichnis (JSON)', help: 'Freigegebene Verzeichnisdatei mit Quelle, Datenstand und stabiler Anbieterkennung je Kontakt auswählen.' },
];

async function readFile(asset: DocumentPicker.DocumentPickerAsset) {
  if (asset.file) {
    if (!asset.file.size || asset.file.size > MAX_CATALOG_FILE_BYTES) throw new Error('Die Datei ist leer oder größer als 64 MB.');
    return asset.file.text();
  }
  if (!asset.uri.startsWith('file://')) throw new Error('Die ausgewählte Datei ist nicht lokal verfügbar.');
  const { File } = await import('expo-file-system');
  const file = new File(asset.uri);
  if (!file.size || file.size > MAX_CATALOG_FILE_BYTES) throw new Error('Die Datei ist leer oder größer als 64 MB.');
  return file.text();
}

/** Catalog writes are separate from all patient and medication order workflows. */
export function MedicationMasterDataImport({ tenantId, isCurrent }: { tenantId: string; isCurrent: () => boolean }) {
  const [open, setOpen] = useState(false), [mode, setMode] = useState<Mode>('bfarm');
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [phase, setPhase] = useState<'reading' | 'saving' | null>(null);
  const [completed, setCompleted] = useState(0), [message, setMessage] = useState(''), [error, setError] = useState('');
  const mounted = useRef(false), busy = useRef(false), live = useRef({ tenantId, isCurrent });
  live.current = { tenantId, isCurrent };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && live.current.tenantId === tenantId && live.current.isCurrent();

  function reset() { setPrepared(null); setCompleted(0); setMessage(''); setError(''); }

  async function selectFiles() {
    if (!current() || busy.current) return;
    busy.current = true; reset(); setPhase('reading');
    try {
      const selection = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: mode === 'bfarm', copyToCacheDirectory: true, base64: false });
      if (selection.canceled || !current()) return;
      const expected = mode === 'bfarm' ? 3 : 1;
      if (selection.assets.length !== expected) throw new Error(mode === 'bfarm' ? 'Bitte genau drei DSV-Dateien auswählen.' : 'Bitte eine JSON-Datei auswählen.');
      let input: unknown;
      if (mode === 'bfarm') {
        const files: { name: string; text: string }[] = [];
        for (const asset of selection.assets) {
          if (!current()) return;
          files.push({ name: asset.name, text: await readFile(asset) });
        }
        input = parseBfarmCatalog(files);
      } else {
        const file = selection.assets[0];
        if (!/\.json$/i.test(file.name)) throw new Error('Bitte eine JSON-Datei auswählen.');
        input = JSON.parse((await readFile(file)).replace(/^\uFEFF/, ''));
      }
      if (!current()) return;
      if (mode === 'physicians') {
        const result = validatePhysicianFeed(input);
        if (!result.ok) throw new Error(result.error);
        setPrepared({ kind: 'physicians', feed: result.data });
      } else {
        const result = validateMedicationPackageFeed(input);
        if (!result.ok) throw new Error(result.error);
        setPrepared({ kind: 'products', feed: result.data });
      }
    } catch (cause) {
      if (current()) setError(cause instanceof SyntaxError ? 'Die Datei ist kein gültiges JSON.' : cause instanceof Error ? cause.message : 'Datei konnte nicht geprüft werden.');
    } finally {
      busy.current = false;
      if (mounted.current) setPhase(null);
    }
  }

  async function save() {
    if (!prepared || !current() || busy.current) return;
    busy.current = true; setPhase('saving'); setError(''); setMessage('');
    let written = completed;
    try {
      const { feed } = prepared;
      while (written < feed.rows.length && current()) {
        const end = Math.min(written + 500, feed.rows.length);
        const result = prepared.kind === 'products'
          ? await importMedicationPackages(tenantId, { ...prepared.feed, rows: prepared.feed.rows.slice(written, end) })
          : await importPhysicians(tenantId, { ...prepared.feed, rows: prepared.feed.rows.slice(written, end) });
        if (!current()) return;
        if (!result.ok) throw new Error(result.error);
        if (result.data.imported !== end - written) throw new Error('Die Datenbank hat diesen Abschnitt nicht vollständig bestätigt.');
        written = end; setCompleted(written);
      }
      if (current()) {
        setMessage(`${written.toLocaleString('de-DE')} Datensätze wurden gespeichert.`);
        setPrepared(null); setCompleted(0);
      }
    } catch (cause) {
      if (current()) setError(`${written ? `${written.toLocaleString('de-DE')} Datensätze gespeichert. ` : ''}${cause instanceof Error ? cause.message : 'Import wurde unterbrochen.'}`);
    } finally {
      busy.current = false;
      if (mounted.current) setPhase(null);
    }
  }

  return <PremiumCard style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>Stammdaten</Text>
    <Text style={styles.body}>Präparate und Arztkontakte für die Auswahl in der Medikation hinterlegen.</Text>
    {!open ? <PremiumButton title="Stammdaten importieren" variant="secondary" onPress={() => { if (current()) setOpen(true); }} /> : <>
      <View style={styles.actions}>
        {modes.map(item => <PremiumButton key={item.key} title={item.title} variant={mode === item.key ? 'primary' : 'secondary'}
          disabled={!!phase} onPress={() => { if (!current() || busy.current) return; reset(); setMode(item.key); }} />)}
      </View>
      <Text style={styles.body}>{modes.find(item => item.key === mode)?.help}</Text>
      <View style={styles.actions}>
        <PremiumButton title={phase === 'reading' ? 'Dateien werden geprüft…' : 'Dateien auswählen'} variant="secondary"
          loading={phase === 'reading'} disabled={phase === 'saving'} onPress={() => { void selectFiles(); }} />
        <PremiumButton title="Schließen" variant="ghost" disabled={!!phase} onPress={() => { if (!busy.current) { reset(); setOpen(false); } }} />
      </View>
      {prepared && <View style={styles.preview}>
        <Text style={styles.bodyStrong}>{prepared.feed.rows.length.toLocaleString('de-DE')} geprüfte Datensätze</Text>
        <Text style={styles.body}>Quelle: {prepared.feed.source} · Datenstand: {prepared.feed.sourceVersion}</Text>
        <Text style={styles.body}>Der Import speichert ausschließlich Stammdaten im eigenen Mandanten.</Text>
        {completed > 0 && <Text accessibilityLiveRegion="polite" style={styles.body}>{completed.toLocaleString('de-DE')} von {prepared.feed.rows.length.toLocaleString('de-DE')} gespeichert</Text>}
        <PremiumButton title={completed ? 'Import fortsetzen' : 'Stammdaten übernehmen'} loading={phase === 'saving'} disabled={phase === 'reading'} onPress={() => { void save(); }} />
      </View>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.bodyStrong}>{message}</Text>}
    </>}
  </PremiumCard>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm }, title: { ...typography.h3 },
  body: { ...typography.body, color: colors.textMuted }, bodyStrong: { ...typography.bodyStrong },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, preview: { gap: spacing.xs },
  error: { ...typography.body, color: colors.error },
});
