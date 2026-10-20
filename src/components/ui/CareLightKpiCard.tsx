import type { ViewStyle } from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { PremiumKpiCard } from './PremiumKpiCard';

type CareLightKpiCardProps = {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: string;
  accentColor?: string;
  style?: ViewStyle;
};

export function CareLightKpiCard({
  label,
  value,
  subValue,
  icon,
  accentColor = careLightColors.green,
  style,
}: CareLightKpiCardProps) {
  return (
    <PremiumKpiCard
      label={label}
      value={value}
      subValue={subValue}
      icon={icon}
      accentColor={accentColor}
      style={style}
      variant="glass"
    />
  );
}
