import type { ViewStyle } from 'react-native';
import { PremiumKpiCard } from '@/components/ui/PremiumKpiCard';

type Props = {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: string;
  accentColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  style?: ViewStyle;
  variant?: 'glass' | 'light';
};

export function HealthOSMetricCard(props: Props) {
  return <PremiumKpiCard {...props} />;
}
