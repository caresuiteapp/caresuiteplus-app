import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';
import { createDemoEntity } from '@/lib/create/demoCreateService';
import { useAuth } from '@/lib/auth/context';

/** WP326 */
export function EmployeeTimeEntryCreateScreen() {
  const { profile } = useAuth();
  return (
    <DomainCreateScreen
      wpNumber={326}
      title="Zeiteintrag"
      entityLabel="Zeiteintrag"
      fields={[{ key: 'name', label: 'Bezeichnung', required: true }]}
      onSubmit={async (values) => {
        const result = await createDemoEntity('portal.employee.timesheet.view' as never, profile?.roleKey, 'time');
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
    />
  );
}
