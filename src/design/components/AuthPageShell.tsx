import { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { AppScreen } from './AppScreen';
import { AuthScreenHeader } from './AuthHero';

type AuthPageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  keyboardAvoiding?: boolean;
};

/** Auth flow wrapper — space background, safe area, keyboard avoiding on forms. */
export function AuthPageShell({
  title,
  subtitle,
  children,
  scroll = true,
  showBack,
  onBack,
  keyboardAvoiding = false,
}: AuthPageShellProps) {
  const router = useRouter();
  const { isPhone } = useDeviceClass();
  const resolvedShowBack = showBack ?? !isPhone;
  const handleBack = onBack ?? (() => router.back());

  return (
    <AppScreen scroll={scroll} keyboardAvoiding={keyboardAvoiding} maxWidth={640}>
      <AuthScreenHeader
        title={title}
        subtitle={subtitle}
        showBack={resolvedShowBack}
        onBack={handleBack}
      />
      {children}
    </AppScreen>
  );
}
