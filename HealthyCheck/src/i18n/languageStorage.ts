import AsyncStorage from '@react-native-async-storage/async-storage';
export type AppLanguage = 'en' | 'vi';
export const LANGUAGE_STORAGE_KEY = '@healthycheck:language';
export const isAppLanguage = (value: unknown): value is AppLanguage => value === 'en' || value === 'vi';
export function resolveLanguage(saved: unknown, _deviceTag?: string | null): AppLanguage {
 if (isAppLanguage(saved)) return saved;
 return 'vi';
}
export async function readLanguage(_deviceTag?: string | null): Promise<AppLanguage> {
 try { return resolveLanguage(await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)); }
 catch { return 'vi'; }
}
let writes: Promise<void> = Promise.resolve();
export function persistLanguage(language: AppLanguage): Promise<void> {
 if (!isAppLanguage(language)) return Promise.reject(new Error('Unsupported language'));
 const write = writes.catch(() => {}).then(() => AsyncStorage.setItem(LANGUAGE_STORAGE_KEY,language));
 writes = write;
 return write;
}
