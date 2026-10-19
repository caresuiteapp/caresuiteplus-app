import type { RoleKey } from '@/types';

/** Native keeps the established stop workflow unchanged; S-03 controls are Web/Desktop only. */
export function CareStopTasksPanel(_props: { stopId: string; tenantId?: string | null; role?: RoleKey | null; portal?: boolean; disabled?: boolean; onChanged: () => void | Promise<void> }) {
  return null;
}
