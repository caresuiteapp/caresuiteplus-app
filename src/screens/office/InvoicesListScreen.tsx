import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { InvoicesListView } from '@/components/office/InvoicesListView';
import { CareLightButton, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useInvoiceList } from '@/hooks/useInvoiceList';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchInvoiceList } from '@/lib/office/invoiceListService';

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
  const officeAccent = moduleColor('office');
  const list = useInvoiceList();

  if (embedded) {
    return (
      <InvoicesListView
        onInvoicePress={onInvoicePress}
        selectedId={selectedId}
        embedded
      />
    );
  }

  if (list.loading && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Rechnungen" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Rechnungen werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (list.error && list.allItems.length === 0) {
    return (
      <CareLightPageShell title="Rechnungen" subtitle="Fehler" scroll={false}>
        <ErrorState message={list.error} onRetry={list.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Rechnungen"
      subtitle={`Office Abrechnung${isReadOnly ? ' · Lesemodus' : ''}`}
      rightSlot={
        canCreate ? (
          <CareLightButton
            title="+ Neu"
            onPress={() => router.push('/business/office/invoices/new' as never)}
            accentColor={officeAccent}
          />
        ) : null
      }
      scroll={false}
    >
      <View style={styles.content}>
        {list.isEmpty && !list.hasActiveFilters ? (
          <EmptyState
            title="Keine Rechnungen"
            message="Erstellen Sie die erste Rechnung im Demo-Mandanten."
            actionLabel={canCreate ? 'Rechnung anlegen' : undefined}
            onAction={canCreate ? () => router.push('/business/office/invoices/new' as never) : undefined}
          />
        ) : (
          <InvoicesListView
            onInvoicePress={onInvoicePress}
            selectedId={selectedId}
            routePrefix="/business/office/invoices"
          />
        )}
      </View>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
