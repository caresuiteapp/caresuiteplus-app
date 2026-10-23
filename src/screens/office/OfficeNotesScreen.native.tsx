import { useNativePaneWidth } from '@/hooks/useNativePaneWidth';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { ScreenShell } from '@/components/layout/ScreenShell';
import { MobileButton, MobileCard, MobileChips, MobileField, MobileHeading, MobileIcon, MobileSearch, MobileSheet, MobileState, m } from '@/components/mobile/MobileWorkspace';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { createNoteDraft, draftsEqual, NOTE_CATEGORIES, NOTE_FORMATS, NOTE_STATUSES, NOTE_TEMPLATES, notePreview, noteSearchText, noteToDraft, validateNoteDraft } from '@/lib/office/notes/model.shared';
import { deleteNote, listNotes, saveNote, setNoteArchived } from '@/lib/office/notes/service.shared';
import type { NoteDraft, NotesActor, NoteStroke, OfficeNote } from '@/lib/office/notes/types.web';

type Editor = { id: string; revision: number | null; archived: boolean; draft: NoteDraft; original: NoteDraft };

export function OfficeNotesScreen() {
  const { user } = useAuth();
  const access = usePermissions();
  const actor = useMemo<NotesActor>(() => ({ tenantId: access.tenantId ?? '', userId: user?.id ?? '', roleKey: access.roleKey, permissions: access.permissions }), [access.tenantId, access.roleKey, access.permissions, user?.id]);
  const allowed = Boolean(actor.tenantId && actor.userId && actor.roleKey && !isPortalOnlyRole(actor.roleKey) && access.can('office.access'));
  return <ScreenShell title="Notizen" scroll={false} contentOwnsHeader>
    {allowed ? <NativeNotes key={JSON.stringify([actor.tenantId, actor.userId, actor.roleKey, actor.permissions])} actor={actor} /> : <MobileState title="Notizen" message="Persönliche Notizen sind nach der Anmeldung in einem freigegebenen Office-Bereich verfügbar." />}
  </ScreenShell>;
}

