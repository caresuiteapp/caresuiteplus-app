// Generated native presentation from src/components/office/PersonnelDocuments.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeLabel,NativeInput,NativeP,NativeArticle,NativeSpan,NativeH3,NativeButton,NativeSelect,NativeOption} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useId, useMemo, useState } from 'react';
import type { EmployeeDocumentCategory, EmployeeDocumentRecord } from '@/types/modules/employeePersonnelFile';
import { personnelDate } from "../../lib/office/personnelExperience.native.ts";
import { PersonnelIcon as Icon, PersonnelSection } from "./PersonnelPrimitives.native.tsx";
export const personnelDocumentCategories: {
    value: EmployeeDocumentCategory;
    label: string;
}[] = [
    { value: 'contract', label: 'Arbeitsvertrag' }, { value: 'agreement', label: 'Vereinbarung' },
    { value: 'privacy', label: 'Datenschutz' }, { value: 'confidentiality', label: 'Vertraulichkeit' },
    { value: 'briefing', label: 'Unterweisung' }, { value: 'background_check', label: 'Führungszeugnis' },
    { value: 'qualification', label: 'Qualifikation' }, { value: 'certificate', label: 'Bescheinigung' },
    { value: 'other', label: 'Weitere Unterlage' },
];
export function PersonnelDocuments({ documents, canEdit, busy, onUpload, onDownload, onDelete }: {
    documents: EmployeeDocumentRecord[];
    canEdit: boolean;
    busy: boolean;
    onUpload: (category: EmployeeDocumentCategory) => void;
    onDownload: (document: EmployeeDocumentRecord) => void;
    onDelete: (id: string) => void;
}) {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<EmployeeDocumentCategory>('other');
    const id = useId();
    const matches = useMemo(() => documents.filter(document => `${document.title} ${document.fileName}`.toLocaleLowerCase('de').includes(search.trim().toLocaleLowerCase('de'))), [documents, search]);
    return <>
    <PersonnelSection title="Unterlagen in der Akte"><NativeDiv className="pe-field"><NativeLabel htmlFor={id}>Dokument suchen</NativeLabel><NativeInput id={id} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Titel oder Dateiname"/></NativeDiv><NativeP style={{ margin: '14px 0' }} aria-live="polite">{matches.length} von {documents.length} Unterlagen</NativeP>
      {!matches.length ? <NativeP>{search ? 'Keine passende Unterlage gefunden.' : 'Noch keine Unterlagen hinterlegt. Laden Sie ein Dokument hoch oder erstellen Sie eine passende Vorlage.'}</NativeP> : matches.map(document => <NativeArticle className="pe-document" key={document.id}><NativeSpan className="pe-document-icon"><Icon name="document"/></NativeSpan><NativeDiv className="pe-document-copy"><NativeH3>{document.title}</NativeH3><NativeP>{document.fileName}</NativeP><NativeDiv className="pe-document-meta"><NativeSpan className="pe-badge">{personnelDocumentCategories.find(item => item.value === document.category)?.label ?? 'Personalunterlage'}</NativeSpan><NativeSpan className="pe-badge">{document.releasedToPortal ? 'Im Portal freigegeben' : 'Interne Unterlage'}</NativeSpan>{document.sensitive ? <NativeSpan className="pe-badge">Vertraulich</NativeSpan> : null}{document.validUntil ? <NativeSpan className="pe-badge">Gültig bis {personnelDate(document.validUntil)}</NativeSpan> : null}</NativeDiv></NativeDiv><NativeDiv className="pe-document-actions"><NativeButton className="pe-button" disabled={busy || !document.storagePath} onClick={() => onDownload(document)} aria-label={`${document.title} herunterladen`}><Icon name="import"/>Herunterladen</NativeButton>{canEdit && !document.storagePath?.includes('/central-documents/') ? <NativeButton className="pe-button pe-button--danger" disabled={busy} onClick={async () => { if (await confirmNativeWorkspaceAction(`„${document.title}“ aus der Personalakte löschen?`))
        onDelete(document.id); }} aria-label={`${document.title} löschen`}>Löschen</NativeButton> : null}</NativeDiv></NativeArticle>)}
    </PersonnelSection>
    {canEdit ? <PersonnelSection title="Unterlage hinzufügen" description="PDF, Bilder und Office-Dateien bis 20 MB. Neue Uploads bleiben zunächst intern."><NativeDiv className="pe-form-grid"><NativeDiv className="pe-field"><NativeLabel htmlFor={`${id}-category`}>Art der Unterlage</NativeLabel><NativeSelect id={`${id}-category`} value={category} disabled={busy} onChange={event => setCategory(event.target.value as EmployeeDocumentCategory)}>{personnelDocumentCategories.map(item => <NativeOption key={item.value} value={item.value}>{item.label}</NativeOption>)}</NativeSelect></NativeDiv><NativeDiv style={{ display: 'flex', alignItems: 'end' }}><NativeButton className="pe-button pe-button--primary" disabled={busy} onClick={() => onUpload(category)}><Icon name="plus"/>Datei auswählen & hochladen</NativeButton></NativeDiv></NativeDiv></PersonnelSection> : null}
  </>;
}
