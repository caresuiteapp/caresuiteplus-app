import { useId, type KeyboardEvent, type ReactNode } from 'react';
import type { EmployeePersonnelFile, EmployeePersonnelOverview } from '@/types/modules/employeePersonnelFile';
import { labelEmploymentStatus, labelEmployeeDeployability, type PersonnelUiTabKey, resolvePersonnelBlockerActions, resolvePersonnelUiTab } from '@/lib/office/employeePersonnelLabels';
import { resolveEmployeeRoleLabel, resolveEmploymentTypeLabel } from '@/lib/office/employeeCatalogLabels';
import { personnelDate } from '@/lib/office/personnelExperience.web';
import { personnelCss } from './personnelCss.web';
import { PersonnelIcon as Icon, type PersonnelIconName, PersonnelSection } from './PersonnelPrimitives.web';

const sections: { key: PersonnelUiTabKey; label: string; description: string; icon: PersonnelIconName; group?: string }[] = [
  { key: 'overview', label: 'Auf einen Blick', description: 'Beschäftigung, offene Angaben und nächste Schritte.', icon: 'grid', group: 'Die Person' },
  { key: 'master_data', label: 'Stammdaten', description: 'Persönliche Angaben und Zuordnung im Unternehmen.', icon: 'person' },
  { key: 'contact', label: 'Kontakt & Mobilität', description: 'Erreichbarkeit, Notfallkontakt und Verkehrsmittel.', icon: 'phone' },
  { key: 'employment', label: 'Beschäftigung', description: 'Vertrag, Eintritt, Arbeitsumfang und Beschäftigungsstatus.', icon: 'briefcase', group: 'Zusammenarbeit' },
  { key: 'compensation', label: 'Vergütung & Bank', description: 'Vergütungsvereinbarungen und Bankverbindung.', icon: 'briefcase' },
  { key: 'tax_social', label: 'Steuer & Versicherung', description: 'Angaben für Lohnabrechnung und Sozialversicherung.', icon: 'document' },
  { key: 'secondary_employment', label: 'Weitere Beschäftigungen', description: 'Nebenbeschäftigungen und zugehörige Angaben.', icon: 'briefcase' },
  { key: 'qualifications', label: 'Qualifikationen', description: 'Fachliche Nachweise, Führungszeugnis und Gültigkeit.', icon: 'shield' },
  { key: 'documents', label: 'Dokumente & Nachweise', description: 'Verträge, Bescheinigungen und Unterlagen in dieser Akte.', icon: 'folder' },
  { key: 'logbook', label: 'Fahrtenbuch', description: 'Fahrten und zurückgelegte Strecken nachvollziehen.', icon: 'clock' },
  { key: 'deployability', label: 'Einsatzfähigkeit', description: 'Voraussetzungen und offene Prüfpunkte für Einsätze.', icon: 'check' },
  { key: 'work_materials', label: 'Arbeitsmittel', description: 'Ausgabe und Rückgabe der zugeordneten Arbeitsmittel.', icon: 'briefcase' },
  { key: 'portal', label: 'Portalzugang', description: 'Persönlichen Zugang zum Mitarbeitendenportal verwalten.', icon: 'shield', group: 'Zugriff & Verlauf' },
  { key: 'roles_permissions', label: 'Aufgaben & Rechte', description: 'Festlegen, welche Bereiche diese Person nutzen darf.', icon: 'person' },
  { key: 'audit', label: 'Änderungsverlauf', description: 'Gespeicherte Änderungen der Personalakte nachvollziehen.', icon: 'clock' },
];

