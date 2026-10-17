import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { CENTRAL_DOCUMENT_CATALOG, filterCentralDocuments, findCentralDocument } from '@/data/seeds/documentCatalog/centralCatalog';
import { CENTRAL_CATALOG_GROUPS } from '@/data/seeds/documentCatalog/centralCatalogTitles';
import { centralFileName, centralMissingFields, createCentralSnapshot, refreshCentralSnapshot } from '@/lib/documents/centralCatalogModel';
import { applyCentralQuickChoice, centralAdditionalQuickChoices, centralFieldQuickChoices, centralSectionQuickChoices, centralTableQuickChoices, type CentralQuickChoice } from '@/lib/documents/centralCatalogQuickChoices';
import { nativeDocumentLogo, printNativeDocument, shareNativeDocument } from '@/lib/documents/nativeDocumentDelivery';
import { MobileButton, MobileCard, MobileChips, MobileField, MobileHeading, MobileIconButton, MobileRecordRow, MobileSearch, MobileSheet, MobileState, m } from '@/components/mobile/MobileWorkspace';
import type { CentralDocumentDefinition, CentralDocumentSnapshot, CentralDocumentStored } from '@/types/documents/centralCatalog';
import type { CentralCatalogWorkspaceProps } from './CentralCatalogWorkspace.web';

