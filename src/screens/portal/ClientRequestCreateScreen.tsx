import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';
import { createDemoEntity } from '@/lib/create/demoCreateService';
import { useAuth } from '@/lib/auth/context';

/** WP346 */
export function ClientRequestCreateScreen() {
  const { profile } = useAuth();
  return (
    <DomainCreateScreen
      wpNumber={346}
      title="Anfrage stellen"
      entityLabel="Anfrage"
      fields={[{ key: 'name', label: 'Bezeichnung', required: true }]}
      onSubmit={async (values) => {
        const result = await createDemoEntity('portal.client.appointments.request_change' as never, profile?.roleKey, 'req');
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
    />
  );
}
