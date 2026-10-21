import type { ModuleAssignmentSection } from '@/lib/officeCore/types';

export type ModuleAssignmentSectionDefinition = {
  key: ModuleAssignmentSection;
  label: string;
  description: string;
  route: string;
  artworkRoute: string;
  emptyText: string;
  managementNote: string;
};

/** These are saved relationships, not totals from the separate Office catalogs. */
export const MODULE_ASSIGNMENT_SECTIONS: readonly ModuleAssignmentSectionDefinition[] = [
  {
    key: 'clients', label: 'Klient:innen-Zuordnung',
    description: 'Welche Klientinnen und Klienten welchen Arbeitsbereichen zugeordnet sind.',
    route: '/business/office/modules/clients', artworkRoute: '/business/office/modules/clients',
    emptyText: 'Es sind noch keine Klientenzuordnungen gespeichert. In der Klientenakte können Sie unter „Zugang & Freigaben“ die Arbeitsbereiche festlegen.',
    managementNote: 'Die Arbeitsbereiche einer Person verwalten Sie in ihrer Klientenakte unter „Zugang & Freigaben“. Entfernte Zuordnungen bleiben als inaktiv nachvollziehbar.',
  },
  {
    key: 'employees', label: 'Mitarbeitende-Zuordnung',
    description: 'Gespeicherte Zuordnungen Ihres Teams zu den Arbeitsbereichen.',
    route: '/business/office/modules/employees', artworkRoute: '/business/office/modules/employees',
    emptyText: 'Es sind noch keine Mitarbeitenden-Zuordnungen gespeichert. Ihr Personalbestand wird unabhängig davon in der Personalverwaltung geführt.',
    managementNote: 'Diese Übersicht zeigt gespeicherte Modulzuordnungen. Persönliche Rollen und Zugriffe verwalten Sie in der jeweiligen Personalakte.',
  },
  {
    key: 'services', label: 'Leistungskatalog',
    description: 'Gespeicherte Leistungen und Preise je Arbeitsbereich.',
    route: '/business/office/modules/services', artworkRoute: '/business/office/catalogs',
    emptyText: 'Es sind noch keine Leistungen in dieser Zuordnungsübersicht gespeichert. Ihre Unternehmensleistungen und Preise finden Sie in „Kataloge“.',
    managementNote: 'Die hier gespeicherten Modul-Leistungen sind eine separate Übersicht. Den Leistungskatalog und die Preise Ihres Unternehmens bearbeiten Sie in „Kataloge“.',
  },
  {
    key: 'documents', label: 'Dokument-Sichtbarkeit',
    description: 'Gespeicherte Sichtbarkeiten für Dokumente in Office, Modulen und Portalen.',
    route: '/business/office/modules/documents', artworkRoute: '/business/office/modules/documents',
    emptyText: 'Es sind noch keine Dokument-Sichtbarkeiten in dieser Übersicht gespeichert. Vorhandene Dateien finden Sie weiterhin in der Dokumentenablage.',
    managementNote: 'Die Übersicht zeigt gespeicherte Zuordnungen. Welche Unterlagen eine Person tatsächlich sehen darf, hängt zusätzlich von ihren Zugriffsrechten ab.',
  },
  {
    key: 'templates', label: 'Vorlagen-Zuordnung',
    description: 'Gespeicherte Verknüpfungen von Vorlagen mit den Arbeitsbereichen.',
    route: '/business/office/modules/templates', artworkRoute: '/business/office/modules/templates',
    emptyText: 'Es sind noch keine Vorlagenzuordnungen gespeichert. Standardvorlagen und eigene Vorlagen finden Sie im Dokumentenkatalog.',
    managementNote: 'Die Anzahl hier bezieht sich nur auf gespeicherte Modulzuordnungen. Sie ist nicht die Anzahl der verfügbaren Standardvorlagen im Dokumentenkatalog.',
  },
  {
    key: 'permissions', label: 'Berechtigungsprofile',
    description: 'Gespeicherte Lese-, Bearbeitungs- und Exportrechte je Arbeitsbereich.',
    route: '/business/office/modules/permissions', artworkRoute: '/business/office/modules/permissions',
    emptyText: 'Es sind noch keine Modul-Berechtigungsprofile gespeichert. Die bestehenden Rollen und persönlichen Zugriffsrechte gelten weiterhin.',
    managementNote: 'Gespeicherte Modulprofile ersetzen nicht die persönlichen Zugriffsrechte. Rollen und Rechte einer Person verwalten Sie in ihrer Personalakte.',
  },
  {
    key: 'billing', label: 'Abrechnungsquellen',
    description: 'Gespeicherte Verknüpfungen zu Rechnungen, Exporten und externen Quellen.',
    route: '/business/office/modules/billing', artworkRoute: '/business/office/modules/billing',
    emptyText: 'Es sind noch keine Abrechnungsquellen zugeordnet. Ihre vorhandenen Rechnungen finden Sie in der Rechnungsverwaltung.',
    managementNote: 'Diese Übersicht zeigt die gespeicherten Quellen. Rechnungen erstellen, prüfen und bearbeiten Sie in der Rechnungsverwaltung.',
  },
];

export function moduleAssignmentSectionDefinition(section: ModuleAssignmentSection) {
  return MODULE_ASSIGNMENT_SECTIONS.find(item => item.key === section)!;
}
