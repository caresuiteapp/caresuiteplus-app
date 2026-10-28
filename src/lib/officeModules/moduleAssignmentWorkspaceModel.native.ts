// Generated native presentation from src/lib/officeModules/moduleAssignmentWorkspaceModel.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { ModuleAssignmentSection } from '@/lib/officeCore/types';
export type ModuleAssignmentSectionDefinition = {
    key: ModuleAssignmentSection;
    label: string;
    description: string;
    inventoryLabel: string;
    inventorySingularLabel: string;
    inventoryDescription: string;
    route: string;
    artworkRoute: string;
    emptyText: string;
    managementNote: string;
};
/** Inventory and explicit module relationships are separate, independently permitted sources. */
export const MODULE_ASSIGNMENT_SECTIONS: readonly ModuleAssignmentSectionDefinition[] = [
    {
        key: 'clients', label: 'Klient:innen-Zuordnung',
        description: 'Klientenakten und die Zuordnung zu Ihren Arbeitsbereichen.',
        inventoryLabel: 'Klientenakten', inventorySingularLabel: 'Klientenakte',
        inventoryDescription: 'Ihr Bestand in der Klientenverwaltung.',
        route: '/business/office/modules/clients', artworkRoute: '/business/office/modules/clients',
        emptyText: 'Es sind noch keine Klientenzuordnungen gespeichert. In der Klientenakte können Sie unter „Zugang & Freigaben“ die Arbeitsbereiche festlegen.',
        managementNote: 'Die Arbeitsbereiche einer Person verwalten Sie in ihrer Klientenakte unter „Zugang & Freigaben“. Entfernte Zuordnungen bleiben als inaktiv nachvollziehbar.',
    },
    {
        key: 'employees', label: 'Mitarbeitende-Zuordnung',
        description: 'Personalakten und die Zuordnungen Ihres Teams.',
        inventoryLabel: 'Personalakten', inventorySingularLabel: 'Personalakte',
        inventoryDescription: 'Ihr Bestand in der Personalverwaltung.',
        route: '/business/office/modules/employees', artworkRoute: '/business/office/modules/employees',
        emptyText: 'Es sind noch keine Mitarbeitenden-Zuordnungen gespeichert. Ihr Personalbestand wird unabhängig davon in der Personalverwaltung geführt.',
        managementNote: 'Diese Übersicht zeigt gespeicherte Modulzuordnungen. Persönliche Rollen und Zugriffe verwalten Sie in der jeweiligen Personalakte.',
    },
    {
        key: 'services', label: 'Leistungskatalog',
        description: 'Unternehmensleistungen, Preise und Modulzuordnungen.',
        inventoryLabel: 'Leistungen', inventorySingularLabel: 'Leistung',
        inventoryDescription: 'Leistungen aus dem Katalog Ihres Unternehmens.',
        route: '/business/office/modules/services', artworkRoute: '/business/office/catalogs',
        emptyText: 'Es sind noch keine Leistungen in dieser Zuordnungsübersicht gespeichert. Ihre Unternehmensleistungen und Preise finden Sie in „Kataloge“.',
        managementNote: 'Ihren Leistungskatalog und die Preise bearbeiten Sie in „Kataloge“. Darunter sehen Sie zusätzlich gespeicherte Verbindungen zu Arbeitsbereichen.',
    },
    {
        key: 'documents', label: 'Dokument-Sichtbarkeit',
        description: 'Aktenunterlagen und zusätzlich gespeicherte Sichtbarkeiten.',
        inventoryLabel: 'Aktenunterlagen', inventorySingularLabel: 'Aktenunterlage',
        inventoryDescription: 'Vorhandene Unterlagen in Ihren Akten.',
        route: '/business/office/modules/documents', artworkRoute: '/business/office/modules/documents',
        emptyText: 'Es sind noch keine Dokument-Sichtbarkeiten in dieser Übersicht gespeichert. Vorhandene Dateien finden Sie weiterhin in der Dokumentenablage.',
        managementNote: 'Die Übersicht zeigt gespeicherte Zuordnungen. Welche Unterlagen eine Person tatsächlich sehen darf, hängt zusätzlich von ihren Zugriffsrechten ab.',
    },
    {
        key: 'templates', label: 'Vorlagen-Zuordnung',
        description: 'Katalogvorlagen und ihre Verbindungen zu Arbeitsbereichen.',
        inventoryLabel: 'Katalogvorlagen', inventorySingularLabel: 'Katalogvorlage',
        inventoryDescription: 'Verfügbare Vorlagen im Dokumentenkatalog.',
        route: '/business/office/modules/templates', artworkRoute: '/business/office/modules/templates',
        emptyText: 'Es sind noch keine Vorlagenzuordnungen gespeichert. Standardvorlagen und eigene Vorlagen finden Sie im Dokumentenkatalog.',
        managementNote: 'Der Bestand zeigt Ihre verfügbaren Katalogvorlagen. Darunter werden zusätzlich gespeicherte Verbindungen zu Arbeitsbereichen aufgeführt.',
    },
    {
        key: 'permissions', label: 'Berechtigungsprofile',
        description: 'Rollenvorlagen und gespeicherte Modul-Berechtigungsprofile.',
        inventoryLabel: 'verfügbare Rollenvorlagen', inventorySingularLabel: 'verfügbare Rollenvorlage',
        inventoryDescription: 'Systemvorlagen und eigene Rollenvorlagen für Ihre Personalakten.',
        route: '/business/office/modules/permissions', artworkRoute: '/business/office/modules/permissions',
        emptyText: 'Es sind noch keine Modul-Berechtigungsprofile gespeichert. Die bestehenden Rollen und persönlichen Zugriffsrechte gelten weiterhin.',
        managementNote: 'Rollenvorlagen wählen Sie in der Personalakte unter „Rollen & Rechte“. Die angezeigte Anzahl beschreibt verfügbare Vorlagen. Persönliche Zugriffe und Modulprofile werden davon getrennt verwaltet.',
    },
    {
        key: 'billing', label: 'Abrechnungsquellen',
        description: 'Rechnungsbestand und zugeordnete Abrechnungsquellen.',
        inventoryLabel: 'Rechnungen', inventorySingularLabel: 'Rechnung',
        inventoryDescription: 'Ihr Bestand in der Rechnungsverwaltung.',
        route: '/business/office/modules/billing', artworkRoute: '/business/office/modules/billing',
        emptyText: 'Es sind noch keine Abrechnungsquellen zugeordnet. Ihre vorhandenen Rechnungen finden Sie in der Rechnungsverwaltung.',
        managementNote: 'Diese Übersicht zeigt die gespeicherten Quellen. Rechnungen erstellen, prüfen und bearbeiten Sie in der Rechnungsverwaltung.',
    },
];
export function moduleAssignmentSectionDefinition(section: ModuleAssignmentSection) {
    return MODULE_ASSIGNMENT_SECTIONS.find(item => item.key === section)!;
}
