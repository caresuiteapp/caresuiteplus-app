import type { ModuleNavConfig } from '@/types/navigation/platform';

export const adminNav: ModuleNavConfig = {
  moduleKey: 'admin',
  label: 'Admin',
  groups: [
    {
      title: 'Mandant',
      items: [
        {
          key: 'tenant',
          label: 'Mandant & Unternehmensdaten',
          icon: '🏢',
          href: '/settings/tenant',
          openInModal: true,
          modalKey: 'settings.tenant',
        },
        {
          key: 'settings',
          label: 'Einstellungen',
          icon: '⚙️',
          href: '/settings',
          openInModal: true,
          modalKey: 'settings.profile',
        },
      ],
    },
    {
      title: 'Benutzer & Sicherheit',
      items: [
        {
          key: 'users',
          label: 'Benutzer & Rollen',
          icon: '👤',
          href: '/business/office/access',
          openInModal: true,
          modalKey: 'office.access',
        },
        { key: 'security', label: 'Sicherheit', icon: '🔒', href: '/business/security/list' },
        {
          key: 'data-request',
          label: 'Betroffenenrechte',
          icon: '📋',
          href: '/settings/data-request',
          openInModal: true,
          modalKey: 'settings.data-request',
        },
      ],
    },
    {
      title: 'Module & Lizenzen',
      items: [
        { key: 'modules', label: 'Module & Lizenzen', icon: '🧩', href: '/business/modules' },
        { key: 'subscription', label: 'Abonnement', icon: '💳', href: '/business/subscription' },
      ],
    },
    {
      title: 'Vorlagen',
      items: [
        { key: 'templates', label: 'Systemvorlagen', icon: '📄', href: '/business/templates' },
        { key: 'documents', label: 'Dokumentenvorlagen', icon: '📝', href: '/business/templates/document-templates' },
      ],
    },
    {
      title: 'Schnittstellen & System',
      items: [
        { key: 'connect', label: 'Schnittstellen', icon: '🔌', href: '/business/connect' },
        { key: 'integrations', label: 'Integrationen', icon: '🔗', href: '/business/integrations' },
        { key: 'ops', label: 'System & Monitoring', icon: '🛰️', href: '/business/ops' },
      ],
    },
  ],
};
