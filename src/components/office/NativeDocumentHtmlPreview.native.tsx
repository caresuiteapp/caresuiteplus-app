import { useMemo, useState, type ReactNode } from 'react';
import { Image, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { PremiumButton } from '@/components/ui';
import { parseNativeDocumentContent, type NativeDocumentNode } from '@/lib/documents/nativeDocumentContent';
import { spacing } from '@/theme';

function DocumentNode({ node }: { node: NativeDocumentNode }): ReactNode {
  if (node.kind === 'text') return node.text.trim() ? <Text style={styles.text}>{node.text}</Text> : null;
  const children = node.children.map((child, index) => <DocumentNode key={index} node={child} />);
  if (node.tag === 'br') return <Text>{'\n'}</Text>;
  if (node.tag === 'hr') return <View style={styles.rule} />;
  if (node.tag === 'img') {
    const uri = node.attributes.src ?? '';
    if (/^data:image\/svg\+xml;base64,/i.test(uri)) {
      try { return <SvgXml xml={atob(uri.slice(uri.indexOf(',') + 1))} width="100%" height={110} />; } catch { return <Text style={styles.text}>{node.attributes.alt ?? 'Bild nicht verfügbar'}</Text>; }
    }
    if (!/^https:\/\/|^data:image\/(png|jpe?g|gif|webp);base64,/i.test(uri)) return <Text style={styles.text}>{node.attributes.alt ?? 'Bild nicht verfügbar'}</Text>;
    return <Image source={{ uri }} style={styles.image} resizeMode="contain" accessibilityLabel={node.attributes.alt ?? 'Dokumentbild'} />;
  }
  if (/^h[1-6]$/.test(node.tag)) return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>;
  if (['strong', 'b'].includes(node.tag)) return <Text style={styles.strong}>{children}</Text>;
  if (['em', 'i'].includes(node.tag)) return <Text style={styles.italic}>{children}</Text>;
  if (['span', 'small', 'a', 'u', 'sup', 'sub', 'label'].includes(node.tag)) return <Text style={styles.text}>{children}</Text>;
  if (node.tag === 'p') return <View style={styles.paragraph}>{children}</View>;
  if (node.tag === 'ol') return <View style={styles.section}>{node.children.map((child, index) => <DocumentNode key={index} node={child.kind === 'element' && child.tag === 'li' ? { ...child, attributes: { ...child.attributes, marker: `${index + 1}.` } } : child} />)}</View>;
  if (node.tag === 'li') return <View style={styles.listItem}><Text style={styles.text}>{node.attributes.marker ?? '•'} </Text><View style={styles.listBody}>{children}</View></View>;
  if (['td', 'th'].includes(node.tag)) return <View style={styles.cell}>{children}</View>;
  if (node.tag === 'tr') return <View style={styles.row}>{children}</View>;
  return <View style={styles.section}>{children}</View>;
}

/** Full native content plus an explicit system preview of the original layout. */
export function NativeDocumentPreview({ html, height }: { html: string; height: number }) {
  const nodes = useMemo(() => parseNativeDocumentContent(html), [html]);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openOriginal = async () => {
    if (opening) return;
    setOpening(true); setError(null);
    try {
      const { printAsync } = await import('expo-print');
      await printAsync({ html });
    } catch { setError('Die Originalansicht konnte nicht geöffnet werden. Bitte erneut versuchen. Der vollständige Inhalt bleibt unten lesbar.'); }
    finally { setOpening(false); }
  };
  return <View style={styles.root}>
    <PremiumButton title="Originalansicht öffnen" variant="secondary" loading={opening} onPress={() => void openOriginal()} />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <ScrollView style={{ height }} contentContainerStyle={styles.document} nestedScrollEnabled showsVerticalScrollIndicator testID="native-document-html-preview">
      {nodes.map((node, index) => <DocumentNode key={index} node={node} />)}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  root: { gap: spacing.sm, width: '100%' },
  document: { padding: spacing.md, backgroundColor: '#FFFFFF', gap: spacing.sm },
  text: { fontSize: 15, lineHeight: 22, color: '#10243D' },
  heading: { fontSize: 20, lineHeight: 27, fontWeight: '700', color: '#10243D', marginVertical: 8 },
  strong: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: '#10243D' },
  italic: { fontSize: 15, lineHeight: 22, fontStyle: 'italic', color: '#10243D' },
  paragraph: { marginVertical: 5, gap: 2 },
  section: { gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: '#D8E2EF', gap: 6 },
  cell: { flexBasis: '45%', flexGrow: 1, minWidth: 0, paddingVertical: 6, gap: 3 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start' },
  listBody: { flex: 1, minWidth: 0, gap: 3 },
  image: { width: '100%', height: 110 },
  rule: { borderBottomWidth: 1, borderBottomColor: '#D8E2EF', marginVertical: 8 },
  error: { color: '#AF243B', fontSize: 14, lineHeight: 20 },
});
