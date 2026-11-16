import { printAsync } from 'expo-print';

export function printCarePlan(html: string): Promise<void> {
  return printAsync({ html });
}
