import { EntityFormScreen } from '@/components/forms/EntityFormScreen';
import { createDemoEntity } from '@/lib/create/demoCreateService';
import { useAuth } from '@/lib/auth/context';
import { colors } from '@/theme';

/** WP426 — Kurs anlegen (Arbeitsplan 089) */
export function CourseCreateScreen() {
  const { profile } = useAuth();
  return (
    <EntityFormScreen
      wpNumber={426}
      title="Kurs anlegen"
      entityLabel="Kurs"
      formHero={{
        eyebrow: 'AKADEMIE · KURS',
        meta: 'Titel, Zielgruppe und Lektionen — Demo-Persistenz in der Akademie',
        icon: '🎓',
        accentColor: colors.violet,
      }}
      fields={[{ key: 'name', label: 'Bezeichnung', required: true }]}
      successRoute={(id) => `/akademie/kurse/${id}`}
      onSubmit={async () => {
        const result = await createDemoEntity('akademie.courses.view' as never, profile?.roleKey, 'course');
        if (!result.ok) return result;
        return { ok: true as const, id: result.data.id };
      }}
    />
  );
}
