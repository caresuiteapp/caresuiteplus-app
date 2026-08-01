import { OfficeMessengerScreen } from '@/product-workflows/screens/office/OfficeMessengerScreen';

/**
 * The business and Office entry points intentionally share one live inbox.
 * Keeping a second communication_threads inbox here caused divergent counts
 * and stale portal/administration views.
 */
export default OfficeMessengerScreen;
