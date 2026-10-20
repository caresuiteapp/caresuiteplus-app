import { EntityFormScreen } from '@/components/forms/EntityFormScreen';
import { createCounselingCase } from '@/lib/beratung/caseListService';
import { useAuth } from '@/lib/auth/context';
import { colors } from '@/theme';

/** Arbeitsplan 072 — /beratung/faelle/new */
export function BeratungFallAnlegenScreen() {
  const { profile } = useAuth();
  return (
    <EntityFormScreen
      wpNumber={406}
      title="Fall anlegen"
      entityLabel="Beratungsfall"
      formHero={{
        eyebrow: 'BERATUNG · FALL',
        meta: 'Neuen Beratungsfall mit Office-Klient:in anlegen',
        icon: '💬',
        accentColor: colors.orange,
      }}
      fields={[{ key: 'name', label: 'Bezeichnung / Anliegen', required: true }]}
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
