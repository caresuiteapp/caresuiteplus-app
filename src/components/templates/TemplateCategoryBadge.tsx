import { PremiumBadge } from '@/components/ui';

type Props = { categoryKey: string | null | undefined };

export function TemplateCategoryBadge({ categoryKey }: Props) {
  if (!categoryKey) return null;
  return <PremiumBadge label={categoryKey.replace(/_/g, ' ')} variant="muted" />;
}
