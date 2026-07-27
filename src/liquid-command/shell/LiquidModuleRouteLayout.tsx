import type { ReactNode } from 'react';
import { Stack } from 'expo-router';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { LiquidProductAccessGuard } from '../guards/LiquidProductAccessGuard';

type LiquidModuleRouteLayoutProps = {
  children?: ReactNode;
  requireRole?: boolean;
  requireProduct?: boolean;
};

const transparentContent = { backgroundColor: 'transparent' } as const;

function LiquidModuleStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: transparentContent,
        animation: 'fade',
      }}
    />
  );
}

/**
 * Authentication-only route boundary for migrated modules.
 *
 * It deliberately does not import ShellLayout, module colors, route layout
 * styles or another legacy visual primitive.
 */
export function LiquidModuleRouteLayout({
  requireRole = true,
  requireProduct = true,
}: LiquidModuleRouteLayoutProps) {
  let content: ReactNode = <LiquidModuleStack />;

  if (requireProduct) {
    content = <LiquidProductAccessGuard>{content}</LiquidProductAccessGuard>;
  }
  if (requireRole) {
    content = <RequireRole>{content}</RequireRole>;
  }

  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
      {content}
    </RequireAuth>
  );
}
