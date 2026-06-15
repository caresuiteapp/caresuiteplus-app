import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProductKey } from '@/types';

const STORAGE_KEY = 'caresuite:onboarding-draft';

export type OnboardingDraft = {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  modules: ProductKey[];
  savedAt: string;
};

export async function saveOnboardingDraft(
  draft: Omit<OnboardingDraft, 'savedAt'>,
): Promise<OnboardingDraft> {
  const record: OnboardingDraft = { ...draft, savedAt: new Date().toISOString() };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  return record;
}

export async function loadOnboardingDraft(): Promise<OnboardingDraft | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnboardingDraft;
  } catch {
    return null;
  }
}

export async function clearOnboardingDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** WP106 — Create/Edit Wizard mit Persistenz */
export const ONBOARDING_WP = 106 as const;
