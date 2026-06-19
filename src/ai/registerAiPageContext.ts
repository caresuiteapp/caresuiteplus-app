import type { AiPageContextSnapshot } from './aiToolTypes';

let registeredPageContext: AiPageContextSnapshot = {};

export function setRegisteredPageContext(partial: Partial<AiPageContextSnapshot>): void {
  registeredPageContext = {
    ...registeredPageContext,
    ...partial,
    updatedAt: new Date().toISOString(),
  };
}

export function clearRegisteredPageContext(keys: (keyof AiPageContextSnapshot)[]): void {
  const next = { ...registeredPageContext };
  for (const key of keys) {
    delete next[key];
  }
  registeredPageContext = next;
}

export function getRegisteredPageContext(): AiPageContextSnapshot {
  return registeredPageContext;
}

export function resetRegisteredPageContext(): void {
  registeredPageContext = {};
}