export function NativeNotes({ actor }: { actor: NotesActor }) {
  const { width, fontScale, onLayout } = useNativePaneWidth();
  const [notes, setNotes] = useState<OfficeNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorError, setEditorError] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [templates, setTemplates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const alive = useRef(true);
  const loadRequest = useRef(0);
  const busyRef = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; loadRequest.current++; }; }, []);
  const refresh = async () => {
    const request = ++loadRequest.current;
    setLoading(true); setError('');
    const result = await listNotes(actor);
    if (!alive.current || request !== loadRequest.current) return;
    if (result.ok) setNotes(result.data); else setError(result.error);
    setLoading(false);
  };
  useEffect(() => { void refresh(); }, [actor]);
  const filtered = useMemo(() => notes.filter(note => Boolean(note.archivedAt) === (tab === 'archived') && noteSearchText(note).includes(query.trim().toLocaleLowerCase('de-DE')))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)), [notes, tab, query]);
  const update = (draft: NoteDraft) => { setEditor(value => value ? { ...value, draft } : value); setEditorError(''); };
  const begin = (template = 'blank') => {
    const draft = createNoteDraft(template, randomUUID);
    setEditor({ id: randomUUID(), revision: null, archived: false, draft, original: draft }); setEditorError(''); setTemplates(false);
  };
  const open = (note: OfficeNote) => { const draft = noteToDraft(note); setEditor({ id: note.id, revision: note.revision, archived: Boolean(note.archivedAt), draft, original: draft }); setEditorError(''); };
  const close = () => {
    if (busyRef.current) return;
    if (editor && !draftsEqual(editor.draft, editor.original)) {
      Alert.alert('Ungespeicherte Änderungen', 'Möchten Sie die Änderungen verwerfen?', [{ text: 'Weiter bearbeiten', style: 'cancel' }, { text: 'Verwerfen', style: 'destructive', onPress: () => setEditor(null) }]);
    } else setEditor(null);
  };
  const remember = (saved: OfficeNote) => {
    ++loadRequest.current; setLoading(false);
    setNotes(rows => [saved, ...rows.filter(row => row.id !== saved.id)]);
  };
  const save = async () => {
    if (!editor || editor.archived || busyRef.current) return;
    const validation = validateNoteDraft(editor.draft);
    if (validation) { setEditorError(validation); return; }
    busyRef.current = true; setBusy(true); setEditorError('');
    const result = await saveNote(actor, { id: editor.id, expectedRevision: editor.revision, draft: editor.draft });
    if (!alive.current) return;
    busyRef.current = false; setBusy(false);
    if (result.ok) { remember(result.data); setEditor(null); setAnnouncement('Notiz gespeichert.'); }
    else setEditorError(result.error);
  };
  const archive = async (note: OfficeNote) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    const result = await setNoteArchived(actor, note, !note.archivedAt);
    if (!alive.current) return;
    busyRef.current = false; setBusy(false);
    if (result.ok) { remember(result.data); setAnnouncement(result.data.archivedAt ? 'Notiz archiviert.' : 'Notiz wiederhergestellt.'); } else setError(result.error);
  };
  const remove = (note: OfficeNote) => Alert.alert('Notiz löschen', `„${note.title}“ endgültig löschen?`, [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    void deleteNote(actor, note.id, note.revision).then(result => {
      if (!alive.current) return;
      busyRef.current = false; setBusy(false);
      if (result.ok) { ++loadRequest.current; setLoading(false); setNotes(rows => rows.filter(row => row.id !== note.id)); setAnnouncement('Notiz gelöscht.'); } else setError(result.error);
    });
  } }]);
  const columns = width >= 900 * Math.max(1, fontScale) ? 2 : 1;
  return <View onLayout={onLayout} style={m.page}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[m.content, { maxWidth: 1280, width: '100%', alignSelf: 'center' }]}>
      <MobileHeading title="Notizen" subtitle="Ihre persönlichen Gedanken, Aufgaben und Gesprächsnotizen" icon="edit-3" action={<MobileButton label="Neu" icon="plus" primary onPress={() => setTemplates(true)} disabled={busy} />} />
      <MobileSearch label="Notizen durchsuchen" placeholder="Titel, Inhalt oder Schlagwort" value={query} onChangeText={setQuery} />
      <View style={[m.wrap, { justifyContent: 'space-between' }]}><MobileChips label="Notizenansicht" items={[{ key: 'active', label: 'Aktuell' }, { key: 'archived', label: 'Archiv' }]} value={tab} onChange={setTab} /><MobileButton label="Aktualisieren" compact icon="refresh-cw" onPress={() => void refresh()} disabled={loading || busy} /></View>
      {announcement ? <Text accessibilityLiveRegion="polite" style={m.muted}>{announcement}</Text> : null}
      {error ? <MobileCard><Text accessibilityRole="alert" style={m.error}>{error}</Text><MobileButton label="Erneut laden" onPress={() => void refresh()} disabled={busy} /></MobileCard> : null}
      {loading ? <MobileState loading title="Notizen werden geladen" /> : null}
      {!loading && !error && !filtered.length ? <MobileState title={query ? 'Keine passenden Notizen' : tab === 'archived' ? 'Ihr Archiv ist leer' : 'Platz für Ihre Ideen'} message={query ? 'Versuchen Sie einen anderen Suchbegriff.' : 'Erstellen Sie eine Notiz oder wählen Sie eine Vorlage.'} /> : null}
      <View style={[m.wrap, { alignItems: 'stretch', gap: 14 }]}>{filtered.map(note => <View key={note.id} style={{ width: columns === 2 ? '48%' : '100%' }}>
        <MobileCard style={{ flex: 1 }}><Pressable accessibilityRole="button" accessibilityLabel={`${note.title} öffnen`} onPress={() => open(note)} style={{ gap: 9, minHeight: 76 }}>
          <View style={m.row}><MobileIcon name={note.pinned ? 'bookmark' : 'file-text'} color="#1569E8" /><Text style={[m.section, m.grow]}>{note.title}</Text></View>
          <Text style={m.muted}>{NOTE_CATEGORIES.find(item => item.value === note.category)?.label} · {NOTE_STATUSES.find(item => item.value === note.status)?.label}</Text>
          <Text numberOfLines={3} style={m.body}>{notePreview(note) || 'Notiz öffnen'}</Text>
          <Text style={m.muted}>{new Date(note.updatedAt).toLocaleDateString('de-DE')}{note.dueDate ? ` · Fällig ${note.dueDate.split('-').reverse().join('.')}` : ''}</Text>
        </Pressable><View style={m.wrap}><MobileButton compact label={note.archivedAt ? 'Wiederherstellen' : 'Archivieren'} icon={note.archivedAt ? 'rotate-ccw' : 'archive'} onPress={() => void archive(note)} disabled={busy} />{note.archivedAt ? <MobileButton compact label="Löschen" icon="trash-2" onPress={() => remove(note)} disabled={busy} /> : null}</View></MobileCard>
      </View>)}</View>
    </ScrollView>
    <MobileSheet visible={templates} title="Neue Notiz" onClose={() => setTemplates(false)} wide>
      {NOTE_TEMPLATES.map(template => <Pressable key={template.id} accessibilityRole="button" accessibilityLabel={`${template.label} erstellen`} onPress={() => begin(template.id)} style={m.card}><Text style={m.section}>{template.label}</Text><Text style={m.muted}>{template.description}</Text></Pressable>)}
    </MobileSheet>
    <MobileSheet visible={editor !== null} title={editor?.revision ? 'Notiz bearbeiten' : 'Neue Notiz'} onClose={close} wide footer={<><Text accessibilityRole="alert" style={m.error}>{editorError}</Text><View style={m.wrap}>{editor?.archived ? <Text style={m.muted}>Stellen Sie die Notiz im Archiv wieder her, um sie zu bearbeiten.</Text> : null}<MobileButton primary disabled={editor?.archived} label="Notiz speichern" icon="check" busy={busy} onPress={() => void save()} /><MobileButton label="Abbrechen" onPress={close} disabled={busy} /></View></>}>
      {editor ? <View pointerEvents={busy || editor.archived ? 'none' : 'auto'}><NoteFields draft={editor.draft} onChange={update} /></View> : null}
    </MobileSheet>
  </View>;
}

