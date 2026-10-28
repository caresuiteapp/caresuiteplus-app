// Generated native presentation from src/features/akademie/AcademyTemplateLibrary.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeSection,NativeP,NativeH2,NativeButton,NativeSpan,NativeStrong,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeArticle,NativeH3,NativeSmall,NativeOl,NativeLi,NativeDetails,NativeSummary} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ACADEMY_AUDIENCE_LABELS, type AcademyAudience, type AcademyCommandHandler, type AcademyContent, type AcademyReusableTemplate } from '@/lib/akademie/workspaceModel';
import { ACADEMY_TEMPLATES, createAcademyTemplate } from '@/lib/akademie/workspaceTemplates';
export type AcademyTemplateLibraryProps = {
    templates: AcademyReusableTemplate[];
    busy: boolean;
    onCommand: AcademyCommandHandler;
    onUseContent: (content: AcademyContent) => void;
    onEditTemplate: (template: AcademyReusableTemplate) => void;
    onCreateBlank: () => void;
    onCreateTemplate: () => void;
};
type CatalogItem = {
    key: string;
    title: string;
    description: string;
    category: string;
    content: AcademyContent;
    own: AcademyReusableTemplate | null;
};
const normalize = (value: string) => value.toLocaleLowerCase('de-DE').trim();
const lessonLabels = { text: 'Lesetext', video: 'Video', document: 'Dokument', quiz: 'Wissenscheck' };
export function AcademyTemplateLibrary({ templates, busy, onCommand, onUseContent, onEditTemplate, onCreateBlank, onCreateTemplate }: AcademyTemplateLibraryProps) {
    const [query, setQuery] = useState('');
    const [audience, setAudience] = useState<AcademyAudience | 'all'>('all');
    const [category, setCategory] = useState('all');
    const [source, setSource] = useState<'all' | 'builtin' | 'own' | 'archived'>('all');
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [confirmation, setConfirmation] = useState<{
        id: string;
        revision: number;
        action: 'archive_template' | 'restore_template';
    } | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const detailsRef = useRef<HTMLElement>(null);
    const confirmationRef = useRef<HTMLElement>(null);
    const builtins = useMemo<CatalogItem[]>(() => ACADEMY_TEMPLATES.filter(template => template.key !== 'blank').map(template => {
        const content = createAcademyTemplate(template.key);
        return { key: `builtin:${template.key}`, title: template.title, description: template.description, category: content.category, content, own: null };
    }), []);
    const all = [...builtins, ...templates.map((template): CatalogItem => ({ key: `own:${template.id}`, title: template.name, description: template.description,
            category: template.content.category || 'Allgemein', content: template.content, own: template }))];
    const categories = [...new Set(all.map(item => item.category))].sort((a, b) => a.localeCompare(b, 'de-DE'));
    const visible = all.filter(item => (source === 'archived' ? item.own?.status === 'archived' : item.own?.status !== 'archived')
        && (source !== 'builtin' || !item.own) && (source !== 'own' || Boolean(item.own))
        && (audience === 'all' || item.content.audiences.includes(audience)) && (category === 'all' || item.category === category)
        && normalize(`${item.title} ${item.description} ${item.category}`).includes(normalize(query)));
    const selected = visible.find(item => item.key === selectedKey) ?? null;
    const confirmedTemplate = templates.find(template => template.id === confirmation?.id) ?? null;
    const changedElsewhere = Boolean(confirmation && confirmedTemplate && confirmation.revision !== confirmedTemplate.revision);
    useEffect(() => { if (selectedKey)
        detailsRef.current?.focus(); }, [selectedKey]);
    useEffect(() => { if (confirmation)
        confirmationRef.current?.focus(); }, [confirmation]);
    const select = (key: string) => { setSelectedKey(key); setConfirmation(null); setError(null); };
    async function changeStatus() {
        if (!confirmation || !confirmedTemplate || busy || changedElsewhere)
            return;
        setError(null);
        setNotice(null);
        try {
            const result = await onCommand(confirmation.action, {}, { id: confirmation.id, revision: confirmation.revision });
            if (!result)
                return;
            setNotice(confirmation.action === 'archive_template' ? 'Die Vorlage wurde archiviert. Vorhandene Kurse bleiben erhalten.' : 'Die Vorlage kann wieder für neue Kurse verwendet werden.');
            setConfirmation(null);
            setSelectedKey(null);
        }
        catch {
            setError('Die Änderung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.');
        }
    }
    return <NativeDiv className="ac-template-library" aria-label="Kursvorlagen">
    <NativeSection className="ac-panel ac-template-intro"><NativeDiv className="ac-panel-header"><NativeDiv><NativeP className="ac-eyebrow">VORLAGEN & EIGENE INHALTE</NativeP><NativeH2 className="ac-section-title">Eine gute Grundlage für Ihren nächsten Kurs</NativeH2><NativeP className="ac-muted">Beginnen Sie mit einer Struktur oder Ihrer eigenen Vorlage. Jede Verwendung erzeugt einen eigenständigen Kursentwurf.</NativeP></NativeDiv><NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button primary" disabled={busy} onClick={onCreateBlank}>Eigenen Kurs erstellen</NativeButton><NativeButton type="button" className="ac-button" disabled={busy} onClick={onCreateTemplate}>Eigene Vorlage erstellen</NativeButton></NativeDiv></NativeDiv>
      <NativeDiv className="ac-template-summary"><NativeSpan><NativeStrong>{builtins.length}</NativeStrong> Strukturvorlagen</NativeSpan><NativeSpan><NativeStrong>{templates.filter(template => template.status === 'active').length}</NativeStrong> eigene Vorlagen</NativeSpan><NativeSpan>Eigene Vorlagen stehen den berechtigten Kursredakteuren Ihrer Einrichtung zur Verfügung.</NativeSpan></NativeDiv>
    </NativeSection>
    {notice && <NativeDiv className="ac-message" data-tone="success" role="status">{notice}</NativeDiv>}
    {error && <NativeDiv className="ac-message" data-tone="error" role="alert">{error}</NativeDiv>}
    <NativeSection className="ac-panel"><NativeDiv className="ac-toolbar ac-template-filters">
      <NativeLabel className="ac-field ac-search">Vorlagen suchen<NativeInput className="ac-input" type="search" value={query} disabled={busy} placeholder="Titel, Thema oder Beschreibung…" onChange={event => { setQuery(event.target.value); setSelectedKey(null); }}/></NativeLabel>
      <NativeLabel className="ac-field">Herkunft<NativeSelect className="ac-input" value={source} disabled={busy} onChange={event => { setSource(event.target.value as typeof source); setSelectedKey(null); }}><NativeOption value="all">Alle aktiven Vorlagen</NativeOption><NativeOption value="builtin">Strukturvorlagen</NativeOption><NativeOption value="own">Eigene Vorlagen</NativeOption><NativeOption value="archived">Archivierte Vorlagen</NativeOption></NativeSelect></NativeLabel>
      <NativeLabel className="ac-field">Vorlagen-Zielgruppe<NativeSelect className="ac-input" value={audience} disabled={busy} onChange={event => { setAudience(event.target.value as typeof audience); setSelectedKey(null); }}><NativeOption value="all">Alle Zielgruppen</NativeOption>{Object.entries(ACADEMY_AUDIENCE_LABELS).map(([value, label]) => <NativeOption key={value} value={value}>{label}</NativeOption>)}</NativeSelect></NativeLabel>
      <NativeLabel className="ac-field">Themenbereich<NativeSelect className="ac-input" value={category} disabled={busy} onChange={event => { setCategory(event.target.value); setSelectedKey(null); }}><NativeOption value="all">Alle Themen</NativeOption>{categories.map(value => <NativeOption key={value} value={value}>{value}</NativeOption>)}</NativeSelect></NativeLabel>
    </NativeDiv><NativeP className="ac-muted" role="status">{visible.length} {visible.length === 1 ? 'passende Vorlage' : 'passende Vorlagen'}</NativeP>
      {visible.length ? <NativeDiv className="ac-template-catalog">{visible.map((item, index) => <NativeArticle className="ac-template-tile" data-selected={selectedKey === item.key || undefined} key={item.key}>
        <NativeDiv className="ac-template-tile-top" data-tone={index % 4}><NativeSpan className="ac-eyebrow">{item.category}</NativeSpan><NativeSpan className="ac-status" data-tone={item.own?.status === 'archived' ? 'neutral' : item.own ? 'good' : 'neutral'}>{item.own?.status === 'archived' ? 'Archiviert' : item.own ? 'Eigene Vorlage' : 'Strukturvorlage'}</NativeSpan></NativeDiv>
        <NativeDiv className="ac-template-tile-content"><NativeH3>{item.title}</NativeH3><NativeP>{item.description || 'Eigene Kursstruktur zur Wiederverwendung.'}</NativeP><NativeSmall className="ac-muted">{item.content.lessons.length} Lektionen · {item.content.estimatedMinutes} Minuten</NativeSmall><NativeSmall className="ac-muted">{item.content.audiences.map(value => ACADEMY_AUDIENCE_LABELS[value]).join(' · ')}</NativeSmall>
          <NativeDiv className="ac-card-actions"><NativeButton type="button" className="ac-button subtle small" disabled={busy} aria-label={`Vorlage ansehen: ${item.title}`} aria-expanded={selectedKey === item.key} onClick={() => select(item.key)}>Vorlage ansehen</NativeButton>{item.own?.status !== 'archived' && <NativeButton type="button" className="ac-button small" disabled={busy} aria-label={`Als Kurs verwenden: ${item.title}`} onClick={() => onUseContent(item.content)}>Als Kurs verwenden</NativeButton>}</NativeDiv>
        </NativeDiv>
      </NativeArticle>)}</NativeDiv> : <NativeDiv className="ac-empty"><NativeH3>Keine passende Vorlage</NativeH3><NativeP>Ändern Sie die Filter oder erstellen Sie Ihre eigene Vorlage.</NativeP><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => { setQuery(''); setAudience('all'); setCategory('all'); setSource('all'); }}>Filter zurücksetzen</NativeButton></NativeDiv>}
    </NativeSection>
    {selected && <NativeSection ref={detailsRef} tabIndex={-1} className="ac-panel ac-template-detail" aria-label="Vorlagendetails"><NativeDiv className="ac-panel-header"><NativeDiv><NativeP className="ac-eyebrow">{selected.own ? 'VORLAGE IHRER EINRICHTUNG' : 'BEARBEITBARE STRUKTUR'}</NativeP><NativeH2 className="ac-section-title">{selected.title}</NativeH2><NativeP>{selected.description}</NativeP></NativeDiv><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => { setSelectedKey(null); setConfirmation(null); }}>Vorschau schließen</NativeButton></NativeDiv>
      <NativeDiv className="ac-badges"><NativeSpan className="ac-status">{selected.content.estimatedMinutes} Minuten</NativeSpan><NativeSpan className="ac-status">{selected.content.lessons.length} Lektionen</NativeSpan>{selected.content.mandatory && <NativeSpan className="ac-status" data-tone="attention">Verpflichtend</NativeSpan>}</NativeDiv>
      {selected.content.summary && <NativeP>{selected.content.summary}</NativeP>}
      <NativeOl className="ac-template-outline">{selected.content.lessons.map((lesson, index) => <NativeLi key={lesson.id}><NativeSpan className="ac-lesson-number">{String(index + 1).padStart(2, '0')}</NativeSpan><NativeDiv><NativeStrong>{lesson.title || 'Unbenannte Lektion'}</NativeStrong><NativeSpan className="ac-muted">{lessonLabels[lesson.kind]}{lesson.kind === 'quiz' ? ` · ${lesson.questions?.length ?? 0} ${lesson.questions?.length === 1 ? 'Frage' : 'Fragen'}` : ''}</NativeSpan>{lesson.body && <NativeDetails><NativeSummary>Inhalt ansehen</NativeSummary><NativeP className="ac-learning-body">{lesson.body}</NativeP></NativeDetails>}</NativeDiv></NativeLi>)}</NativeOl>
      {!selected.own && <NativeP className="ac-message" data-tone="info">Diese Vorlage liefert den Aufbau. Ergänzen Sie die Inhalte und prüfen Sie diese vor der Veröffentlichung.</NativeP>}
      <NativeDiv className="ac-card-actions">{selected.own?.status !== 'archived' && <NativeButton type="button" className="ac-button primary" disabled={busy} onClick={() => onUseContent(selected.content)}>Neuen Kurs aus dieser Vorlage erstellen</NativeButton>}{selected.own && selected.own.status === 'active' && <NativeButton type="button" className="ac-button" disabled={busy} onClick={() => onEditTemplate(selected.own!)}>Vorlage bearbeiten</NativeButton>}{selected.own && <NativeButton type="button" className={`ac-button ${selected.own.status === 'archived' ? '' : 'subtle'}`} disabled={busy} onClick={() => { setConfirmation({ id: selected.own!.id, revision: selected.own!.revision, action: selected.own!.status === 'archived' ? 'restore_template' : 'archive_template' }); setError(null); }}>{selected.own.status === 'archived' ? 'Vorlage wiederherstellen' : 'Vorlage archivieren'}</NativeButton>}</NativeDiv>
    </NativeSection>}
    {confirmation && <NativeSection ref={confirmationRef} tabIndex={-1} className="ac-panel" aria-label="Vorlagenstatus ändern"><NativeH2 className="ac-section-title">{confirmation.action === 'archive_template' ? 'Vorlage archivieren?' : 'Vorlage wiederherstellen?'}</NativeH2><NativeP>{confirmedTemplate?.name ?? 'Diese Vorlage ist nicht mehr verfügbar.'}</NativeP><NativeP className="ac-muted">{confirmation.action === 'archive_template' ? 'Die Vorlage steht anschließend im Archiv. Bereits daraus erstellte Kurse bleiben erhalten.' : 'Die Vorlage steht anschließend wieder für neue Kursentwürfe zur Verfügung.'}</NativeP>
      {changedElsewhere && <NativeP role="alert" className="ac-message" data-tone="error">Die Vorlage wurde inzwischen geändert. Schließen Sie diese Abfrage und prüfen Sie den aktuellen Stand.</NativeP>}
      <NativeDiv className="ac-card-actions"><NativeButton type="button" className={`ac-button ${confirmation.action === 'archive_template' ? 'danger' : 'primary'}`} disabled={busy || !confirmedTemplate || changedElsewhere} onClick={() => void changeStatus()}>{confirmation.action === 'archive_template' ? 'Jetzt archivieren' : 'Jetzt wiederherstellen'}</NativeButton><NativeButton type="button" className="ac-button subtle" disabled={busy} onClick={() => setConfirmation(null)}>Abbrechen</NativeButton></NativeDiv>
    </NativeSection>}
  </NativeDiv>;
}
