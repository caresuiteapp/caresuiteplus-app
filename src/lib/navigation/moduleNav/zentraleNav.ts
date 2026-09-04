import type { ModuleNavConfig } from '@/types/navigation/platform';

export const zentraleNav: ModuleNavConfig = {
  moduleKey: 'zentrale',
  label: 'Zentrale',
  groups: [
    {
      title: 'Übersicht',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: '📊', href: '/business' },
        { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/business/messages' },
        { key: 'reporting', label: 'Reporting', icon: '📈', href: '/business/reporting' },
      ],
    },
    {
      title: 'Organisation',
      items: [
        { key: 'modules', label: 'Module & Lizenzen', icon: '🧩', href: '/business/modules' },
        {
          key: 'google-workspace',
          label: 'Google Workspace',
          icon: '☁️',
          href: '/business/connect/google-workspace',
        },
        { key: 'connect', label: 'Connect & Integrationen', icon: '🔌', href: '/business/connect' },
        { key: 'subscription', label: 'Abonnement', icon: '💳', href: '/business/subscription' },
      ],
    },
    {
      title: 'Insight & QM',
      items: [
        { key: 'insight', label: 'InsightCenter', icon: '📊', href: '/insight' },
        { key: 'qm', label: 'Qualitätsmanagement', icon: '✅', href: '/business/qm' },
        { key: 'ops', label: 'Betrieb & Monitoring', icon: '🛰️', href: '/business/ops' },
      ],
    },
  ],
};
