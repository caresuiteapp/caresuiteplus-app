import type { PropsWithChildren } from 'react';
import { CareSuiteFontProvider } from '@/design/CareSuiteFontProvider';
import { AppStartIntro } from './AppStartIntro';

/** Start the local video while fonts and the application load underneath it. */
export function AppStartup({ children }: PropsWithChildren) {
  return <AppStartIntro><CareSuiteFontProvider>{children}</CareSuiteFontProvider></AppStartIntro>;
}
