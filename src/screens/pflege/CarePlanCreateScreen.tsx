import { EntityFormScreen } from '@/components/forms/EntityFormScreen';
import { createCarePlan } from '@/lib/pflege/carePlanListService';
import { useAuth } from '@/lib/auth/context';
import { colors } from '@/theme';

/** WP366 — Pflegeplan anlegen (Arbeitsplan 054) */
export function CarePlanCreateScreen() {
  const { profile } = useAuth();
  return (
    <EntityFormScreen
      wpNumber={366}
      title="Pflegeplan anlegen"
      entityLabel="Pflegeplan"
      formHero={{
        eyebrow: 'PFLEGE · PFLEGEPLAN',
        meta: 'Bezeichnung und SIS-Thema — Demo-Persistenz im Pflege-Modul',
        icon: '📋',
        accentColor: colors.cyan,
      }}
      fields={[
        { key: 'name', label: 'Bezeichnung', required: true },
        {
          key: 'sisTopic',
          label: 'SIS-Thema / Pflegebaustein',
          required: true,
          type: 'catalog',
          catalogType: 'sis_topic',
        },
      ]}
      successRoute={(id) => `/pflege/planung/${id}`}
      onSubmit={async (values) => {
        const result = await createCarePlan(profile?.roleKey, {
          title: values.name?.trim() ?? '',
          sisTopic: values.sisTopic?.trim() ?? '',
        });
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
    />
  );
}
