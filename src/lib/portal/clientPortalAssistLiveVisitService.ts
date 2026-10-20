/**
 * Client portal — sanitized live visit projection (backward-compatible re-exports).
 */
export type { ClientLiveVisitLocation as ClientPortalAssistLiveVisitProjection } from '@/features/liveTracking/getClientLiveVisitLocation';
export {
  getClientLiveVisitLocation as projectClientPortalAssistLiveVisit,
  sanitizeClientLiveVisitLocation as sanitizeClientPortalLiveVisitPayload,
} from '@/features/liveTracking/getClientLiveVisitLocation';
