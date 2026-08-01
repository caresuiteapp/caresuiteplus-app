import { createContext, useContext, type ReactNode } from 'react';

export type PortalPremiumKind = 'client' | 'employee';

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
    muted: '#647D94',
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
  return (
    <PortalPremiumContext.Provider value={{ active: true, kind }}>
      {children}
    </PortalPremiumContext.Provider>
  );
}

export function usePortalPremiumTheme(): PortalPremiumContextValue {
  return useContext(PortalPremiumContext);
}

