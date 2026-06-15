import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { createAppointment } from '@/lib/office/appointmentCreateService';

/** WP206 */
export function AppointmentCreateScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  return (
    <DomainCreateScreen
      wpNumber={206}
      title="Termin anlegen"
      entityLabel="Termin"
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
