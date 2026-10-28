import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptedNativeWorkflowStore } from '@/lib/platform/encryptedWorkflowStorage.native';

const store = encryptedNativeWorkflowStore('caresuite-protected-data-v1.db');
const pending = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
  const result = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(task);
  pending.set(key, result);
  void result.finally(() => { if (pending.get(key) === result) pending.delete(key); }).catch(() => {});
  return result;
}
export const protectedDataStorage = {
  async getAllKeys(): Promise<readonly string[]> {
    const keys = Array.from({ length: store.length }, (_, index) => store.key(index)).filter((key): key is string => key !== null);
    return [...new Set([...keys, ...await AsyncStorage.getAllKeys()])];
  },
  getItem(key: string): Promise<string | null> {
    return serialize(key, async () => {
      const current = store.getItem(key);
      if (current !== null) return current;
      const previous = await AsyncStorage.getItem(key);
      if (previous === null) return null;
      store.setItem(key, previous);
      if (store.getItem(key) !== previous) throw new Error('Der geschützte Entwurf konnte nicht bestätigt werden.');
      await AsyncStorage.removeItem(key);
      return previous;
    });
  },
  setItem(key: string, value: string): Promise<void> {
    return serialize(key, async () => { store.setItem(key, value); await AsyncStorage.removeItem(key); });
  },
  removeItem(key: string): Promise<void> {
    return serialize(key, async () => { store.removeItem(key); await AsyncStorage.removeItem(key); });
  },
};
