import { PremiumButton } from '@/components/ui';
import type { RoleKey } from '@/types';

/** Native keeps the previous start action unchanged; S-01 is Web/Desktop only. */
export function CareStopOpeningPanel({ disabled, onNativeStart }: {
  stopId: string; tenantId?: string | null; role?: RoleKey | null; portal?: boolean; disabled?: boolean;
  onStarted: () => void | Promise<void>; onNativeStart: () => void;
}) {
  return <PremiumButton title="Versorgung starten" disabled={disabled} onPress={onNativeStart} />;
}
