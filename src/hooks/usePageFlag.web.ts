import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { usePageTab } from './usePageTab.web';
export function usePageFlag(name: string, initial: boolean): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [state, setState] = usePageTab<'open' | 'closed'>(name, initial ? 'open' : 'closed');
  const open = state === 'open';
  const current = useRef(open);
  current.current = open;
  const select: Dispatch<SetStateAction<boolean>> = useCallback(action => setState((typeof action === 'function' ? action(current.current) : action) ? 'open' : 'closed'), [setState]);
  return [open, select];
}
