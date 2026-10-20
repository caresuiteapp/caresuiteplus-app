import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import type { AiNavigationInstruction } from './aiToolTypes';

const NAV_EVENT = 'caresuite:navigate';

function buildRouteHref(instruction: AiNavigationInstruction): string {
  const route = instruction.route.trim();
  if (!route.startsWith('/')) {
    return `/${route}`;
  }
  return route;
}

export function dispatchAiNavigation(instruction: AiNavigationInstruction): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<AiNavigationInstruction>(NAV_EVENT, { detail: instruction }));
    return;
  }

  // Native: consumers should mount AiNavigationBridge which listens via a module-level handler.
  aiNavigationHandler?.(instruction);
}

let aiNavigationHandler: ((instruction: AiNavigationInstruction) => void) | null = null;

export function useAiNavigationBridge(): void {
  const router = useRouter();

  useEffect(() => {
    const navigate = (instruction: AiNavigationInstruction) => {
      const href = buildRouteHref(instruction);
      router.push(href as never);
    };

    aiNavigationHandler = navigate;

    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return () => {
        if (aiNavigationHandler === navigate) {
          aiNavigationHandler = null;
        }
      };
    }

    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<AiNavigationInstruction>).detail;
      if (detail?.route) {
        navigate(detail);
      }
    };

    window.addEventListener(NAV_EVENT, onNavigate);
    return () => {
      window.removeEventListener(NAV_EVENT, onNavigate);
      if (aiNavigationHandler === navigate) {
        aiNavigationHandler = null;
      }
    };
  }, [router]);
}
