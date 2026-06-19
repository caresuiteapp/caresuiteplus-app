import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { PremiumButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';

type PortalTabScreenProps = {
  title: string;
  children: ReactNode;
};

export function PortalTabScreen({ title, children }: PortalTabScreenProps) {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <CareLightPageShell
      title={title}
      subtitle="Ihr persönlicher Portalbereich"
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
