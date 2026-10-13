import { useState } from 'react';
/** Native keeps its current local state contract. */
export function usePageTab<T extends string | null>(_name: string, initial: T) {
  return useState<T>(initial);
}
