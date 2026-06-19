import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { createAppointment } from '@/lib/office/appointmentCreateService';
import { getServiceMode } from '@/lib/services/mode';
import { moduleColor } from '@/design/tokens/modules';

/** WP206 */
export function AppointmentCreateScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const isLive = getServiceMode() === 'supabase';

  return (
    <DomainCreateScreen
      wpNumber={206}
      title="Termin anlegen"
      entityLabel="Termin"
      formHero={{
        eyebrow: 'OFFICE · TERMIN',
        meta: isLive
          ? 'Titel, Klient:in und Ort — Live-Speicherung im Mandanten.'
          : 'Titel, Klient:in und Ort — Demo-Persistenz im Office-Modul',
        icon: '📅',
        accentColor: moduleColor('office'),
      }}
      fields={[
        { key: 'title', label: 'Titel', required: true },
        { key: 'clientName', label: 'Klient:in' },
        { key: 'location', label: 'Ort' },
      ]}
      onSubmit={async (values) => {
        if (!tenantId) return { ok: false as const, error: 'Kein Mandant am Profil hinterlegt.' };
        const result = await createAppointment(
          tenantId,
          {
            title: String(values.title ?? ''),
            clientName: String(values.clientName ?? ''),
            location: String(values.location ?? ''),
          },
          profile?.roleKey,
        );
        if (!result.ok) return { ok: false as const, error: result.error };
        return { ok: true as const, id: result.data.id };
      }}
    />
  );
}
