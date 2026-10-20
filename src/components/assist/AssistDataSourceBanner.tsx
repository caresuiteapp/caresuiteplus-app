import { InfoBanner } from '@/components/ui';
import { useAssistDataSource } from '@/hooks/useAssistDataSource';

type AssistDataSourceBannerProps = {
  /** When true, blocks interaction context visually (danger variant). */
  blocking?: boolean;
};

export function AssistDataSourceBanner({ blocking = true }: AssistDataSourceBannerProps) {
  const { blocking: isBlocked, title, message, loading } = useAssistDataSource();

  if (loading || !isBlocked || !message) {
    return null;
  }

  return (
    <InfoBanner
      title={title || 'Assist-Datenquelle'}
      message={message}
      variant={blocking ? 'danger' : 'warning'}
    />
  );
}
