import { ScreenShell } from '@/components/layout';
import { EmptyState, PremiumButton } from '@/components/ui';
import { listTenantClientServiceTypes } from '@/lib/client/clientServiceTypeService';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useRouter } from 'expo-router';

/** Mandanten-Leistungsarten — Core K.0 Stub (Vorlagen aus Migration 0159). */
export default function TenantClientServiceTypesScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTenantClientServiceTypes(tenantId);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const types = query.data ?? [];

  return (
    <ScreenShell
      title="Klient:innen-Leistungsarten"
      subtitle="Mandanten-Vorlagen für Leistungsbereiche"
      rightSlot={<PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />}
    >
      <EmptyState
        title={types.length > 0 ? `${types.length} Leistungsarten hinterlegt` : 'Leistungsarten-Vorlagen'}
        message={
          types.length > 0
            ? types.map((t) => t.name).join(' · ')
            : 'Beim ersten Zugriff werden 6 Systemvorlagen angelegt: Alltagsbegleitung, Betreuung, Begleitung, Ambulante Pflege, Stationäre Pflege, Beratung. Vollständige CRUD-UI folgt in K.4.'
        }
        actionLabel="Zu Mandanten-Einstellungen"
        onAction={() => router.push('/settings/tenant' as never)}
      />
    </ScreenShell>
  );
}
