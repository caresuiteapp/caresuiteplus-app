import type { ModuleNavConfig } from '@/types/navigation/platform';

export const officeNav: ModuleNavConfig = {
  moduleKey: 'office',
  label: 'Office',
  groups: [
    {
      title: 'Übersicht',
      items: [{ key: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/office' }],
    },
    {
      title: 'Klient:innen & Personal',
      items: [
        { key: 'clients', label: 'Klient:innen', icon: '👥', href: '/office/clients' },
        { key: 'employees', label: 'Mitarbeitende', icon: '👤', href: '/office/employees' },
        { key: 'appointments', label: 'Termine', icon: '📅', href: '/office/appointments' },
      ],
    },
    {
      title: 'Abrechnung & Dokumente',
      items: [
        { key: 'invoices', label: 'Rechnungen', icon: '🧾', href: '/office/invoices' },
        { key: 'documents', label: 'Dokumente', icon: '📁', href: '/office/documents' },
        { key: 'catalogs', label: 'Kataloge', icon: '📚', href: '/office/catalogs' },
      ],
    },
    {
      title: 'Organisation',
      items: [
        { key: 'qm', label: 'Qualitätsmanagement', icon: '✅', href: '/business/office/qm' },
        { key: 'reporting', label: 'Office Reporting', icon: '📈', href: '/business/office/reporting' },
        { key: 'inventory', label: 'Inventar', icon: '📦', href: '/business/office/inventory' },
      ],
    },
    {
      title: 'Zugänge',
      items: [
        {
          key: 'access',
          label: 'Benutzer & Portale',
          icon: '🔐',
          href: '/business/office/access',
          openInModal: true,
          modalKey: 'office.access',
        },
        { key: 'modules', label: 'Modulzuordnungen', icon: '🧩', href: '/business/office/modules' },
        { key: 'audit', label: 'Audit-Log', icon: '📋', href: '/business/office/audit-log' },
      ],
    },
  ],
};
