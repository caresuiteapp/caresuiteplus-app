import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type PortalPremiumKind = 'client' | 'employee' | 'workspace';

type PortalPremiumContextValue = {
  active: boolean;
  kind: PortalPremiumKind | null;
};

const PortalPremiumContext = createContext<PortalPremiumContextValue>({
  active: false,
  kind: null,
});

export const portalPremium = {
  backdrop: '#071C38',
  backdropStrong: '#04142B',
  surface: '#F7FBFF',
  surfaceRaised: '#FFFFFF',
  surfaceSoft: '#EAF4FF',
  surfaceMuted: '#DCEEFF',
  surfaceStrong: '#0755B7',
  surfaceStrongDeep: '#052F70',
  border: 'rgba(112,181,255,0.52)',
  borderSoft: 'rgba(5,108,232,0.18)',
  borderStrong: 'rgba(5,108,232,0.34)',
  innerBorder: 'rgba(255,255,255,0.82)',
  text: {
    primary: '#061B35',
    secondary: '#365672',
    muted: '#566D83',
    onStrong: '#FFFFFF',
    onStrongMuted: '#C7E2FF',
  },
  accent: {
    blue: '#056CE8',
    blueDark: '#075DC7',
    violet: '#6D4AFF',
    teal: '#0F9F89',
    pink: '#C0448F',
    amber: '#A86100',
    success: '#087F6D',
    danger: '#C53A52',
  },
  radius: {
    shell: 28,
    panel: 22,
    card: 17,
    control: 12,
  },
  shadow: {
    panel: '0 22px 58px rgba(0,24,58,0.22)',
    card: '0 14px 34px rgba(0,38,82,0.16)',
    floating: '0 24px 72px rgba(0,18,48,0.30)',
  },
} as const;

export function PortalPremiumProvider({
  kind,
  children,
}: {
  kind: PortalPremiumKind;
  children: ReactNode;
}) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const previous = root.getAttribute('data-cs-portal-premium');
    root.setAttribute('data-cs-portal-premium', kind);

    return () => {
      if (root.getAttribute('data-cs-portal-premium') !== kind) return;
      if (previous) root.setAttribute('data-cs-portal-premium', previous);
      else root.removeAttribute('data-cs-portal-premium');
    };
  }, [kind]);

  return (
    <PortalPremiumContext.Provider value={{ active: true, kind }}>
      {children}
    </PortalPremiumContext.Provider>
  );
}

export function usePortalPremiumTheme(): PortalPremiumContextValue {
  return useContext(PortalPremiumContext);
}

function readPortalPremiumRuntimeKind(): PortalPremiumKind | null {
  if (typeof document === 'undefined') return null;
  const value = document.documentElement.getAttribute('data-cs-portal-premium');
  return value === 'client' || value === 'employee' || value === 'workspace'
    ? value
    : null;
}

/**
 * Global overlays are mounted above the route provider. The root marker keeps
 * their colors in sync with the active portal without guessing from a stale
 * profile role.
 */
export function usePortalPremiumRuntimeTheme(): PortalPremiumContextValue {
  const context = usePortalPremiumTheme();
  const [runtimeKind, setRuntimeKind] = useState<PortalPremiumKind | null>(() =>
    readPortalPremiumRuntimeKind(),
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const sync = () => setRuntimeKind(readPortalPremiumRuntimeKind());
    sync();

    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-cs-portal-premium'],
    });
    return () => observer.disconnect();
  }, []);

  if (context.active) return context;
  return { active: runtimeKind !== null, kind: runtimeKind };
}
