import { getSupabaseClient } from '@/lib/supabase/client';
import type { PortalCareTour } from '@/lib/pflege/carePortalService';
import type { ServiceResult } from '@/types';

type EmployeeCareTour = Omit<PortalCareTour, 'stops'> & { stops: Omit<PortalCareTour['stops'][number], 'note'>[] };

export async function loadEmployeePortalCareTours(day: string): Promise<ServiceResult<EmployeeCareTour[]>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine Verbindung zu den Pflegetouren.' };
  const { data, error } = await client.rpc('get_employee_portal_care_day' as never, { p_day: day } as never);
  if (error?.code === '42501') return { ok: false, error: 'Die persönliche Pflegefreigabe konnte nicht bestätigt werden.' };
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return { ok: false, error: 'Die Pflegetouren sind für dieses Portal noch nicht eingerichtet.' };
  }
  if (error || !Array.isArray(data)) return { ok: false, error: 'Die Pflegetouren konnten nicht geladen werden.' };
  return { ok: true, data: data as EmployeeCareTour[] };
}
