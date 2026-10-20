export {
  getDevicePerformanceProfile,
  setActiveTrackingPerformanceMode,
  isActiveTrackingPerformanceMode,
  gpsWatchMaxAgeMs,
  gpsMinMoveMeters,
  gpsMinWriteIntervalMs,
  livePollIntervalMs,
  shouldUseHeavyEffects,
  type DevicePerformanceProfile,
  type DevicePerformanceSnapshot,
} from './devicePerformance';
export {
  PERFORMANCE_CSS,
  PERFORMANCE_BODY_CLASSES,
  ensurePerformanceCssInjected,
  syncPerformanceBodyClasses,
} from './performanceCss';
export { PerformanceProvider, useDevicePerformance, PerformanceContext } from './PerformanceProvider';
