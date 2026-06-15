import type { ReleaseDetail } from '@/types/release';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type ReleaseDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildReleaseDetailKpis(detail: ReleaseDetail, mode: ColorMode = 'dark'): ReleaseDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const done = detail.checklist.filter((c) => c.done).length;
  const total = detail.checklist.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return [
    {
      id: 'env',
      label: 'Umgebung',
      value: detail.env,
      icon: '🌐',
      accentColor: colors.cyan,
    },
    {
      id: 'checklist',
      label: 'Checkliste',
      value: `${percent} %`,
      subValue: `${done}/${total} erledigt`,
      icon: '✅',
      accentColor: percent >= 80 ? colors.success : percent >= 50 ? colors.orange : colors.textMuted,
    },
    {
      id: 'version',
      label: 'Version',
      value: detail.manifest.appVersion,
      subValue: `Build ${detail.manifest.buildNumber}`,
      icon: '📦',
      accentColor: colors.violet,
    },
    {
      id: 'channel',
      label: 'Kanal',
      value: detail.manifest.channel,
      subValue: detail.manifest.gitCommit.slice(0, 7),
      icon: '🚀',
      accentColor: colors.orange,
    },
  ];
}
