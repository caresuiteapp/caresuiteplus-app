import { EntityFormScreen } from '@/components/forms/EntityFormScreen';
import { createCounselingCase } from '@/lib/beratung/caseListService';
import { useAuth } from '@/lib/auth/context';
import { colors } from '@/theme';

/** WP406 — Beratungsfall anlegen (Arbeitsplan 072) */
export function CaseCreateScreen() {
  const { profile } = useAuth();
  return (
    <EntityFormScreen
      wpNumber={406}
      title="Beratungsfall anlegen"
      entityLabel="Fall"
      formHero={{
        eyebrow: 'BERATUNG · FALL',
        meta: 'Office-Klient:in und Anliegen — Demo-Persistenz im Beratungsmodul',
        icon: '💬',
        accentColor: colors.orange,
      }}
      fields={[{ key: 'name', label: 'Bezeichnung', required: true }]}
      successRoute={(id) => `/beratung/faelle/${id}`}
      onSubmit={async (values) => {
        const result = await createCounselingCase(profile?.roleKey, {
          subject: values.name?.trim() ?? '',
        });
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
    />
  );
}
