import { EmptyState } from '@/components/ui/StateViews';

type Props = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function HealthOSEmptyState({ title, message, actionLabel, onAction }: Props) {
  return (
    <EmptyState
      title={title}
      message={message}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
