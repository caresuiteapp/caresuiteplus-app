// Generated native presentation from src/components/office/PersonnelRecordLayout.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeStyle,NativeHeader,NativeSpan,NativeH1,NativeP,NativeButton,NativeI,NativeStrong,NativeSmall,NativeNav,NativeSection,NativeH2,NativeDl,NativeDt,NativeDd,NativeA,NativeTime,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useId, type KeyboardEvent, type ReactNode } from 'react';
import type { EmployeePersonnelFile, EmployeePersonnelOverview } from '@/types/modules/employeePersonnelFile';
import { labelEmploymentStatus, labelEmployeeDeployability, type PersonnelUiTabKey, resolvePersonnelBlockerActions, resolvePersonnelUiTab } from '@/lib/office/employeePersonnelLabels';
import { resolveEmployeeRoleLabel, resolveEmploymentTypeLabel } from '@/lib/office/employeeCatalogLabels';
import { personnelDate } from "../../lib/office/personnelExperience.native.ts";
import { personnelCss } from "./personnelCss.native.ts";
import { PersonnelIcon as Icon, type PersonnelIconName, PersonnelSection } from "./PersonnelPrimitives.native.tsx";
const sections: {
    key: PersonnelUiTabKey;
    label: string;
    description: string;
    icon: PersonnelIconName;
    group?: string;
}[] = [
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
    file: EmployeePersonnelFile;
    overview: EmployeePersonnelOverview;
    activeTab: PersonnelUiTabKey;
    onTabChange: (tab: PersonnelUiTabKey) => void;
    onEdit?: () => void;
    onPayroll?: () => void;
    onRefresh: () => void;
    refreshing: boolean;
    children: ReactNode;
    management: ReactNode;
}) {
    const id = useId();
    const section = sections.find(item => item.key === activeTab) ?? sections[0];
    const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : ['ArrowDown', 'ArrowRight'].includes(event.key) ? (index + 1) % sections.length : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? (index - 1 + sections.length) % sections.length : null;
        if (next === null)
            return;
        event.preventDefault();
        onTabChange(sections[next].key);
        document.getElementById(`${id}-${sections[next].key}`)?.focus();
    };
    const metrics: {
        label: string;
        value: string | number;
        icon: PersonnelIconName;
        tab: PersonnelUiTabKey;
    }[] = [
        { label: 'Unterlagen', value: file.documents.length, icon: 'document', tab: 'documents' },
        { label: 'Qualifikationen', value: file.qualifications.length, icon: 'shield', tab: 'qualifications' },
        { label: 'Offene Hinweise', value: overview.openTasks.length, icon: 'list', tab: 'deployability' },
        { label: 'Portalzugang', value: file.portalAccess.portalActive ? 'Aktiv' : 'Nicht aktiv', icon: 'person', tab: 'portal' },
    ];
    return <NativeWorkspaceStyleScope css={[personnelCss, personnelCss]}>{<NativeDiv className="pe-record">
    <NativeStyle>{personnelCss}</NativeStyle>
    <NativeHeader className="pe-hero"><NativeDiv><NativeSpan className="pe-eyebrow">Persönliche Personalakte</NativeSpan><NativeH1>{overview.fullName || 'Personalakte'}</NativeH1><NativeDiv className="pe-hero-meta"><NativeSpan className="pe-badge" data-active={overview.employmentStatus === 'active'}>{labelEmploymentStatus(overview.employmentStatus)}</NativeSpan><NativeSpan>{resolveEmployeeRoleLabel(overview.roleTitle)}</NativeSpan></NativeDiv><NativeP>Personalnummer {file.masterData.employeeNumber || 'noch nicht vergeben'}{file.masterData.city ? ` · ${file.masterData.city}` : ''}</NativeP><NativeDiv className="pe-hero-actions">{onEdit ? <NativeButton onClick={onEdit}><Icon name="edit"/>Stammdaten bearbeiten</NativeButton> : null}<NativeButton disabled={refreshing} onClick={onRefresh}><Icon name="refresh"/>{refreshing ? 'Wird geladen …' : 'Aktualisieren'}</NativeButton>{onPayroll ? <NativeButton onClick={onPayroll}><Icon name="clock"/>Arbeitszeit & Abrechnung</NativeButton> : null}</NativeDiv></NativeDiv><NativeDiv className="pe-folder-stage" aria-hidden="true"><NativeDiv className="pe-big-folder"><NativeDiv className="pe-big-folder-back"/><NativeDiv className="pe-big-folder-paper"><NativeI /><NativeI /><NativeI /><NativeI /></NativeDiv><NativeDiv className="pe-big-folder-front"><NativeStrong>{file.masterData.firstName.slice(0, 1)}{file.masterData.lastName.slice(0, 1)}</NativeStrong><NativeSpan>Personalakte</NativeSpan><NativeSmall>CARESUITE HEALTHOS</NativeSmall></NativeDiv></NativeDiv></NativeDiv></NativeHeader>
    <NativeDiv className="pe-metrics" aria-label="Zusammenfassung der Personalakte">{metrics.map(metric => <NativeButton key={metric.tab} onClick={() => onTabChange(metric.tab)}><Icon name={metric.icon}/><NativeSpan><NativeSmall>{metric.label}</NativeSmall><NativeStrong>{metric.value}</NativeStrong></NativeSpan></NativeButton>)}</NativeDiv>
    <NativeDiv className="pe-workspace"><NativeNav className="pe-nav" role="tablist" aria-label="Bereiche der Personalakte" aria-orientation="vertical">{sections.map((item, index) => <NativeDiv key={item.key} style={{ display: 'contents' }}>{item.group ? <NativeSpan className="pe-nav-group" role="presentation">{item.group}</NativeSpan> : null}<NativeButton role="tab" id={`${id}-${item.key}`} aria-selected={section.key === item.key} aria-controls={`${id}-panel`} tabIndex={section.key === item.key ? 0 : -1} onClick={() => onTabChange(item.key)} onKeyDown={event => onKey(event, index)}><Icon name={item.icon}/><NativeSpan>{item.label}</NativeSpan></NativeButton></NativeDiv>)}</NativeNav><NativeSection className="pe-content" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${section.key}`} tabIndex={0}><NativeDiv className="pe-content-heading"><NativeH2>{section.label}</NativeH2><NativeP>{section.description}</NativeP></NativeDiv>{children}</NativeSection></NativeDiv>
    {management}
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
export function PersonnelOverview({ file, overview, onTabChange, canEdit }: {
    file: EmployeePersonnelFile;
    overview: EmployeePersonnelOverview;
    onTabChange: (tab: PersonnelUiTabKey) => void;
    canEdit: boolean;
}) {
    const actions = resolvePersonnelBlockerActions(file.deployability);
    const fields = [['Beschäftigung', resolveEmploymentTypeLabel(file.employment.contractType)], ['Eintritt', personnelDate(file.masterData.entryDate)], ['Wochenstunden', file.employment.weeklyHours == null ? 'Nicht hinterlegt' : `${file.employment.weeklyHours.toLocaleString('de-DE')} Std.`], ['Einsatzfähigkeit', labelEmployeeDeployability(file.deployability.result)]];
    return <NativeWorkspaceStyleScope css={[personnelCss]}>{<NativeDiv className="pe-overview">
    <PersonnelSection title="Zusammenarbeit"><NativeDl>{fields.map(([label, value]) => <NativeDiv key={label}><NativeDt>{label}</NativeDt><NativeDd>{value}</NativeDd></NativeDiv>)}</NativeDl><NativeButton className="pe-text-button" onClick={() => onTabChange('employment')}>Beschäftigung öffnen<Icon name="arrow"/></NativeButton></PersonnelSection>
    <PersonnelSection title="Direkter Kontakt"><NativeDl><NativeDiv><NativeDt>E-Mail</NativeDt><NativeDd>{file.masterData.email ? <NativeA href={`mailto:${encodeURIComponent(file.masterData.email)}`}>{file.masterData.email}</NativeA> : 'Nicht hinterlegt'}</NativeDd></NativeDiv><NativeDiv><NativeDt>Telefon</NativeDt><NativeDd>{file.masterData.phone ? <NativeA href={`tel:${file.masterData.phone.replace(/[^\d+*#,;]/g, '')}`}>{file.masterData.phone}</NativeA> : 'Nicht hinterlegt'}</NativeDd></NativeDiv><NativeDiv><NativeDt>Adresse</NativeDt><NativeDd>{[file.masterData.street, file.masterData.houseNumber, file.masterData.postalCode, file.masterData.city].filter(Boolean).join(' ') || 'Nicht hinterlegt'}</NativeDd></NativeDiv></NativeDl><NativeButton className="pe-text-button" onClick={() => onTabChange('contact')}>Kontaktangaben öffnen<Icon name="arrow"/></NativeButton></PersonnelSection>
    <PersonnelSection title="Nächste Schritte" description={overview.openTasks.length ? 'Diese Angaben und Nachweise sollten geprüft werden.' : 'Aus den gespeicherten Angaben ergeben sich derzeit keine offenen Hinweise.'}><NativeDiv className="pe-action-list">{overview.openTasks.map((task, index) => <NativeP key={`${task}-${index}`}>{task}</NativeP>)}{canEdit ? actions.map(action => <NativeButton key={`${action.tab}-${action.label}`} onClick={() => onTabChange(resolvePersonnelUiTab(action.tab))}>{action.label}<Icon name="arrow"/></NativeButton>) : null}</NativeDiv></PersonnelSection>
    <PersonnelSection title="Fristen & Nachweise" description={overview.nextExpiryDates.length ? 'Die nächsten hinterlegten Gültigkeits- und Prüftermine.' : 'In den hinterlegten Unterlagen sind keine kommenden Fristen erfasst.'}>{overview.nextExpiryDates.map(item => <NativeDiv key={`${item.type}-${item.date}-${item.label}`} className="pe-deadline"><NativeSpan>{item.label}</NativeSpan><NativeTime dateTime={item.date}>{personnelDate(item.date)}</NativeTime></NativeDiv>)}<NativeButton className="pe-text-button" onClick={() => onTabChange('qualifications')}>Nachweise prüfen<Icon name="arrow"/></NativeButton></PersonnelSection>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
