import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';
import { createDemoEntity } from '@/lib/create/demoCreateService';
import { useAuth } from '@/lib/auth/context';

/** WP126 */
export function BusinessCreateScreen() {
  const { profile } = useAuth();
  return (
    <DomainCreateScreen
      wpNumber={126}
      title="Business-Eintrag"
      entityLabel="Eintrag"
      fields={[{ key: 'name', label: 'Bezeichnung', required: true }]}
      onSubmit={async (values) => {
        const result = await createDemoEntity('dashboard.view', profile?.roleKey, 'biz', {
          domain: 'business',
          label: values.name?.trim() || 'Business-Eintrag',
        });
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
    />
  );
}
