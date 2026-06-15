import type { TIAuditEvent } from '@/types/modules/ti';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type TIAuditLogListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildTIAuditLogListKpis(items: TIAuditEvent[],
  totalCount: number, mode: ColorMode = 'dark'): TIAuditLogListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const consentEvents = items.filter(
    (e) => e.action === 'consent_granted' || e.action === 'consent_revoked',
  ).length;
  const exports = items.filter((e) => e.action === 'audit_export').length;
  const uniqueActors = new Set(items.map((e) => e.actorName)).size;

  return [
    {
      id: 'total',
      label: 'Ereignisse',
      value: String(totalCount),
      icon: '📋',
      accentColor: colors.cyan,
    },
    {
      id: 'consent',
      label: 'Einwilligungen',
      value: String(consentEvents),
      subValue: consentEvents > 0 ? 'Consent-Aktionen' : 'Keine Consent-Events',
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'actors',
      label: 'Akteure',
      value: String(uniqueActors),
      subValue: exports > 0 ? `${exports} Export(e)` : undefined,
      icon: '👤',
      accentColor: colors.violet,
    },
  ];
}
