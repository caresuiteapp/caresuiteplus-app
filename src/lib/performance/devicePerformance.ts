import { Platform } from 'react-native';

export type DevicePerformanceProfile =
  | 'desktopHigh'
  | 'desktopBalanced'
  | 'mobileBalanced'
  | 'mobileBatterySaver'
  | 'activeTrackingSaver';

export type DevicePerformanceSnapshot = {
  profile: DevicePerformanceProfile;
  isMobile: boolean;
  isIOS: boolean;
  isSafari: boolean;
  prefersReducedMotion: boolean;
  batterySaver: boolean;
  activeTracking: boolean;
  lowMemory: boolean;
};

let activeTrackingFlag = false;

/** Call when employee live GPS tracking is active — tightens throttles globally. */
export function setActiveTrackingPerformanceMode(active: boolean): void {
  activeTrackingFlag = active;
}

export function isActiveTrackingPerformanceMode(): boolean {
  return activeTrackingFlag;
}

function readPrefersReducedMotion(): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'matchMedia' in window) {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}

function readBatterySaverHint(): boolean {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return true;
  }
  return false;
}

function readLowMemoryHint(): boolean {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (typeof mem === 'number' && mem <= 4) return true;
  }
  return false;
}

function detectMobile(width: number): boolean {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return true;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = width < 768;
    return coarse || narrow;
  }
  return width < 768;
}

function detectIOS(): boolean {
  if (Platform.OS === 'ios') return true;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }
  return false;
}

function detectSafari(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
}

export function getDevicePerformanceProfile(options?: {
  viewportWidth?: number;
  prefersReducedMotion?: boolean;
  batterySaver?: boolean;
  activeTracking?: boolean;
}): DevicePerformanceSnapshot {
  const width = options?.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const isMobile = detectMobile(width);
  const isIOS = detectIOS();
  const isSafari = detectSafari();
  const prefersReducedMotion = options?.prefersReducedMotion ?? readPrefersReducedMotion();
  const batterySaver = options?.batterySaver ?? readBatterySaverHint();
  const activeTracking = options?.activeTracking ?? activeTrackingFlag;
  const lowMemory = readLowMemoryHint();

  let profile: DevicePerformanceProfile;

  if (activeTracking && isMobile) {
    profile = 'activeTrackingSaver';
  } else if (isMobile && (batterySaver || prefersReducedMotion || lowMemory)) {
    profile = 'mobileBatterySaver';
  } else if (isMobile) {
    profile = 'mobileBalanced';
  } else if (prefersReducedMotion || batterySaver) {
    profile = 'desktopBalanced';
  } else {
    profile = 'desktopHigh';
  }

  return {
    profile,
    isMobile,
    isIOS,
    isSafari,
    prefersReducedMotion,
    batterySaver,
    activeTracking,
    lowMemory,
  };
}

/** GPS watch interval bounds per profile (ms). */
export function gpsWatchMaxAgeMs(profile: DevicePerformanceProfile): number {
  switch (profile) {
    case 'activeTrackingSaver':
      return 30_000;
    case 'mobileBatterySaver':
      return 25_000;
    case 'mobileBalanced':
      return 20_000;
    default:
      return 10_000;
  }
}

/** Minimum distance before persisting GPS (meters). */
export function gpsMinMoveMeters(profile: DevicePerformanceProfile): number {
  switch (profile) {
    case 'activeTrackingSaver':
    case 'mobileBatterySaver':
      return 30;
    case 'mobileBalanced':
      return 25;
    default:
      return 20;
  }
}

/** Minimum interval between DB writes (ms). */
export function gpsMinWriteIntervalMs(profile: DevicePerformanceProfile): number {
  switch (profile) {
    case 'activeTrackingSaver':
      return 30_000;
    case 'mobileBatterySaver':
      return 25_000;
    case 'mobileBalanced':
      return 20_000;
    default:
      return 15_000;
  }
}

/** Polling interval for live views (ms). */
export function livePollIntervalMs(profile: DevicePerformanceProfile, baseMs: number): number {
  switch (profile) {
    case 'activeTrackingSaver':
    case 'mobileBatterySaver':
      return Math.max(baseMs, 60_000);
    case 'mobileBalanced':
      return Math.max(baseMs, 45_000);
    default:
      return baseMs;
  }
}

/** Whether heavy visual effects (blur, aurora, infinite animations) should run. */
export function shouldUseHeavyEffects(snapshot: DevicePerformanceSnapshot): boolean {
  if (snapshot.prefersReducedMotion) return false;
  if (snapshot.profile === 'mobileBatterySaver' || snapshot.profile === 'activeTrackingSaver') {
    return false;
  }
  if (snapshot.isMobile && snapshot.isSafari) return false;
  return (
    snapshot.profile === 'desktopHigh' ||
    snapshot.profile === 'desktopBalanced' ||
    snapshot.profile === 'mobileBalanced'
  );
}
