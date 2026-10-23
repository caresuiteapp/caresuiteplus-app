import { useMemo, useState } from 'react';
import { FlatList, ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell';
import { MobileButton, MobileCard, MobileChips, MobileHeading, MobileRecordRow, MobileSearch, MobileSheet, MobileState, m } from '@/components/mobile/MobileWorkspace';
import { HELP_ARTICLES, HELP_AUDIENCES, HELP_CATEGORIES } from '@/features/help/helpCatalog';
import { helpArticle, helpReadingMinutes, searchHelpArticles } from '@/features/help/helpSearch';
import { nativeAdministrationRoute } from '@/liquid-command/navigation/nativeAdministrationModel';

const scalar = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
export function HelpCenterScreen() {
  const params = useLocalSearchParams<{ artikel?: string; thema?: string; zielgruppe?: string; q?: string }>();
  const router = useRouter(); const [filters, setFilters] = useState(false); const [shareError, setShareError] = useState('');
  const q = scalar(params.q) ?? ''; const category = scalar(params.thema) ?? ''; const audience = scalar(params.zielgruppe) ?? '';
  const selected = helpArticle(scalar(params.artikel));
  const results = useMemo(() => searchHelpArticles({ q, category, audience }), [q, category, audience]);
  const open = (id: string) => { setShareError(''); router.setParams({ artikel: id }); };
  const share = async () => { if (!selected) return; setShareError(''); try { await Share.share({ title: selected.title, message: `${selected.title}\n\n${selected.summary}\n\nhttps://www.caresuiteplus.app/hilfe?artikel=${encodeURIComponent(selected.id)}` }); } catch { setShareError('Die Anleitung konnte nicht geteilt werden.'); } };
  return <ScreenShell title="Hilfe & Anleitungen" showBack={false} scroll={false} contentOwnsHeader>
    {selected ? <ScrollView key={selected.id} keyboardShouldPersistTaps="handled" contentContainerStyle={[m.stack, { paddingBottom: 24 }]}>
      <View style={m.wrap}><MobileButton compact label="Alle Anleitungen" icon="arrow-left" onPress={() => router.setParams({ artikel: '' })} /><MobileButton compact label="Teilen" icon="share-2" onPress={() => void share()} /></View>
      <MobileHeading title={selected.title} subtitle={`${HELP_CATEGORIES.find(item => item.id === selected.category)?.title} · ${helpReadingMinutes(selected)} Min. Lesezeit`} icon="book-open" />
      <Text style={m.body}>{selected.summary}</Text><MobileCard><Text style={m.label}>Hier finden Sie die Funktion</Text><Text style={m.body}>{selected.location.join(' › ')}</Text>{selected.route ? <MobileButton label="Funktion öffnen" icon="arrow-up-right" primary onPress={() => router.push(nativeAdministrationRoute(selected.route!) as never)} /> : null}</MobileCard>
      {selected.prerequisites.length ? <MobileCard><Text style={m.section}>Vor dem Start</Text>{selected.prerequisites.map((text, index) => <Text key={index} style={m.body}>• {text}</Text>)}</MobileCard> : null}
      {selected.steps.map((step, index) => <MobileCard key={index}><Text style={[m.label, { color: '#1569E8' }]}>Schritt {index + 1}</Text><Text accessibilityRole="header" style={m.section}>{step.title}</Text><Text style={m.body}>{step.text}</Text></MobileCard>)}
      <MobileCard style={{ backgroundColor: '#EAF3FF' }}><Text style={m.section}>{selected.example.title}</Text><Text style={m.body}>{selected.example.text}</Text></MobileCard>
      {selected.checks.length ? <MobileCard><Text style={m.section}>Ergebnis prüfen</Text>{selected.checks.map((text, index) => <Text key={index} style={m.body}>• {text}</Text>)}</MobileCard> : null}
      {selected.troubleshooting.length ? <MobileCard><Text style={m.section}>Wenn etwas nicht klappt</Text>{selected.troubleshooting.map((item, index) => <View key={index} style={{ gap: 5 }}><Text style={m.label}>{item.problem}</Text><Text style={m.body}>{item.solution}</Text></View>)}</MobileCard> : null}
      {selected.related.map(id => { const article = helpArticle(id); return article ? <MobileRecordRow key={id} icon="book" title={article.title} subtitle="Passende Anleitung" onPress={() => open(id)} /> : null; })}
      {shareError ? <Text style={m.error}>{shareError}</Text> : null}
    </ScrollView> : <FlatList data={results} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" ItemSeparatorComponent={() => <View style={{ height: 10 }} />} contentContainerStyle={{ paddingBottom: 24 }} ListHeaderComponent={<View style={[m.stack, { paddingBottom: 14 }]}><MobileHeading title="Hilfe & Anleitungen" subtitle={`${HELP_ARTICLES.length} Anleitungen mit Beispielen und einzelnen Schritten`} icon="book-open" /><MobileSearch value={q} onChangeText={value => router.setParams({ q: value })} label="Hilfe durchsuchen" placeholder="Was möchten Sie erledigen?" /><View style={m.wrap}><MobileButton compact label="Themen & Zielgruppen" icon="sliders" selected={Boolean(category || audience)} onPress={() => setFilters(true)} /><MobileButton compact label="Support" icon="message-circle" onPress={() => router.push('/support' as never)} /></View><Text style={m.muted}>{results.length} passende Anleitungen</Text></View>} renderItem={({ item }) => <MobileRecordRow icon="book-open" title={item.title} subtitle={item.summary} onPress={() => open(item.id)} />} ListEmptyComponent={<MobileState title="Keine passende Anleitung" message="Versuchen Sie einen anderen Suchbegriff oder setzen Sie die Themenauswahl zurück." />} />}
    <MobileSheet visible={filters} title="Anleitungen filtern" onClose={() => setFilters(false)} footer={<MobileButton primary label="Anleitungen anzeigen" onPress={() => setFilters(false)} />}><Text style={m.label}>Für wen?</Text><MobileChips label="Zielgruppe" items={[{ key: '', label: 'Alle' }, ...HELP_AUDIENCES.map(item => ({ key: item.id, label: item.label }))]} value={audience} onChange={value => router.setParams({ zielgruppe: value })} /><Text style={m.label}>Thema</Text>{[{ key: '', label: 'Alle Themen' }, ...HELP_CATEGORIES.map(item => ({ key: item.id, label: item.title }))].map(item => <MobileButton key={item.key} selected={category === item.key} label={item.label} onPress={() => router.setParams({ thema: item.key })} />)}</MobileSheet>
  </ScreenShell>;
}
