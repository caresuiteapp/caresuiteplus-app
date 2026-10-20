import type { BreadcrumbTrail as BreadcrumbTrailType } from '@/types/navigation/breadcrumbs';
import { ScreenHeader } from './ScreenHeader';

type CareLightScreenHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbTrail?: BreadcrumbTrailType;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
};

/** Legacy name without a second header layout. */
export function CareLightScreenHeader(props: CareLightScreenHeaderProps) {
  return <ScreenHeader {...props} />;
}