export function PersonnelRecordLayout({ file, overview, activeTab, onTabChange, onEdit, onPayroll, onRefresh, refreshing, children, management }: {
  file: EmployeePersonnelFile; overview: EmployeePersonnelOverview; activeTab: PersonnelUiTabKey;
  onTabChange: (tab: PersonnelUiTabKey) => void; onEdit?: () => void; onPayroll?: () => void; onRefresh: () => void;
  refreshing: boolean; children: ReactNode; management: ReactNode;
}) {
  const id = useId();
  const section = sections.find(item => item.key === activeTab) ?? sections[0];
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : ['ArrowDown', 'ArrowRight'].includes(event.key) ? (index + 1) % sections.length : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? (index - 1 + sections.length) % sections.length : null;
    if (next === null) return;
    event.preventDefault(); onTabChange(sections[next].key);
    document.getElementById(`${id}-${sections[next].key}`)?.focus();
  };
  const metrics: { label: string; value: string | number; icon: PersonnelIconName; tab: PersonnelUiTabKey }[] = [
    { label: 'Unterlagen', value: file.documents.length, icon: 'document', tab: 'documents' },
    { label: 'Qualifikationen', value: file.qualifications.length, icon: 'shield', tab: 'qualifications' },
    { label: 'Offene Hinweise', value: overview.openTasks.length, icon: 'list', tab: 'deployability' },
    { label: 'Portalzugang', value: file.portalAccess.portalActive ? 'Aktiv' : 'Nicht aktiv', icon: 'person', tab: 'portal' },
  ];
  return <div className="pe-record">
    <style>{personnelCss}</style>
    <header className="pe-hero"><div><span className="pe-eyebrow">Persönliche Personalakte</span><h1>{overview.fullName || 'Personalakte'}</h1><div className="pe-hero-meta"><span className="pe-badge" data-active={overview.employmentStatus === 'active'}>{labelEmploymentStatus(overview.employmentStatus)}</span><span>{resolveEmployeeRoleLabel(overview.roleTitle)}</span></div><p>Personalnummer {file.masterData.employeeNumber || 'noch nicht vergeben'}{file.masterData.city ? ` · ${file.masterData.city}` : ''}</p><div className="pe-hero-actions">{onEdit ? <button onClick={onEdit}><Icon name="edit" />Stammdaten bearbeiten</button> : null}<button disabled={refreshing} onClick={onRefresh}><Icon name="refresh" />{refreshing ? 'Wird geladen …' : 'Aktualisieren'}</button>{onPayroll ? <button onClick={onPayroll}><Icon name="clock" />Arbeitszeit & Abrechnung</button> : null}</div></div><div className="pe-folder-stage" aria-hidden="true"><div className="pe-big-folder"><div className="pe-big-folder-back" /><div className="pe-big-folder-paper"><i /><i /><i /><i /></div><div className="pe-big-folder-front"><strong>{file.masterData.firstName.slice(0, 1)}{file.masterData.lastName.slice(0, 1)}</strong><span>Personalakte</span><small>CARESUITE HEALTHOS</small></div></div></div></header>
    <div className="pe-metrics" aria-label="Zusammenfassung der Personalakte">{metrics.map(metric => <button key={metric.tab} onClick={() => onTabChange(metric.tab)}><Icon name={metric.icon} /><span><small>{metric.label}</small><strong>{metric.value}</strong></span></button>)}</div>
    <div className="pe-workspace"><nav className="pe-nav" role="tablist" aria-label="Bereiche der Personalakte" aria-orientation="vertical">{sections.map((item, index) => <div key={item.key} style={{ display: 'contents' }}>{item.group ? <span className="pe-nav-group" role="presentation">{item.group}</span> : null}<button role="tab" id={`${id}-${item.key}`} aria-selected={section.key === item.key} aria-controls={`${id}-panel`} tabIndex={section.key === item.key ? 0 : -1} onClick={() => onTabChange(item.key)} onKeyDown={event => onKey(event, index)}><Icon name={item.icon} /><span>{item.label}</span></button></div>)}</nav><section className="pe-content" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${section.key}`} tabIndex={0}><div className="pe-content-heading"><h2>{section.label}</h2><p>{section.description}</p></div>{children}</section></div>
    {management}
  </div>;
}

export function PersonnelOverview({ file, overview, onTabChange, canEdit }: { file: EmployeePersonnelFile; overview: EmployeePersonnelOverview; onTabChange: (tab: PersonnelUiTabKey) => void; canEdit: boolean }) {
  const actions = resolvePersonnelBlockerActions(file.deployability);
  const fields = [['Beschäftigung', resolveEmploymentTypeLabel(file.employment.contractType)], ['Eintritt', personnelDate(file.masterData.entryDate)], ['Wochenstunden', file.employment.weeklyHours == null ? 'Nicht hinterlegt' : `${file.employment.weeklyHours.toLocaleString('de-DE')} Std.`], ['Einsatzfähigkeit', labelEmployeeDeployability(file.deployability.result)]];
  return <div className="pe-overview">
    <PersonnelSection title="Zusammenarbeit"><dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><button className="pe-text-button" onClick={() => onTabChange('employment')}>Beschäftigung öffnen<Icon name="arrow" /></button></PersonnelSection>
    <PersonnelSection title="Direkter Kontakt"><dl><div><dt>E-Mail</dt><dd>{file.masterData.email ? <a href={`mailto:${encodeURIComponent(file.masterData.email)}`}>{file.masterData.email}</a> : 'Nicht hinterlegt'}</dd></div><div><dt>Telefon</dt><dd>{file.masterData.phone ? <a href={`tel:${file.masterData.phone.replace(/[^\d+*#,;]/g, '')}`}>{file.masterData.phone}</a> : 'Nicht hinterlegt'}</dd></div><div><dt>Adresse</dt><dd>{[file.masterData.street, file.masterData.houseNumber, file.masterData.postalCode, file.masterData.city].filter(Boolean).join(' ') || 'Nicht hinterlegt'}</dd></div></dl><button className="pe-text-button" onClick={() => onTabChange('contact')}>Kontaktangaben öffnen<Icon name="arrow" /></button></PersonnelSection>
    <PersonnelSection title="Nächste Schritte" description={overview.openTasks.length ? 'Diese Angaben und Nachweise sollten geprüft werden.' : 'Aus den gespeicherten Angaben ergeben sich derzeit keine offenen Hinweise.'}><div className="pe-action-list">{overview.openTasks.map((task, index) => <p key={`${task}-${index}`}>{task}</p>)}{canEdit ? actions.map(action => <button key={`${action.tab}-${action.label}`} onClick={() => onTabChange(resolvePersonnelUiTab(action.tab))}>{action.label}<Icon name="arrow" /></button>) : null}</div></PersonnelSection>
    <PersonnelSection title="Fristen & Nachweise" description={overview.nextExpiryDates.length ? 'Die nächsten hinterlegten Gültigkeits- und Prüftermine.' : 'In den hinterlegten Unterlagen sind keine kommenden Fristen erfasst.'}>{overview.nextExpiryDates.map(item => <div key={`${item.type}-${item.date}-${item.label}`} className="pe-deadline"><span>{item.label}</span><time dateTime={item.date}>{personnelDate(item.date)}</time></div>)}<button className="pe-text-button" onClick={() => onTabChange('qualifications')}>Nachweise prüfen<Icon name="arrow" /></button></PersonnelSection>
  </div>;
}