function NoteFields({ draft, onChange }: { draft: NoteDraft; onChange: (draft: NoteDraft) => void }) {
  const content = draft.content;
  const [tagsInput, setTagsInput] = useState(draft.tags.join(', '));
  const patch = (value: Partial<NoteDraft>) => onChange({ ...draft, ...value });
  const patchContent = (value: Partial<NoteDraft['content']>) => patch({ content: { ...content, ...value } });
  return <View style={m.stack}>
    <MobileField label="Titel" value={draft.title} maxLength={240} onChangeText={title => patch({ title })} />
    <MobileChips label="Kategorie" items={NOTE_CATEGORIES.map(item => ({ key: item.value, label: item.label }))} value={draft.category} onChange={category => patch({ category })} />
    <MobileChips label="Notizformat" items={NOTE_FORMATS.map(item => ({ key: item.value, label: item.label }))} value={draft.format} onChange={format => patch({ format })} />
    <MobileChips label="Bearbeitungsstand" items={NOTE_STATUSES.map(item => ({ key: item.value, label: item.label }))} value={draft.status} onChange={status => patch({ status })} />
    <MobileField label="Notiztext" multiline value={content.text} onChangeText={text => patchContent({ text })} maxLength={100000} style={{ minHeight: 180 }} />
    {draft.format === 'cornell' ? <><MobileField label="Stichworte und Fragen" multiline value={content.cues} onChangeText={cues => patchContent({ cues })} /><MobileField label="Zusammenfassung" multiline value={content.summary} onChangeText={summary => patchContent({ summary })} /></> : null}
    {content.fields.map(field => <MobileField key={field.id} label={field.label} value={field.value} multiline maxLength={5000} onChangeText={value => patchContent({ fields: content.fields.map(item => item.id === field.id ? { ...item, value } : item) })} />)}
    {draft.format === 'mindmap' || content.nodes.length ? <MobileCard><Text style={m.section}>Mindmap</Text><Svg width="100%" height={220} viewBox="0 0 1000 600" accessibilityLabel="Mindmap-Vorschau">{content.nodes.map(node => { const parent = content.nodes.find(item => item.id === node.parentId); return parent ? <Line key={`line-${node.id}`} x1={parent.x} y1={parent.y} x2={node.x} y2={node.y} stroke="#86ACD8" strokeWidth={3} /> : null; })}{content.nodes.map(node => <ViewNode key={node.id} x={node.x} y={node.y} label={node.text} />)}</Svg>{content.nodes.map(node => <MobileField key={node.id} label={node.parentId ? 'Unterthema' : 'Hauptthema'} value={node.text} maxLength={500} onChangeText={text => patchContent({ nodes: content.nodes.map(item => item.id === node.id ? { ...item, text } : item) })} />)}<MobileButton label="Thema hinzufügen" icon="plus" disabled={content.nodes.length >= 80} onPress={() => { const count = content.nodes.length; patchContent({ nodes: [...content.nodes, { id: randomUUID(), text: count ? 'Neues Thema' : draft.title || 'Hauptthema', parentId: content.nodes[0]?.id ?? null, x: count ? 160 + (count % 3) * 300 : 500, y: count ? 210 + (Math.floor((count - 1) / 3) % 3) * 140 : 70 }] }); }} /></MobileCard> : null}
    {draft.format === 'handwriting' || content.strokes.length ? <Handwriting strokes={content.strokes} onChange={strokes => patchContent({ strokes })} /> : null}
    <Text style={m.section}>Aufgaben</Text>{content.tasks.map(task => <MobileCard key={task.id}><MobileField label="Aufgabe" value={task.text} maxLength={2000} onChangeText={text => patchContent({ tasks: content.tasks.map(item => item.id === task.id ? { ...item, text } : item) })} /><MobileField label="Zuständig" value={task.assignee} maxLength={160} onChangeText={assignee => patchContent({ tasks: content.tasks.map(item => item.id === task.id ? { ...item, assignee } : item) })} /><MobileField label="Aufgabe fällig am (JJJJ-MM-TT)" value={task.dueDate} maxLength={10} onChangeText={dueDate => patchContent({ tasks: content.tasks.map(item => item.id === task.id ? { ...item, dueDate } : item) })} /><MobileChips label="Aufgabenstatus" items={NOTE_STATUSES.map(item => ({ key: item.value, label: item.label }))} value={task.status} onChange={status => patchContent({ tasks: content.tasks.map(item => item.id === task.id ? { ...item, status } : item) })} /><MobileButton label="Aufgabe entfernen" icon="x" compact onPress={() => patchContent({ tasks: content.tasks.filter(item => item.id !== task.id) })} /></MobileCard>)}
    <MobileButton label="Aufgabe hinzufügen" icon="plus" disabled={content.tasks.length >= 200} onPress={() => patchContent({ tasks: [...content.tasks, { id: randomUUID(), text: '', status: 'open', assignee: '', dueDate: '' }] })} />
    <Text style={m.section}>Quellen</Text>{content.sources.map(source => <MobileCard key={source.id}><MobileField label="Quelle" value={source.title} maxLength={240} onChangeText={title => patchContent({ sources: content.sources.map(item => item.id === source.id ? { ...item, title } : item) })} /><MobileField label="Link zur Quelle" autoCapitalize="none" keyboardType="url" value={source.url} maxLength={2048} onChangeText={url => patchContent({ sources: content.sources.map(item => item.id === source.id ? { ...item, url } : item) })} /><MobileButton label="Quelle entfernen" compact icon="x" onPress={() => patchContent({ sources: content.sources.filter(item => item.id !== source.id) })} /></MobileCard>)}
    <MobileButton label="Quelle hinzufügen" icon="plus" disabled={content.sources.length >= 100} onPress={() => patchContent({ sources: [...content.sources, { id: randomUUID(), title: '', url: '' }] })} />
    <MobileField label="Schlagwörter (durch Komma getrennt)" value={tagsInput} onChangeText={text => { setTagsInput(text); patch({ tags: text.split(',').map(tag => tag.trim()).filter(Boolean) }); }} />
    <MobileField label="Fällig am (JJJJ-MM-TT)" value={draft.dueDate} maxLength={10} onChangeText={dueDate => patch({ dueDate })} />
    <MobileButton label={draft.pinned ? 'Angeheftet' : 'Notiz anheften'} selected={draft.pinned} icon="bookmark" onPress={() => patch({ pinned: !draft.pinned })} />
  </View>;
}

