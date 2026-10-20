import { EntityFormScreen } from '@/components/forms/EntityFormScreen';
import { createDemoEntity } from '@/lib/create/demoCreateService';
import { useAuth } from '@/lib/auth/context';
import { colors } from '@/theme';

/** WP246 — Einsatz anlegen (Arbeitsplan 038) */
export function AssignmentCreateScreen() {
  const { profile } = useAuth();
  return (
    <EntityFormScreen
      title="Einsatz anlegen"
      entityLabel="Einsatz"
      formHero={{
        eyebrow: 'Assist · Einsatz',
        meta: 'Klient:in, Leistung und Zeitfenster erfassen',
        icon: '🚗',
        accentColor: colors.success,
      }}
      fields={[
        { key: 'name', label: 'Bezeichnung', required: true },
        {
          key: 'assignmentStatus',
          label: 'Einsatzstatus',
          required: true,
          type: 'catalog',
          catalogType: 'assignment_status',
        },
      ]}
      successRoute={(id) => `/assist/einsaetze/${id}`}
      onSubmit={async () => {
        const result = await createDemoEntity('assist.assignments.manage' as never, profile?.roleKey, 'asg');
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
    />
  );
}
