import { Feather } from '@expo/vector-icons';

export type CareKpiIconKey = 'document' | 'assignments' | 'invoice' | 'calendar';

const ICON_MAP: Record<CareKpiIconKey, keyof typeof Feather.glyphMap> = {
  document: 'file-text',
  assignments: 'user-check',
  invoice: 'credit-card',
  calendar: 'calendar',
};

type CareKpiIconProps = {
  iconKey: CareKpiIconKey;
  color?: string;
  size?: number;
};

export function CareKpiIcon({ iconKey, color = '#64748B', size = 18 }: CareKpiIconProps) {
  return <Feather name={ICON_MAP[iconKey]} size={size} color={color} />;
}
