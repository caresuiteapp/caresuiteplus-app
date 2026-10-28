import AsyncStorage from '@react-native-async-storage/async-storage';
/** Web keeps the existing browser storage contract; native uses SQLCipher. */
export const protectedDataStorage = AsyncStorage;
