import { ModalStackProvider as ModalStackStateProvider } from '@/hooks/useModalStack';
import { ModalStackRenderer } from './ModalStackRenderer';

/** App-level modal stack — nested glass overlays for in-page actions. */
export function ModalStackProvider({ children }: { children: React.ReactNode }) {
  return (
    <ModalStackStateProvider>
      {children}
      <ModalStackRenderer />
    </ModalStackStateProvider>
  );
}
