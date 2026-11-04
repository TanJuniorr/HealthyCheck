import AsyncStorage from '@react-native-async-storage/async-storage';
export type AppLanguage = 'en' | 'vi';
export const LANGUAGE_STORAGE_KEY = '@healthycheck:language';
export const isAppLanguage = (value: unknown): value is AppLanguage => value === 'en' || value === 'vi';
export function resolveLanguage(saved: unknown, deviceTag: string | null | undefined): AppLanguage {
 if (isAppLanguage(saved)) return saved;
 return /^vi(?:[-_]|$)/i.test(deviceTag ?? '') ? 'vi' : 'en';
}
export async function readLanguage(deviceTag?: string | null): Promise<AppLanguage> {
 try { return resolveLanguage(await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),deviceTag); }
 catch { return resolveLanguage(null,deviceTag); }
}
let writes: Promise<void> = Promise.resolve();
export function persistLanguage(language: AppLanguage): Promise<void> {
 if (!isAppLanguage(language)) return Promise.reject(new Error('Unsupported language'));
 const write = writes.catch(() => {}).then(() => AsyncStorage.setItem(LANGUAGE_STORAGE_KEY,language));
 writes = write;
 return write;
}
