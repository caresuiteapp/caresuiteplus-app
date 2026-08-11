import { Redirect } from 'expo-router';
import { PlatformAuthGate } from '@/product-workflows/components/platformConsole';

export default function PlatformRoot() {
  return (
    <PlatformAuthGate>
      <Redirect href="/platform/dashboard" />
    </PlatformAuthGate>
  );
}