function ViewNode({ x, y, label }: { x: number; y: number; label: string }) {
  return <><Rect x={x - 115} y={y - 26} width={230} height={52} rx={14} fill="#E8F2FF" stroke="#6A9DD7" strokeWidth={2} /><SvgText x={x} y={y + 7} textAnchor="middle" fontSize={22} fill="#173C69">{label.length > 19 ? label.slice(0, 18) + '…' : label}</SvgText></>;
}

function Handwriting({ strokes, onChange }: { strokes: NoteStroke[]; onChange: (strokes: NoteStroke[]) => void }) {
  const [drawing, setDrawing] = useState(false);
  const [pending, setPending] = useState<NoteStroke | null>(null);
  const [color, setColor] = useState('#173C69');
  const latest = useRef({ strokes, onChange, color, drawing }); latest.current = { strokes, onChange, color, drawing };
  const current = useRef<NoteStroke | null>(null);
  const size = useRef({ width: 1, height: 1 });
  const point = (x: number, y: number): [number, number] => [Math.round(Math.max(0, Math.min(1000, x / size.current.width * 1000))), Math.round(Math.max(0, Math.min(600, y / size.current.height * 600)))];
  const finish = () => {
    if (current.current) latest.current.onChange([...latest.current.strokes, current.current]);
    current.current = null; setPending(null);
  };
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => latest.current.drawing && latest.current.strokes.length < 500,
    onMoveShouldSetPanResponder: () => latest.current.drawing && latest.current.strokes.length < 500,
    onPanResponderGrant: event => { const { locationX, locationY } = event.nativeEvent; current.current = { id: randomUUID(), color: latest.current.color, width: 4, points: [point(locationX, locationY)] }; setPending(current.current); },
    onPanResponderMove: event => {
      if (!current.current || latest.current.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0) + current.current.points.length >= 30000) return;
      const { locationX, locationY } = event.nativeEvent;
      current.current = { ...current.current, points: [...current.current.points, point(locationX, locationY)] }; setPending(current.current);
    },
    onPanResponderRelease: finish, onPanResponderTerminate: finish,
  }), []);
  return <MobileCard><Text style={m.section}>Handschrift</Text><Text style={m.muted}>{drawing ? 'Zeichnen Sie auf dem Blatt. Zum Scrollen das Zeichnen beenden.' : 'Aktivieren Sie das Zeichnen, um mit Finger oder Stift zu schreiben.'}</Text>
    <View style={m.wrap}><MobileButton label={drawing ? 'Zeichnen beenden' : 'Zeichnen starten'} icon="edit-3" selected={drawing} onPress={() => setDrawing(!drawing)} /><MobileButton label="Letzten Strich entfernen" compact icon="corner-up-left" disabled={!strokes.length} onPress={() => onChange(strokes.slice(0, -1))} /></View>
    <View style={m.wrap}>{['#173C69', '#1569E8', '#AF2944', '#237C61'].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Stiftfarbe ${value}`} accessibilityState={{ selected: color === value }} onPress={() => setColor(value)} style={[styles.pen, { backgroundColor: value }, color === value && { borderColor: '#102B49', borderWidth: 3 }]} />)}</View>
    <View {...responder.panHandlers} onLayout={event => { size.current = event.nativeEvent.layout; }} style={styles.paper}>
      <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 1000 600">{[...strokes, ...(pending ? [pending] : [])].map(stroke => <Path key={stroke.id} d={stroke.points.length === 1 ? `M${stroke.points[0][0]},${stroke.points[0][1]} l0.1,0.1` : stroke.points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ')} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}</Svg>
    </View>
  </MobileCard>;
}

const styles = StyleSheet.create({ paper: { width: '100%', aspectRatio: 1000 / 600, borderWidth: 1, borderColor: '#C5D6EB', backgroundColor: '#FFFEF8', borderRadius: 12, overflow: 'hidden' }, pen: { width: 44, height: 44, borderRadius: 22, borderColor: '#D7E5F5', borderWidth: 1 } });
