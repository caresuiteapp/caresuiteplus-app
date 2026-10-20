import { useId, useMemo, useState } from 'react';
import type { EmployeeDocumentCategory, EmployeeDocumentRecord } from '@/types/modules/employeePersonnelFile';
import { personnelDate } from '@/lib/office/personnelExperience.web';
import { PersonnelIcon as Icon, PersonnelSection } from './PersonnelPrimitives.web';

export const personnelDocumentCategories: { value: EmployeeDocumentCategory; label: string }[] = [
  { value: 'contract', label: 'Arbeitsvertrag' }, { value: 'agreement', label: 'Vereinbarung' },
  { value: 'privacy', label: 'Datenschutz' }, { value: 'confidentiality', label: 'Vertraulichkeit' },
  { value: 'briefing', label: 'Unterweisung' }, { value: 'background_check', label: 'Führungszeugnis' },
  { value: 'qualification', label: 'Qualifikation' }, { value: 'certificate', label: 'Bescheinigung' },
  { value: 'other', label: 'Weitere Unterlage' },
];
export function PersonnelDocuments({ documents, canEdit, busy, onUpload, onDownload, onDelete }: {
  documents: EmployeeDocumentRecord[]; canEdit: boolean; busy: boolean;
  onUpload: (category: EmployeeDocumentCategory) => void; onDownload: (document: EmployeeDocumentRecord) => void; onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState(''); const [category, setCategory] = useState<EmployeeDocumentCategory>('other'); const id = useId();
  const matches = useMemo(() => documents.filter(document => `${document.title} ${document.fileName}`.toLocaleLowerCase('de').includes(search.trim().toLocaleLowerCase('de'))), [documents, search]);
  return <>
    <PersonnelSection title="Unterlagen in der Akte"><div className="pe-field"><label htmlFor={id}>Dokument suchen</label><input id={id} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Titel oder Dateiname" /></div><p style={{ margin: '14px 0' }} aria-live="polite">{matches.length} von {documents.length} Unterlagen</p>
      {!matches.length ? <p>{search ? 'Keine passende Unterlage gefunden.' : 'Noch keine Unterlagen hinterlegt. Laden Sie ein Dokument hoch oder erstellen Sie eine passende Vorlage.'}</p> : matches.map(document => <article className="pe-document" key={document.id}><span className="pe-document-icon"><Icon name="document" /></span><div className="pe-document-copy"><h3>{document.title}</h3><p>{document.fileName}</p><div className="pe-document-meta"><span className="pe-badge">{personnelDocumentCategories.find(item => item.value === document.category)?.label ?? 'Personalunterlage'}</span><span className="pe-badge">{document.releasedToPortal ? 'Im Portal freigegeben' : 'Interne Unterlage'}</span>{document.sensitive ? <span className="pe-badge">Vertraulich</span> : null}{document.validUntil ? <span className="pe-badge">Gültig bis {personnelDate(document.validUntil)}</span> : null}</div></div><div className="pe-document-actions"><button className="pe-button" disabled={busy || !document.storagePath} onClick={() => onDownload(document)} aria-label={`${document.title} herunterladen`}><Icon name="import" />Herunterladen</button>{canEdit && !document.storagePath?.includes('/central-documents/') ? <button className="pe-button pe-button--danger" disabled={busy} onClick={() => { if (window.confirm(`„${document.title}“ aus der Personalakte löschen?`)) onDelete(document.id); }} aria-label={`${document.title} löschen`}>Löschen</button> : null}</div></article>)}
    </PersonnelSection>
    {canEdit ? <PersonnelSection title="Unterlage hinzufügen" description="PDF, Bilder und Office-Dateien bis 20 MB. Neue Uploads bleiben zunächst intern."><div className="pe-form-grid"><div className="pe-field"><label htmlFor={`${id}-category`}>Art der Unterlage</label><select id={`${id}-category`} value={category} disabled={busy} onChange={event => setCategory(event.target.value as EmployeeDocumentCategory)}>{personnelDocumentCategories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div style={{ display: 'flex', alignItems: 'end' }}><button className="pe-button pe-button--primary" disabled={busy} onClick={() => onUpload(category)}><Icon name="plus" />Datei auswählen & hochladen</button></div></div></PersonnelSection> : null}
  </>;
}
