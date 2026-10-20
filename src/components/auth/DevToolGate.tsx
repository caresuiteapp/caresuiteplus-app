import { ReactNode } from 'react';
import { Redirect, type Href } from 'expo-router';
import { canAccessDeveloperTools } from '@/lib/auth/devAccess';
import { useAuth } from '@/lib/auth/context';

type DevToolGateProps = {
  children: ReactNode;
};

export function DevToolGate({ children }: DevToolGateProps) {
  const { profile } = useAuth();
  if (!canAccessDeveloperTools(profile?.roleKey ?? null)) {
    return <Redirect href={'/' as Href} />;
  }
  return <>{children}</>;
}
