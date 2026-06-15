import { fetchCourseModuleSnapshot } from '@/lib/akademie/akademieModuleService';
import { useTenantModuleSnapshot } from '@/hooks/core/useTenantModuleSnapshot';

/** WP428 — Course Modul-Hook */
export function useCourseModule() {
  return useTenantModuleSnapshot(428, fetchCourseModuleSnapshot);
}
