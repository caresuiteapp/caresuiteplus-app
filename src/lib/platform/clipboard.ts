import { Platform, Share } from 'react-native';

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;

  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  try {
    await Share.share({ message: value });
    return true;
  } catch {
    return false;
  }
}
