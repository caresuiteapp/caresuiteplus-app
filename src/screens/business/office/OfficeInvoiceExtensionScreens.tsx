import { ScreenShell } from '@/components/layout';
import { EmptyState } from '@/components/ui';

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <ScreenShell title={title} subtitle="Office · Abrechnung">
      <EmptyState
        title={`${title} in Vorbereitung`}
        message="Für diesen Bereich liegen noch keine freigegebenen Vorgänge vor."
      />
    </ScreenShell>
  );
}

export function MonthEndClosingScreen() {
  return <PlaceholderScreen title="Monatsabschluss" />;
}

export function InvoiceRunsScreen() {
  return <PlaceholderScreen title="Rechnungsläufe" />;
}

export function InvoicePaymentsScreen() {
  return <PlaceholderScreen title="Zahlungseingänge" />;
}

export function InvoiceDunningScreen() {
  return <PlaceholderScreen title="Mahnwesen" />;
}
