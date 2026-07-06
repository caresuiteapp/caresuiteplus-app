import type { LegacyColors } from '@/design/tokens/themeBridge';
import type { PortalScope } from '@/types/portal';
import type { PortalTabHeroProps, PortalTabKind } from '@/components/portal/PortalTabHero';

type TabConfig = {
  title: string;
  icon: string;
  subtitle: string;
};

type ScopeConfig = {
  eyebrow: string;
  accent: string;
  tabs: Record<PortalTabKind, TabConfig>;
};

export type PortalTabHeroKpi = {
  id: string;
  label: string;
  icon: string;
  numericValue: number | null;
  fallbackLabel: string;
  subValue?: string;
  accentColor?: string;
};

export type PortalTabHeroContent = {
  title: string;
  subtitle: string;
  eyebrow: string;
  meta: string;
  kpis: PortalTabHeroKpi[];
};

const SCOPE_CONFIG = (colors: LegacyColors): Record<'portal_employee' | 'portal_client' | 'portal_family', ScopeConfig> => ({
  portal_employee: {
    eyebrow: 'MITARBEITERPORTAL',
    accent: colors.orange,
    tabs: {
      messages: {
        title: 'Nachrichten',
        icon: '✉️',
        subtitle: 'Mitteilungen vom Büro und Team — nach Portal-Freigabe.',
      },
      documents: {
        title: 'Dokumente',
        icon: '📄',
        subtitle: 'Freigegebene Unterlagen und Formulare für Ihre Einsätze.',
      },
      appointments: {
        title: 'Einsätze',
        icon: '📅',
        subtitle: 'Geplante Einsätze und Termine in Ihrer Sicht.',
      },
      signatures: {
        title: 'Unterschriften',
        icon: '✍️',
        subtitle: 'Dokumente zur digitalen Unterschrift vom Office.',
      },
    },
  },
  portal_client: {
    eyebrow: 'KLIENT:INNENPORTAL',
    accent: colors.cyan,
    tabs: {
      messages: {
        title: 'Nachrichten',
        icon: '✉️',
        subtitle: 'Chat mit der Verwaltung — Antworten nach Freigabe sichtbar.',
      },
      documents: {
        title: 'Dokumente',
        icon: '📄',
        subtitle: 'Freigegebene Dokumente und Nachweise für Sie.',
      },
      appointments: {
        title: 'Einsätze',
        icon: '📅',
        subtitle: 'Anstehende Einsätze und Besuche in Ihrer Übersicht.',
      },
      signatures: {
        title: 'Unterschriften',
        icon: '✍️',
        subtitle: 'Dokumente zur digitalen Unterschrift für Sie.',
      },
    },
  },
  portal_family: {
    eyebrow: 'ANGEHÖRIGENPORTAL',
    accent: colors.violet,
    tabs: {
      messages: {
        title: 'Nachrichten',
        icon: '✉️',
        subtitle: 'Mitteilungen zum Pflegefall — nur freigegebene Inhalte sichtbar.',
      },
      documents: {
        title: 'Dokumente',
        icon: '📄',
        subtitle: 'Freigegebene Unterlagen für Angehörige — nach Sichtbarkeitsregeln.',
      },
      appointments: {
        title: 'Termine',
        icon: '📅',
        subtitle: 'Termine und Besuche im Pflegefall — geteilte Sicht.',
      },
      signatures: {
        title: 'Unterschriften',
        icon: '✍️',
        subtitle: 'Dokumente zur digitalen Unterschrift.',
      },
    },
  },
});

function resolveScope(scope: PortalScope): 'portal_employee' | 'portal_client' | 'portal_family' {
  if (scope === 'portal_family') return 'portal_family';
  return scope === 'portal_client' ? 'portal_client' : 'portal_employee';
}

export function resolvePortalTabHeroContent(
  {
    tab,
    scope,
    totalCount,
    unreadCount = 0,
    activeCount = 0,
    restrictedCount = 0,
    titleOverride,
  }: PortalTabHeroProps,
  colors: LegacyColors,
): PortalTabHeroContent {
  const scopeKey = resolveScope(scope);
  const scopeConfig = SCOPE_CONFIG(colors)[scopeKey];
  const tabConfig = scopeConfig.tabs[tab];
  const title = titleOverride ?? tabConfig.title;
  const meta = `${totalCount} ${totalCount === 1 ? 'Eintrag' : 'Einträge'}`;

  const kpis: PortalTabHeroKpi[] =
    tab === 'messages'
      ? [
          {
            id: 'unread',
            label: 'Ungelesen',
            numericValue: unreadCount,
            fallbackLabel: 'Keine ungelesenen',
            icon: '📬',
            accentColor: scopeConfig.accent,
          },
          {
            id: 'total',
            label: 'Gesamt',
            numericValue: totalCount,
            fallbackLabel: 'Keine Nachrichten',
            icon: '✉️',
          },
        ]
      : tab === 'signatures'
        ? [
            {
              id: 'open',
              label: 'Offen',
              numericValue: totalCount,
              fallbackLabel: 'Keine offenen',
              icon: '✍️',
              accentColor: scopeConfig.accent,
            },
            {
              id: 'restricted',
              label: 'Dringend',
              numericValue: restrictedCount,
              fallbackLabel: 'Keine dringenden',
              icon: '⚠️',
              accentColor: colors.warning,
            },
          ]
        : tab === 'documents'
          ? [
              {
                id: 'total',
                label: 'Dokumente',
                numericValue: totalCount,
                fallbackLabel: 'Keine Dokumente',
                icon: '📄',
                accentColor: scopeConfig.accent,
              },
              {
                id: 'restricted',
                label: 'Eingeschränkt',
                numericValue: restrictedCount,
                fallbackLabel: 'Keine eingeschränkten',
                icon: '🔒',
                accentColor: colors.warning,
              },
            ]
          : [
              {
                id: 'active',
                label: 'Aktiv',
                numericValue: activeCount,
                fallbackLabel: 'Keine aktiven',
                icon: '✅',
                accentColor: colors.success,
              },
              {
                id: 'total',
                label: 'Gesamt',
                numericValue: totalCount,
                fallbackLabel: 'Keine Einsätze',
                icon: '📅',
                accentColor: scopeConfig.accent,
              },
            ];

  return {
    title,
    subtitle: tabConfig.subtitle,
    eyebrow: scopeConfig.eyebrow,
    meta,
    kpis,
  };
}
