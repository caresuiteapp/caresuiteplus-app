import { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { AppScreen } from './AppScreen';
import { AuthScreenHeader } from './AuthHero';

type RegisterLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
  showBack?: boolean;
  onBack?: () => void;
};

/** Registration flow wrapper — wider max width, keyboard avoiding on forms. */
export function RegisterLayout({
  title,
  subtitle,
  children,
  scroll = true,
  showBack = true,
  onBack,
}: RegisterLayoutProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  return (
    <AppScreen scroll={scroll} keyboardAvoiding maxWidth={760}>
      <AuthScreenHeader
        title={title}
        subtitle={subtitle}
        showBack={showBack}
        onBack={handleBack}
      />
      {children}
    </AppScreen>
  );
}
