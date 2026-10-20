import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';
import { createDemoEntity } from '@/lib/create/demoCreateService';
import { useAuth } from '@/lib/auth/context';

/** WP306 */
export function TripCreateScreen() {
  const { profile } = useAuth();
  return (
    <DomainCreateScreen
      wpNumber={306}
      title="Fahrt erfassen"
      entityLabel="Fahrt"
      fields={[{ key: 'name', label: 'Bezeichnung', required: true }]}
      onSubmit={async (values) => {
        const result = await createDemoEntity('assist.trips.manage' as never, profile?.roleKey, 'trip');
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
    />
  );
}
