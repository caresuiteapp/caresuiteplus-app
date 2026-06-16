import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { View, type LayoutRectangle } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  DASHBOARD_TOUR_STEPS,
  type DashboardTourAnchorKey,
} from '@/lib/onboarding/dashboardTourSteps';
import {
  isDashboardTourFinished,
  loadDashboardTourState,
  markDashboardTourCompleted,
  markDashboardTourSkipped,
} from '@/lib/onboarding/dashboardTourStorage';

export type BusinessDashboardTourRefs = {
  welcome: RefObject<View>;
  kpis: RefObject<View>;
  recent: RefObject<View>;
  quickActions: RefObject<View>;
  moreActions: RefObject<View>;
  modules: RefObject<View>;
  firstClient: RefObject<View>;
};

type UseBusinessDashboardTourOptions = {
  ready: boolean;
  isEmptyTenant: boolean;
};

export function useBusinessDashboardTour({ ready, isEmptyTenant }: UseBusinessDashboardTourOptions) {
  const router = useRouter();
  const { user } = useAuth();
  const tenantId = useServiceTenantId();
  const userId = user?.id ?? null;

  const welcomeRef = useRef<View>(null);
  const kpisRef = useRef<View>(null);
  const recentRef = useRef<View>(null);
  const quickActionsRef = useRef<View>(null);
  const moreActionsRef = useRef<View>(null);
  const modulesRef = useRef<View>(null);
  const firstClientRef = useRef<View>(null);

  const refs: BusinessDashboardTourRefs = {
    welcome: welcomeRef,
    kpis: kpisRef,
    recent: recentRef,
    quickActions: quickActionsRef,
    moreActions: moreActionsRef,
    modules: modulesRef,
    firstClient: firstClientRef,
  };

  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetLayout, setTargetLayout] = useState<LayoutRectangle | null>(null);
  const [tourFinished, setTourFinished] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);

  const currentStep = DASHBOARD_TOUR_STEPS[stepIndex];
  const expandQuickActionsMenu = currentStep?.id === 'moreActions';

  const measureAnchor = useCallback((anchor: DashboardTourAnchorKey) => {
    const refMap: Record<DashboardTourAnchorKey, RefObject<View>> = {
      welcome: welcomeRef,
      kpis: kpisRef,
      recent: recentRef,
      quickActions: quickActionsRef,
      moreActions: moreActionsRef,
      modules: modulesRef,
      nav: welcomeRef,
      firstClient: firstClientRef,
    };
    const ref = refMap[anchor];
    if (!ref.current) {
      setTargetLayout(null);
      return;
    }
    ref.current.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setTargetLayout({ x, y, width, height });
        return;
      }
      if (anchor === 'firstClient' && firstClientRef.current) {
        firstClientRef.current.measureInWindow((fx, fy, fw, fh) => {
          if (fw > 0 && fh > 0) {
            setTargetLayout({ x: fx, y: fy, width: fw, height: fh });
          } else {
            setTargetLayout(null);
          }
        });
        return;
      }
      setTargetLayout(null);
    });
  }, []);

  const closeTour = useCallback(async (skipped: boolean) => {
    setVisible(false);
    setStepIndex(0);
    setTargetLayout(null);
    if (userId && tenantId) {
      const state = skipped
        ? await markDashboardTourSkipped(userId, tenantId)
        : await markDashboardTourCompleted(userId, tenantId);
      setTourFinished(isDashboardTourFinished(state));
    } else {
      setTourFinished(true);
    }
  }, [userId, tenantId]);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setVisible(true);
  }, []);

  const onNext = useCallback(() => {
    if (stepIndex >= DASHBOARD_TOUR_STEPS.length - 1) {
      void closeTour(false);
      return;
    }
    setStepIndex((i) => i + 1);
  }, [closeTour, stepIndex]);

  const onSkip = useCallback(() => {
    void closeTour(true);
  }, [closeTour]);

  const onCta = useCallback(() => {
    const route = currentStep.ctaRoute;
    if (!route) return;
    void closeTour(false);
    router.push(route as never);
  }, [closeTour, currentStep.ctaRoute, router]);

  useEffect(() => {
    if (!userId || !tenantId) {
      setStorageLoaded(true);
      return;
    }
    void loadDashboardTourState(userId, tenantId).then((state) => {
      setTourFinished(isDashboardTourFinished(state));
      setStorageLoaded(true);
    });
  }, [userId, tenantId]);

  useEffect(() => {
    if (!ready || !storageLoaded || tourFinished || visible) return;
    if (!userId || !tenantId) return;
    startTour();
  }, [ready, storageLoaded, tourFinished, visible, userId, tenantId, isEmptyTenant, startTour]);

  useEffect(() => {
    if (!visible) return;
    const delay = currentStep.id === 'moreActions' ? 220 : 120;
    const timer = setTimeout(() => {
      measureAnchor(currentStep.id);
    }, delay);
    return () => clearTimeout(timer);
  }, [visible, stepIndex, currentStep.id, measureAnchor, expandQuickActionsMenu]);

  return {
    visible,
    stepIndex,
    currentStep,
    totalSteps: DASHBOARD_TOUR_STEPS.length,
    targetLayout,
    refs,
    tourFinished,
    expandQuickActionsMenu,
    startTour,
    onNext,
    onSkip,
    onCta,
  };
}
