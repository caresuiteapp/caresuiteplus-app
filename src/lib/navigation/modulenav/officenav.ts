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
        { key: 'time-tracking', label: 'Arbeitszeit', icon: '⏱️', href: '/business/office/time-tracking' },
        { key: 'time-tracking-live', label: 'Live-Mitarbeiter', icon: '🟢', href: '/business/office/time-tracking/live' },
        { key: 'time-tracking-requests', label: 'Mitarbeitenden Anträge', icon: '📝', href: '/business/office/time-tracking/requests' },
        { key: 'calendar', label: 'Kalender', icon: '📅', href: '/office/calendar' },
      ],
    },
    {
      title: 'Abrechnung & Dokumente',
      items: [
        { key: 'invoices', label: 'Rechnungen', icon: '🧾', href: '/office/invoices' },
        {
          key: 'documents-signatures',
          label: 'Dokumente & Unterschriften',
          icon: '✍️',
          href: '/business/office/documents/signatures',
        },
        { key: 'documents', label: 'Dokumentenablage', icon: '📁', href: '/office/documents' },
        { key: 'catalogs', label: 'Kataloge', icon: '📚', href: '/office/catalogs' },
      ],
    },
    {
      title: 'Kommunikation',
      items: [
        { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/office/messages?audience=employees&view=chats&chatAge=new' },
        {
          key: 'messages-clients',
          label: 'Klient:innen',
          icon: '👥',
          href: '/office/messages?audience=clients&view=chats&chatAge=new',
        },
        {
          key: 'messages-employees',
          label: 'Mitarbeitende',
          icon: '👤',
          href: '/office/messages?audience=employees&view=chats&chatAge=new',
        },
        {
          key: 'messages-internal',
          label: 'Intern',
          icon: '🏢',
          href: '/office/messages?audience=internal&view=chats&chatAge=new',
        },
        {
          key: 'broadcasts',
          label: 'Broadcasts',
          icon: '📢',
          href: '/office/messages?audience=employees&view=broadcasts',
        },
        { key: 'message-templates', label: 'Vorlagen', icon: '📝', href: '/office/messages/templates' },
        { key: 'message-settings', label: 'Einstellungen', icon: '⚙️', href: '/office/messages/settings' },
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
