import { LoadingState } from '@/components/ui/StateViews';

type Props = {
  message?: string;
};

export function HealthOSLoadingState({ message = 'Wird geladen…' }: Props) {
  return <LoadingState message={message} />;
}
