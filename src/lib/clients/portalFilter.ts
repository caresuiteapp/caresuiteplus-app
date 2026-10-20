import type { ClientFullDetail } from '@/types/modules/client';
import type { ClientPortalView } from '@/types/modules/client';
import { SENSITIVE_CLIENT_CORE_FIELDS } from '@/types/modules/client';

/** Entfernt interne Notizen — niemals im Portal */
export function toPortalView(detail: ClientFullDetail): ClientPortalView {
  const { internalNotes: _notes, ...rest } = detail;
  return rest;
}

/** Filtert Timeline-Ereignisse für Portal (keine internen) */
export function filterTimelineForPortal(detail: ClientFullDetail): ClientFullDetail['timeline'] {
  return detail.timeline.filter((e) => !e.isInternal);
}

/** Maskiert sensible Kernfelder wenn keine Berechtigung */
export function maskSensitiveCore(
  detail: ClientFullDetail,
  canViewSensitive: boolean,
): ClientFullDetail {
  if (canViewSensitive) return detail;
  return {
    ...detail,
    core: {
      ...detail.core,
      insuranceNumber: detail.core.insuranceNumber ? '•••••••••' : null,
      keySafeCode: detail.core.keySafeCode ? '••••' : null,
      diagnoses: detail.core.diagnoses.length > 0 ? ['Geschützt'] : [],
    },
  };
}

export function assertNoInternalNotesInPortalView(view: ClientPortalView): boolean {
  return !('internalNotes' in view) || (view as { internalNotes?: unknown }).internalNotes === undefined;
}

export const PORTAL_EXCLUDED_FIELDS = [...SENSITIVE_CLIENT_CORE_FIELDS, 'internalNotes'] as const;
