import { Text, View } from 'react-native';

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{title} — in Vorbereitung</Text>
    </View>
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
