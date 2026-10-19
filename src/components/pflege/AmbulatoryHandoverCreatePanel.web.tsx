import type { RoleKey } from '@/types';
import { CaseHandoverWorkspace } from '@/screens/pflege/CaseHandoverWorkspace.web';

/** Legacy Web entry forwards to the current scoped workspace. Eine Quittierung erledigt keinen Auftrag. */
export function AmbulatoryHandoverCreatePanel(_props: { tenantId: string | null; role?: RoleKey | null; clients: { key: string; label: string }[] }) {
  return <CaseHandoverWorkspace mode="new" embedded />;
}