type Selection = { definition: CentralDocumentDefinition; copy?: CentralDocumentStored };
const TARGET_LABELS = { client: 'Klientenakte', employee: 'Personalakte', company: 'Unternehmensakte' };
export function CentralCatalogWorkspace(props: CentralCatalogWorkspaceProps) {
  const [query, setQuery] = useState(''); const [category, setCategory] = useState(props.category ?? ''); const [module, setModule] = useState(props.module ?? '');
  const [tab, setTab] = useState(props.initialTab ?? 'catalog'); const [filters, setFilters] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(() => { const definition = props.templateKey ? findCentralDocument(props.templateKey) : undefined; return definition ? { definition } : null; });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(''); const downloadLock = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const definitions = useMemo(() => filterCentralDocuments({ query, category, module }), [query, category, module]);
  const records = props.records.filter(record => `${record.title} ${record.snapshot.context.subject.name ?? ''}`.toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE')));
  const download = async (record: CentralDocumentStored, original = false) => {
    if (downloadLock.current || !props.permissions.export) return; downloadLock.current = true; setBusy(record.id); setError('');
    try { const result = await props.download(record, original); if (!mounted.current) return; if (!result.ok) throw new Error(result.error); await shareNativeDocument(result.data, original ? `${record.id}_Original.${result.data[0] === 0x25 ? 'pdf' : result.data[0] === 0x89 ? 'png' : 'jpg'}` : centralFileName(record.snapshot), original); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Das Dokument konnte nicht geöffnet werden.'); }
    finally { downloadLock.current = false; if (mounted.current) setBusy(''); }
  };
  const header = <View style={[m.stack, { paddingBottom: 14 }]}><MobileHeading title="Dokumentenkatalog" subtitle={`${CENTRAL_DOCUMENT_CATALOG.length} Vorlagen · ${CENTRAL_CATALOG_GROUPS.length} Fachbereiche`} icon="file-text" action={<MobileIconButton label="Dokumente aktualisieren" icon="refresh-cw" onPress={props.onRefresh} />} /><MobileChips label="Dokumentenansicht" items={[{ key: 'catalog', label: 'Vorlagen' }, { key: 'records', label: 'Gespeicherte Fassungen' }]} value={tab} onChange={value => setTab(value as typeof tab)} /><MobileSearch label="Dokumente suchen" placeholder="Titel, Thema oder Tätigkeit" value={query} onChangeText={setQuery} />{tab === 'catalog' ? <View style={m.wrap}><MobileButton compact label="Fachbereiche filtern" icon="sliders" selected={Boolean(category || module)} onPress={() => setFilters(true)} /><Text style={m.muted}>{definitions.length} Vorlagen</Text></View> : null}{error ? <Text accessibilityRole="alert" style={m.error}>{error}</Text> : null}</View>;
  return <View style={m.grow}>
    {tab === 'catalog' ? <FlatList data={definitions} keyExtractor={item => item.key} keyboardShouldPersistTaps="handled" initialNumToRender={10} windowSize={5} contentContainerStyle={{ paddingBottom: 24 }} ListHeaderComponent={header} ItemSeparatorComponent={() => <View style={{ height: 10 }} />} renderItem={({ item }) => <MobileRecordRow icon="file-text" title={item.title} subtitle={`${item.categoryName} · ${TARGET_LABELS[item.target]} · A4 ${item.orientation === 'landscape' ? 'quer' : 'hoch'}`} onPress={() => setSelection({ definition: item })} />} ListEmptyComponent={<MobileState title="Keine passende Vorlage" message="Ändern Sie die Suche oder die Fachbereichsauswahl." />} /> : <FlatList data={records} keyExtractor={item => item.id} contentContainerStyle={{ paddingBottom: 24 }} ListHeaderComponent={header} ItemSeparatorComponent={() => <View style={{ height: 10 }} />} renderItem={({ item }) => <MobileCard><Text style={m.section}>{item.title}</Text><Text style={m.body}>{item.snapshot.context.subject.name || item.snapshot.context.company.name}</Text><Text style={m.muted}>Fassung {item.revision} · {new Date(item.createdAt).toLocaleDateString('de-DE')} · Entwurf</Text><View style={m.wrap}>{props.permissions.export ? <MobileButton compact label="PDF öffnen" icon="external-link" busy={busy === item.id} onPress={() => void download(item)} /> : null}{props.permissions.create ? <MobileButton compact label="Neue Fassung" icon="copy" onPress={() => setSelection({ definition: item.snapshot.definition, copy: item })} /> : null}{item.originalPath || item.originalHash ? <MobileButton compact label="Original öffnen" disabled={!props.permissions.export || !!busy} onPress={() => void download(item, true)} /> : null}</View></MobileCard>} ListEmptyComponent={<MobileState loading={props.loadingRecords} title={props.loadingRecords ? 'Fassungen werden geladen' : props.recordsError ? 'Fassungen konnten nicht geladen werden' : 'Noch keine gespeicherten Fassungen'} message={props.recordsError} onRetry={props.recordsError ? props.onRefresh : undefined} />} ListFooterComponent={props.recordsHasMore ? <MobileButton label="Weitere Fassungen laden" busy={props.loadingRecords} onPress={() => props.onLoadMore?.()} /> : null} />}
    <MobileSheet visible={filters} title="Vorlagen filtern" onClose={() => setFilters(false)} footer={<MobileButton primary label="Vorlagen anzeigen" onPress={() => setFilters(false)} />}><Text style={m.label}>Arbeitsbereich</Text><MobileChips label="Arbeitsbereich" items={[{ key: '', label: 'Alle' }, { key: 'office', label: 'Office' }, { key: 'assist', label: 'Assist' }, { key: 'pflege', label: 'Pflege' }, { key: 'stationaer', label: 'Stationär' }, { key: 'beratung', label: 'Beratung' }]} value={module} onChange={setModule} /><Text style={m.label}>Fachbereich</Text><MobileButton label="Alle Fachbereiche" selected={!category} onPress={() => setCategory('')} />{CENTRAL_CATALOG_GROUPS.map(group => <MobileButton key={group.key} label={group.name} selected={category === group.key} onPress={() => setCategory(group.key)} />)}</MobileSheet>
    {selection ? <NativeCatalogEditor key={`${props.tenantId}:${selection.definition.key}:${selection.copy?.id ?? 'new'}`} {...props} {...selection} onClose={() => setSelection(null)} /> : null}
  </View>;
}

function QuickField({ label, value, onChange, choices, multiline = false, disabled }: { label: string; value: string; onChange: (value: string) => void; choices: CentralQuickChoice[]; multiline?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return <View style={m.stack}><MobileField label={label} value={value} editable={!disabled} multiline={multiline} onChangeText={onChange} /><MobileButton compact icon="zap" label={`Schnellauswahl: ${label}`} disabled={disabled} onPress={() => setOpen(true)} /><MobileSheet visible={open} title={label} onClose={() => setOpen(false)}>{choices.map(choice => <MobileButton key={choice.key} label={choice.unavailable ? `${choice.label} · nicht hinterlegt` : choice.label} disabled={Boolean(choice.unavailable)} onPress={() => { onChange(applyCentralQuickChoice(value, choice)); setOpen(false); }} />)}</MobileSheet></View>;
}
function NativeCatalogEditor(props: CentralCatalogWorkspaceProps & Selection & { onClose: () => void }) {
  const d = props.definition; const entities = d.target === 'client' ? props.clients : props.employees;
  const [entityId, setEntityId] = useState(props.copy?.snapshot.context.entityId ?? (d.target === 'company' ? props.tenantId : d.target === 'client' ? props.clientId : props.employeeId) ?? '');
  const [snapshot, setSnapshot] = useState<CentralDocumentSnapshot | null>(() => props.copy ? { ...JSON.parse(JSON.stringify(props.copy.snapshot)), documentId: randomUUID(), parentDocumentId: props.copy.id, revision: props.copy.revision + 1, createdAt: new Date().toISOString() } : null);
  const [entityQuery, setEntityQuery] = useState(''); const [entityPicker, setEntityPicker] = useState(false); const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [dirty, setDirty] = useState(false); const [savedId, setSavedId] = useState('');
  const [original, setOriginal] = useState<{ bytes: Uint8Array; fileName: string }>();
  const [attempt, setAttempt] = useState(0); const [logo, setLogo] = useState<string>(); const [logoWarning, setLogoWarning] = useState('');
  const lock = useRef(false); const mounted = useRef(true); const sequence = useRef(0); const snapshotRef = useRef(snapshot); snapshotRef.current = snapshot;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current++; }; }, []);
  const { loadContext } = props;
  useEffect(() => {
    if (!entityId || props.copy) return;
    let active = true; const request = ++sequence.current; setLoading(true); setError(''); setSnapshot(null); setLogo(undefined); setLogoWarning('');
    void loadContext(d.target, entityId, d).then(async result => {
      if (!active || request !== sequence.current) return;
      if (!result.ok) throw new Error(result.error);
      setSnapshot(createCentralSnapshot(d, result.data, props.author, randomUUID()));
      try { const image = await nativeDocumentLogo(result.data.company.logoUrl); if (active && request === sequence.current) setLogo(image); }
      catch { if (active) setLogoWarning('Das Unternehmenslogo konnte nicht geladen werden. Prüfen Sie es vor der PDF-Ausgabe.'); }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Die Akte konnte nicht geladen werden.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [d, entityId, loadContext, props.author, props.copy, attempt]);
  useEffect(() => { if (!props.copy) return; let active = true; void nativeDocumentLogo(props.copy.snapshot.context.company.logoUrl).then(image => { if (active) setLogo(image); }).catch(() => { if (active) setLogoWarning('Das Unternehmenslogo konnte nicht geladen werden.'); }); return () => { active = false; }; }, [props.copy]);
  const modify = (change: (value: CentralDocumentSnapshot) => CentralDocumentSnapshot) => {
    if (lock.current || !props.permissions.create) return;
    setSnapshot(current => { if (!current) return current; const next = savedId ? { ...current, documentId: randomUUID(), parentDocumentId: savedId, revision: current.revision + 1, createdAt: new Date().toISOString() } : current; return change(next); }); setSavedId(''); setDirty(true); setMessage('');
  };
  const close = () => { if (lock.current || loading) return; if (!dirty) { props.onClose(); return; } Alert.alert('Entwurf schließen?', 'Ihre Änderungen wurden noch nicht in der Akte gespeichert.', [{ text: 'Weiter bearbeiten', style: 'cancel' }, { text: 'Verwerfen', style: 'destructive', onPress: props.onClose }]); };
  const missing = snapshot ? centralMissingFields(snapshot) : [];
  const act = async (action: 'share' | 'print' | 'save' | 'refresh' | 'original') => {
    if (lock.current || !snapshot || loading) return;
    if (action === 'save' && (!props.permissions.save || missing.length || savedId)) return;
    if ((action === 'share' || action === 'print') && !props.permissions.export) return;
    if ((action === 'refresh' || action === 'original') && !props.permissions.create) return;
    lock.current = true; setBusy(true); setError(''); setMessage(''); const chosen = snapshot;
    try {
      if (action === 'original') {
        const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/png', 'image/jpeg'], multiple: false, copyToCacheDirectory: true });
        if (result.canceled || !mounted.current) return;
        const file = new File(result.assets[0].uri); if (file.size > 8 * 1024 * 1024) throw new Error('Die Originalunterlage darf höchstens 8 MB groß sein.');
        const bytes = await file.bytes();
        if (bytes.length > 8 * 1024 * 1024 || !(bytes[0] === 0x25 && bytes[1] === 0x50 || bytes[0] === 0x89 && bytes[1] === 0x50 || bytes[0] === 0xff && bytes[1] === 0xd8)) throw new Error('Bitte eine gültige PDF-, PNG- oder JPEG-Datei wählen.');
        if (mounted.current) { if (savedId) { setSnapshot({ ...chosen, documentId: randomUUID(), parentDocumentId: savedId, revision: chosen.revision + 1, createdAt: new Date().toISOString() }); setSavedId(''); } setOriginal({ bytes, fileName: result.assets[0].name }); setDirty(true); } return;
      }
      if (action === 'refresh') {
        const result = await props.loadContext(d.target, entityId, d, chosen.context.procedure); if (!mounted.current) return; if (!result.ok) throw new Error(result.error);
        const base = savedId ? { ...chosen, documentId: randomUUID(), parentDocumentId: savedId, revision: chosen.revision + 1, createdAt: new Date().toISOString() } : chosen; const fresh = refreshCentralSnapshot(base, result.data, props.author); setSnapshot(fresh); setDirty(true); setSavedId(''); setMessage('Gespeicherte Angaben aktualisiert. Eigene Eingaben bleiben erhalten.'); return;
      }
      const { renderCentralDocumentPdf } = await import('@/lib/documents/centralCatalogPdf'); const result = renderCentralDocumentPdf(chosen, { logoDataUrl: logo });
      if (!mounted.current || snapshotRef.current !== chosen) return;
      if (action === 'share') await shareNativeDocument(result.bytes, centralFileName(chosen));
      else if (action === 'print') await printNativeDocument(result.bytes, centralFileName(chosen));
      else { const saved = await props.save(chosen, result.bytes, original); if (!mounted.current) return; if (!saved.ok) throw new Error(saved.error); setSavedId(saved.data.id); setDirty(false); setMessage(`Entwurf in der ${TARGET_LABELS[d.target]} gespeichert.`); props.onSaved(); }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Die Aktion konnte nicht abgeschlossen werden.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const choices = snapshot ? { fields: Object.fromEntries(d.fields.map(field => [field.key, centralFieldQuickChoices(snapshot, field, props.author)])), sections: Object.fromEntries(d.sections.map(section => [section.key, centralSectionQuickChoices(snapshot, section)])), additional: centralAdditionalQuickChoices(snapshot) } : null;
  return <MobileSheet visible wide title={d.title} onClose={close} footer={<><View style={m.wrap}><MobileButton primary label={savedId ? 'Gespeichert' : 'In Akte speichern'} icon="save" busy={busy} disabled={!snapshot || !props.permissions.save || !!savedId || !!missing.length || loading || d.sourceMode === 'original' && !original && !snapshot.parentDocumentId} onPress={() => void act('save')} /><MobileButton label="PDF öffnen / teilen" icon="share-2" disabled={!snapshot || !props.permissions.export || busy || loading} onPress={() => void act('share')} /><MobileButton label="Drucken" icon="printer" disabled={!snapshot || !props.permissions.export || busy || loading} onPress={() => void act('print')} /></View>{error ? <Text accessibilityRole="alert" style={m.error}>{error}</Text> : null}{message ? <Text accessibilityLiveRegion="polite" style={m.body}>{message}</Text> : null}</>}>
    <Text style={m.muted}>{d.categoryName} · {TARGET_LABELS[d.target]} · Entwurf</Text><Text style={m.body}>{d.instructions}</Text>
    {props.entityError ? <MobileState title="Aktenauswahl unvollständig" message={props.entityError} onRetry={props.onRefreshEntities} /> : null}
    {d.target !== 'company' ? <MobileButton label={snapshot?.context.subject.name || (d.target === 'client' ? 'Klient:in auswählen' : 'Mitarbeitende auswählen')} icon="users" disabled={busy || loading || !!props.copy || !props.permissions.create} onPress={() => setEntityPicker(true)} /> : null}
    {loading ? <MobileState loading title="Gespeicherte Angaben werden übernommen" /> : null}
    {!snapshot && entityId && !loading && error ? <MobileButton label="Akte erneut laden" onPress={() => setAttempt(value => value + 1)} /> : null}
    {snapshot && choices ? <View pointerEvents={busy ? 'none' : 'auto'} style={m.stack}>
      <MobileButton label="Angaben aus der Akte aktualisieren" icon="refresh-cw" disabled={!props.permissions.create} onPress={() => void act('refresh')} />
      {logoWarning ? <Text style={m.error}>{logoWarning}</Text> : null}
      {d.sourceMode === 'original' ? <MobileCard><Text style={m.label}>Originalunterlage</Text><Text style={m.muted}>{original?.fileName || (snapshot.parentDocumentId ? 'Original aus der Vorgängerfassung' : 'PDF, PNG oder JPEG · bis 8 MB')}</Text><MobileButton label="Original auswählen" icon="paperclip" disabled={!props.permissions.create} onPress={() => void act('original')} /></MobileCard> : null}
      {d.layout === 'letter' ? <><Text style={m.label}>Empfänger übernehmen</Text><MobileChips label="Briefempfänger" items={[{ key: 'manual', label: 'Eigene Angabe' }, { key: 'subject', label: 'Ausgewählte Akte' }, { key: 'company', label: 'Unternehmen' }, { key: 'representative', label: 'Vertretung' }, { key: 'payor', label: 'Kostenträger' }]} value={snapshot.recipientSource ?? 'manual'} onChange={value => modify(current => { const source = value as NonNullable<CentralDocumentSnapshot['recipientSource']>; const data = source === 'manual' ? null : current.context[source]; return { ...current, recipientSource: source, fieldOrigins: { ...current.fieldOrigins, subjectName: source === 'manual' ? 'manual' : 'stored', subjectAddress: source === 'manual' ? 'manual' : 'stored' }, values: { ...current.values, ...(data ? { subjectName: data.name || '', subjectAddress: data.address || '' } : {}) } }; })} /></> : null}
      {d.fields.map(field => <MobileCard key={field.key}><QuickField label={`${field.label}${field.required ? ' *' : ''}`} value={snapshot.values[field.key] ?? ''} multiline={field.type === 'multiline'} disabled={!props.permissions.create} choices={choices.fields[field.key]} onChange={value => modify(current => ({ ...current, values: { ...current.values, [field.key]: value }, fieldOrigins: { ...current.fieldOrigins, [field.key]: 'manual' } }))} /></MobileCard>)}
      {d.sections.map(section => <MobileCard key={section.key}><QuickField label={section.heading} multiline value={snapshot.sectionTexts[section.key] ?? section.text} choices={choices.sections[section.key]} disabled={!props.permissions.create} onChange={value => modify(current => ({ ...current, sectionTexts: { ...current.sectionTexts, [section.key]: value } }))} /></MobileCard>)}
      {snapshot.tableRows.map((row, rowIndex) => <MobileCard key={rowIndex}><Text style={m.section}>Zeile {rowIndex + 1}</Text>{d.columns.map((column, colIndex) => <QuickField key={column} label={column} value={row[colIndex] ?? ''} choices={centralTableQuickChoices(snapshot, column, rowIndex, props.author)} disabled={!props.permissions.create} onChange={value => modify(current => ({ ...current, tableOrigin: 'manual', tableRows: current.tableRows.map((cells, index) => index === rowIndex ? cells.map((cell, i) => i === colIndex ? value : cell) : cells) }))} />)}<MobileButton label="Zeile entfernen" icon="trash-2" disabled={!props.permissions.create} onPress={() => modify(current => ({ ...current, tableOrigin: 'manual', tableRows: current.tableRows.filter((_, index) => index !== rowIndex) }))} /></MobileCard>)}
      {d.columns.length ? <MobileButton label="Zeile hinzufügen" icon="plus" disabled={!props.permissions.create || snapshot.tableRows.length >= 1500} onPress={() => modify(current => ({ ...current, tableOrigin: 'manual', tableRows: [...current.tableRows, d.columns.map(() => '')] }))} /> : null}
      <MobileCard><QuickField label="Individuelle Ergänzungen" multiline value={snapshot.additionalText} choices={choices.additional} disabled={!props.permissions.create} onChange={value => modify(current => ({ ...current, additionalText: value }))} /></MobileCard>
      {missing.length ? <Text style={m.error}>Noch ausfüllen: {missing.join(', ')}</Text> : null}
    </View> : null}
    <MobileSheet visible={entityPicker} title={d.target === 'client' ? 'Klientenakte auswählen' : 'Personalakte auswählen'} onClose={() => setEntityPicker(false)}><MobileSearch label="Aktenauswahl durchsuchen" value={entityQuery} onChangeText={setEntityQuery} />{props.loadingEntities ? <MobileState loading title="Akten werden geladen" /> : null}{entities.filter(entity => `${entity.label} ${entity.detail ?? ''}`.toLocaleLowerCase('de-DE').includes(entityQuery.toLocaleLowerCase('de-DE'))).map(entity => <MobileRecordRow key={entity.id} title={entity.label} subtitle={entity.detail} onPress={() => {
      const choose = () => { setEntityId(entity.id); setEntityPicker(false); setDirty(false); setSavedId(''); setOriginal(undefined); };
      if (!dirty) choose(); else Alert.alert('Akte wechseln?', 'Ungespeicherte Änderungen werden verworfen.', [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Wechseln', onPress: choose }]);
    }} />)}</MobileSheet>
  </MobileSheet>;
}
