import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { PremiumButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { spacing } from '@/theme';

type PortalTabScreenProps = {
  title: string;
  children: ReactNode;
};

export function PortalTabScreen({ title, children }: PortalTabScreenProps) {
  const router = useRouter();
  const { profile, signOut, user } = useAuth();
  const displayName = profile?.displayName ?? user?.displayName ?? 'Portal';

  return (
    <CareLightPageShell
      title={title}
      subtitle={`Willkommen, ${displayName}`}
      showBack={false}
      rightSlot={
        <PremiumButton
          title="Abmelden"
          variant="ghost"
          size="sm"
          onPress={() => signOut().then(() => router.replace('/' as never))}
        />
      }
    >
      <View style={styles.content}>{children}</View>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});
