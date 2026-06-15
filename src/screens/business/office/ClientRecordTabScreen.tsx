import { ClientRecordScreen } from '@/screens/business/office/ClientRecordScreen';
import type { ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';

export function ClientRecordTabScreen({ initialTab }: { initialTab: ClientRecordTabKey }) {
  return <ClientRecordScreen initialTabOverride={initialTab} />;
}
