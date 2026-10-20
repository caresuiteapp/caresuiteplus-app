import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';
import { createDemoEntity } from '@/lib/create/demoCreateService';
import { useAuth } from '@/lib/auth/context';

/** WP486 */
export function IntegrationConnectScreen() {
  const { profile } = useAuth();
  return (
    <DomainCreateScreen
      wpNumber={486}
      title="Integration verbinden"
      entityLabel="Integration"
      fields={[{ key: 'name', label: 'Bezeichnung', required: true }]}
      onSubmit={async (values) => {
        const result = await createDemoEntity('integrations.manage' as never, profile?.roleKey, 'int');
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
    />
  );
}
