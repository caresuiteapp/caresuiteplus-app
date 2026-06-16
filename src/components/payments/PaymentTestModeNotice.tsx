import { InfoBanner } from '@/components/ui';

export function PaymentTestModeNotice({ message }: { message: string }) {
  return (
    <InfoBanner
      variant="warning"
      title="Testmodus"
      message={message}
    />
  );
}
