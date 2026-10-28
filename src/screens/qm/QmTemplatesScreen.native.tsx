// Generated native presentation from src/screens/qm/QmTemplatesScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeStyle,NativeSection,NativeDiv,NativeSpan,NativeH2,NativeP,NativeLabel,NativeInput,NativeStrong,NativeHeader,NativeH3,NativeUl,NativeLi,NativeArticle,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { CatalogIcon } from "../../components/catalog/CatalogWorkspace.native.tsx";
import { QmSectionShell } from "../../components/qm/QmSectionShell.native.tsx";
import { QmDocumentState } from "../../components/qm/QmDocumentUi.native.tsx";
import { qmDocumentWorkspaceCss } from "../../components/qm/qmDocumentWorkspaceCss.native.ts";
import { DesktopCatalogArtwork } from "../../liquid-command/components/DesktopCatalogArtwork.tsx";
import { usePermissions } from '@/hooks/usePermissions';
import { CENTRAL_CATALOG_INDEX } from '@/data/seeds/documentCatalog/centralCatalogIndex';
import { documentCatalogRoute } from '@/lib/documents/documentRecommendations';
import { qmMatchesSearch } from "../../lib/qm/qmDocumentWorkspace.native.ts";
import type { CentralDocumentDefinition } from '@/types/documents/centralCatalog';
const templates = CENTRAL_CATALOG_INDEX.filter(item => item.categoryKey === 'qm' || item.categoryKey === 'hygiene');
/** This catalogue reuses the existing central definitions and editor, never the legacy demo-only QM template endpoint. */
export function QmTemplatesScreen() {
    const router = useRouter();
    const { can, check } = usePermissions();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('qm');
    const [selectedKey, setSelectedKey] = useState('');
    const [revision, setRevision] = useState(0);
    const [preview, setPreview] = useState<{
        key: string;
        data: CentralDocumentDefinition | null;
        error: string | null;
    } | null>(null);
    const previewRef = useRef<HTMLElement | null>(null);
    const returnFocus = useRef<HTMLButtonElement | null>(null);
    const canView = can('qm.view');
    const canCatalog = can('office.documents.view');
    const canPreview = canView && canCatalog && can('documents.preview');
    const canCreate = canView && canCatalog && can('documents.create');
    const visible = useMemo(() => templates.filter(item => (!category || item.categoryKey === category)
        && qmMatchesSearch(`${item.title} ${item.categoryName}`, search)), [category, search]);
    const selected = templates.find(item => item.key === selectedKey);
    const currentPreview = preview?.key === selectedKey ? preview : null;
    useEffect(() => {
        if (!selectedKey || !canPreview)
            return;
        let current = true;
        setPreview(null);
        void import('@/data/seeds/documentCatalog/centralCatalog').then(module => {
            if (!current)
                return;
            const data = module.findCentralDocument(selectedKey);
            setPreview({ key: selectedKey, data: data ?? null, error: data ? null : 'Die ausgewählte Vorlage ist nicht mehr im Katalog enthalten.' });
        }).catch(() => {
            if (current)
                setPreview({ key: selectedKey, data: null, error: 'Die Vorlagenvorschau konnte nicht geladen werden. Bitte erneut versuchen.' });
        });
        return () => { current = false; };
    }, [selectedKey, revision, canPreview]);
    useEffect(() => {
        if (!selectedKey || !canPreview)
            return;
        previewRef.current?.focus({ preventScroll: true });
        previewRef.current?.scrollIntoView({ block: 'nearest' });
    }, [selectedKey, canPreview]);
    function closePreview() {
        setSelectedKey('');
        requestAnimationFrame(() => { if (returnFocus.current?.isConnected)
            returnFocus.current.focus(); });
    }
    function openEditor(key?: string) {
        if (!canView || !canCatalog || (key && !canCreate))
            return;
        router.push(documentCatalogRoute({ module: 'office', workflow: 'quality', templateKey: key }) as never);
    }
    return <NativeWorkspaceStyleScope css={[qmDocumentWorkspaceCss, qmDocumentWorkspaceCss]}>{<QmSectionShell title="QM-Vorlagen" subtitle="Vorhandene Vorlagen für Qualität, Betriebsorganisation und Hygiene ansehen und im Dokumentenkatalog bearbeiten." actions={canView && canCatalog ? <NativeButton className="qm-button" type="button" onClick={() => openEditor()}>Dokumentenkatalog öffnen <CatalogIcon kind="arrow"/></NativeButton> : undefined}>
    <NativeStyle>{qmDocumentWorkspaceCss}</NativeStyle>
    {!canView ? <QmDocumentState title="Zugriff nicht freigegeben" message={check('qm.view').reason ?? 'Für QM-Vorlagen fehlt die Berechtigung.'}/> : <>
      <NativeSection className="qm-panel"><NativeDiv className="qm-panel-head"><NativeDiv><NativeSpan className="qm-eyebrow">Zentraler Vorlagenbestand</NativeSpan><NativeH2>{templates.length} Vorlagen für QM und Hygiene</NativeH2><NativeP>Eine gemeinsame Quelle. Ausgewählte Vorlagen öffnen sich direkt im bestehenden Dokumenteneditor.</NativeP></NativeDiv><DesktopCatalogArtwork route="/business/office/document-catalog" label="Dokumentenkatalog" size={76}/></NativeDiv><NativeDiv className="qmd-toolbar"><NativeLabel className="qmd-field qmd-field--search">Vorlagen suchen<NativeInput className="qmd-input" type="search" placeholder="Zum Beispiel Audit, Beschwerde oder Hygieneplan" value={search} onChange={event => setSearch(event.target.value)}/></NativeLabel><NativeDiv className="qmd-tabs" role="group" aria-label="Vorlagenbereich">{[['qm', 'Qualitätsmanagement'], ['hygiene', 'Hygiene'], ['', 'Alle']].map(([key, label]) => <NativeButton key={key} className="qm-button" type="button" aria-pressed={category === key} onClick={() => setCategory(key)}>{label}</NativeButton>)}</NativeDiv></NativeDiv><NativeDiv className="qmd-result"><NativeSpan role="status">{visible.length} passende Vorlagen</NativeSpan>{search ? <NativeButton className="qm-button" type="button" onClick={() => setSearch('')}>Suche zurücksetzen</NativeButton> : null}</NativeDiv></NativeSection>
      {!canCatalog ? <NativeDiv className="qm-notice" data-tone="warning"><NativeStrong>Dokumentenkatalog nicht freigegeben</NativeStrong><NativeP>Zum Öffnen und Bearbeiten benötigen Sie Zugriff auf Office-Dokumente.</NativeP></NativeDiv> : !canPreview || !canCreate ? <NativeDiv className="qm-notice" data-tone="warning"><NativeStrong>Eingeschränkte Dokumentenrechte</NativeStrong><NativeP>{!canPreview ? 'Die Vorschau ist für Ihr Konto nicht freigegeben. ' : ''}{!canCreate ? 'Neue Dokumententwürfe können mit Ihren aktuellen Rechten nicht erstellt werden.' : ''}</NativeP></NativeDiv> : null}
      {selected && canPreview ? <NativeSection className="qm-panel qmd-preview" aria-label={`Vorschau: ${selected.title}`} ref={previewRef} tabIndex={-1} onKeyDown={event => { if (event.key === 'Escape') {
                event.stopPropagation();
                closePreview();
            } }}><NativeHeader className="qm-panel-head"><NativeDiv><NativeSpan className="qm-eyebrow">Vorlagenvorschau</NativeSpan><NativeH2>{selected.title}</NativeH2></NativeDiv><NativeButton className="qm-button" type="button" aria-label="Vorlagenvorschau schließen" onClick={closePreview}>Schließen <NativeSpan aria-hidden="true">×</NativeSpan></NativeButton></NativeHeader>
        {!currentPreview ? <QmDocumentState title="Vorschau wird geladen" message="Der bestehende Vorlagentext wird geöffnet …"/> : currentPreview.error ? <QmDocumentState title="Vorschau nicht verfügbar" message={currentPreview.error} error><NativeButton className="qm-button" type="button" onClick={() => setRevision(value => value + 1)}>Erneut laden</NativeButton></QmDocumentState> : currentPreview.data ? <NativeDiv className="qmd-paper"><NativeDiv className="qm-notice" data-tone="warning"><NativeStrong>Vorlage zur individuellen Bearbeitung</NativeStrong><NativeP>Diese Vorschau enthält keine ausgefüllten Unternehmensdaten und ist kein freigegebenes QM-Dokument. {currentPreview.data.instructions}</NativeP></NativeDiv>{currentPreview.data.sections.map(section => <NativeSection key={section.key}><NativeH3>{section.heading}</NativeH3><NativeP>{section.text}</NativeP></NativeSection>)}<NativeH3>Angaben im Dokument</NativeH3><NativeUl>{currentPreview.data.fields.map(field => <NativeLi key={field.key}>{field.label}{field.required ? ' · Pflichtangabe' : ''}</NativeLi>)}</NativeUl></NativeDiv> : null}
        <NativeDiv className="qm-panel-footer"><NativeButton className="qm-button qm-button--primary" type="button" disabled={!canCreate} onClick={() => openEditor(selected.key)}>{selected.sourceMode === 'original' ? 'Originalunterlage im Katalog zuordnen' : 'Im Dokumentenkatalog bearbeiten'} <CatalogIcon kind="arrow"/></NativeButton></NativeDiv>
      </NativeSection> : null}
      {visible.length ? <NativeDiv className="qmd-grid">{visible.map(item => <NativeArticle className="qmd-template" key={item.key}><NativeDiv className="qmd-template-mark"><NativeSpan className="qmd-mark" aria-hidden="true"><CatalogIcon kind={item.categoryKey === 'hygiene' ? 'check' : 'book'}/></NativeSpan><NativeSpan>{item.categoryKey === 'hygiene' ? 'Hygiene' : 'Qualitätsmanagement'}</NativeSpan></NativeDiv><NativeH2>{item.title}</NativeH2><NativeP>{item.sourceMode === 'original' ? 'Vorhandene Originalunterlage mit Begleitblatt zuordnen.' : 'Mit eigenen Angaben ergänzen und als Dokumententwurf weiterbearbeiten.'}</NativeP><NativeDiv className="qm-actions"><NativeButton className="qm-button" type="button" disabled={!canPreview} onClick={event => { returnFocus.current = event.currentTarget; setSelectedKey(item.key); }}>Vorschau</NativeButton><NativeButton className="qm-button qm-button--primary" type="button" disabled={!canCreate} onClick={() => openEditor(item.key)}>{item.sourceMode === 'original' ? 'Zuordnen' : 'Bearbeiten'} <CatalogIcon kind="arrow"/></NativeButton></NativeDiv></NativeArticle>)}</NativeDiv> : <QmDocumentState title="Keine passende Vorlage" message="Ändern Sie den Suchbegriff oder wählen Sie einen anderen Vorlagenbereich."/>}
    </>}
  </QmSectionShell>}</NativeWorkspaceStyleScope>;
}
