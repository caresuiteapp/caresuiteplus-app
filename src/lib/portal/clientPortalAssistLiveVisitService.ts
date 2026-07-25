/**
 * Client portal — sanitized live visit projection (backward-compatible re-exports).
 */
import type { sanitizeClientLiveVisitLocation } from '@/features/liveTracking/getClientLiveVisitLocation';

export type ClientPortalAssistLiveVisitProjection = ReturnType<
  typeof sanitizeClientLiveVisitLocation
>;
export {
  getClientLiveVisitLocation as projectClientPortalAssistLiveVisit,
  sanitizeClientLiveVisitLocation as sanitizeClientPortalLiveVisitPayload,
} from '@/features/liveTracking/getClientLiveVisitLocation';
