import { createElement, useEffect, type ComponentType, type ReactNode } from 'react';

export type Href = string | { pathname: string; params?: Record<string, unknown> };

const NullComponent = () => null;

export const Stack = Object.assign(NullComponent, { Screen: NullComponent });
export const Slot = NullComponent;
export const Redirect = NullComponent;

export function Link({ children }: { children?: ReactNode }) {
  return createElement('a', null, children);
}

export function usePathname() {
  return '/';
}

export function useSegments() {
  return [] as string[];
}

export function useLocalSearchParams<T extends Record<string, unknown>>() {
  return {} as T;
}

export function useRouter() {
  return {
    back() {},
    canGoBack: () => false,
    dismiss() {},
    dismissAll() {},
    navigate(_href: Href) {},
    push(_href: Href) {},
    replace(_href: Href) {},
    setParams(_params: Record<string, unknown>) {},
  };
}

export function useFocusEffect(callback: () => void | (() => void)) {
  useEffect(callback, [callback]);
}

export default {} as ComponentType;
