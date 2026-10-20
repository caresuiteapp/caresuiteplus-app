import type { IntegrationProviderListItem } from '@/types/modules/integrations';
import { INTEGRATION_CATEGORY_LABELS } from '@/types/modules/integrations';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type IntegrationDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  then.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - then.getTime()) / 86_400_000));
}

export function buildIntegrationDetailKpis(integration: IntegrationProviderListItem, mode: ColorMode = 'dark'): IntegrationDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const hasSecret = !!integration.secretReference?.trim();
  const hasWebhook = !!integration.webhookUrl?.trim();
  const syncDays = daysSince(integration.lastSyncAt);

  return [
    {
      id: 'category',
      label: 'Kategorie',
      value: INTEGRATION_CATEGORY_LABELS[integration.category],
      subValue: integration.providerKey,
      icon: '🏷️',
      accentColor: colors.cyan,
    },
    {
      id: 'vault',
      label: 'Vault',
      value: hasSecret ? 'Referenz' : '—',
      subValue: hasSecret ? 'Secret hinterlegt' : 'Nicht konfiguriert',
      icon: '🔐',
      accentColor: hasSecret ? colors.success : colors.textMuted,
    },
    {
      id: 'webhook',
      label: 'Webhook',
      value: hasWebhook ? 'Ja' : 'Nein',
      icon: '🔗',
      accentColor: hasWebhook ? colors.violet : colors.textMuted,
    },
    {
      id: 'sync',
      label: 'Letzter Sync',
      value: formatShortDate(integration.lastSyncAt),
      subValue: syncDays != null ? `vor ${syncDays} Tagen` : 'Noch nie',
      icon: '🔄',
      accentColor: syncDays != null && syncDays <= 7 ? colors.success : colors.orange,
    },
  ];
}
