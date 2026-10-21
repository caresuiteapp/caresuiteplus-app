import type { RoleKey } from '@/types';

/** Native keeps the established stop workflow unchanged; S-02 controls are Web/Desktop only. */
export function CareStopTimePanel(_props: { stopId: string; tenantId?: string | null; role?: RoleKey | null; portal?: boolean; disabled?: boolean; onChanged: () => void | Promise<void> }) {
  return null;
}
