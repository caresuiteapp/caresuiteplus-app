import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { InvoicesListView } from '@/components/office/InvoicesListView';
import { PremiumButton } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';

export function InvoicesListScreen({
  onInvoicePress,
  selectedId,
  embedded = false,
}: {
  onInvoicePress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const router = useRouter();
  const { can, isReadOnly } = usePermissions();
  const canCreate = can('office.invoices.view') && !isReadOnly;

  if (embedded) {
    return (
      <InvoicesListView
        onInvoicePress={onInvoicePress}
        selectedId={selectedId}
        embedded
      />
    );
  }

  return (
    <ScreenShell
      title="Rechnungen"
      subtitle={`Office Abrechnung${isReadOnly ? ' · Lesemodus' : ''}`}
      rightSlot={
        canCreate ? (
          <PremiumButton
            title="+ Neu"
            onPress={() => router.push('/business/office/invoices/new' as never)}
          />
        ) : null
      }
      scroll={false}
    >
      <View style={styles.content}>
        <InvoicesListView
          onInvoicePress={onInvoicePress}
          selectedId={selectedId}
          routePrefix="/business/office/invoices"
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
});
