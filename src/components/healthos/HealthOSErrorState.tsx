import { ErrorState } from '@/components/ui/StateViews';

type Props = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function HealthOSErrorState({
  title = 'Fehler',
  message,
  onRetry,
}: Props) {
  return <ErrorState title={title} message={message} onRetry={onRetry} />;
}
