import { LoadingState } from '@/components/ui/StateViews';

type Props = {
  message?: string;
};

export function HealthOSLoadingState({ message }: Props) {
  return <LoadingState message={message} />;
}
