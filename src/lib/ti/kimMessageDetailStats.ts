import type { KIMMessageDetail } from '@/types/modules/ti';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type KimMessageDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

function formatShortDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function buildKimMessageDetailKpis(message: KIMMessageDetail, mode: ColorMode = 'dark'): KimMessageDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const attachmentCount = message.attachments.length;
  const pendingImports = message.attachments.filter((a) => a.importStatus === 'pending').length;
  const totalBytes = message.attachments.reduce((sum, a) => sum + a.sizeBytes, 0);

  return [
    {
      id: 'received',
      label: 'Empfangen',
      value: formatShortDateTime(message.receivedAt),
      subValue: message.senderName ?? message.sender,
      icon: '📥',
      accentColor: colors.cyan,
    },
    {
      id: 'attachments',
      label: 'Anhänge',
      value: String(attachmentCount),
      subValue: attachmentCount === 1 ? 'Datei' : 'Dateien',
      icon: '📎',
      accentColor: attachmentCount > 0 ? colors.violet : colors.textMuted,
    },
    {
      id: 'size',
      label: 'Größe',
      value: attachmentCount > 0 ? formatSize(totalBytes) : '—',
      icon: '💾',
      accentColor: colors.orange,
    },
    {
      id: 'imports',
      label: 'Import offen',
      value: String(pendingImports),
      subValue: pendingImports === 1 ? 'Bestätigung' : 'Bestätigungen',
      icon: '⏳',
      accentColor: pendingImports > 0 ? colors.orange : colors.success,
    },
  ];
}
