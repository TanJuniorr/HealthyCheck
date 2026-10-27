import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { authConfigurationError, supabase } from '../lib/supabase';
import { authErrorMessage } from '../lib/authErrors';
import { loadProfile, type Profile } from '../lib/profileRepository';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initializationError: string | null;
  isRecovery: boolean;
  profile: Profile | null;
  profileLoading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  finishRecovery: (password: string) => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!authConfigurationError);
  const [initializationError, setInitializationError] = useState<string | null>(authConfigurationError);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const isRecovery = Boolean(session && recoveryUserId === session.user.id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const userId = session?.user.id;
  const currentUserId = useRef(userId);
  const profileRequest = useRef(0);
  const action = useRef(false);

  useEffect(() => {
    if (authConfigurationError) return;
    let alive = true;
    let authChanged = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      authChanged = true;
      if (currentUserId.current !== next?.user.id) {
        profileRequest.current++;
        setProfile(null);
        setProfileError(null);
      }
      currentUserId.current = next?.user.id;
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecoveryUserId(next?.user.id ?? null);
      else if (!next || event === 'SIGNED_IN') setRecoveryUserId(null);
      setIsLoading(false);
    });
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (alive && !authChanged) { currentUserId.current = data.session?.user.id; setSession(data.session); }
      } catch (error) {
        if (alive) setInitializationError(authErrorMessage(error));
      } finally { if (alive) setIsLoading(false); }
    })();
    const updateRefresh = (state: string | null | undefined) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    const listener = Platform.OS !== 'web' ? AppState.addEventListener('change', updateRefresh) : null;
    if (Platform.OS !== 'web') updateRefresh(AppState.currentState);
    return () => {
      alive = false;
      subscription.unsubscribe();
      listener?.remove();
      if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    const request = ++profileRequest.current;
    if (!userId) { setProfile(null); setProfileError(null); setProfileLoading(false); return; }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const next = await loadProfile(userId);
      if (request === profileRequest.current && currentUserId.current === userId) setProfile(next);
    } catch {
      if (request === profileRequest.current && currentUserId.current === userId) setProfileError('Không tải được hồ sơ. Vui lòng kiểm tra kết nối hoặc quyền truy cập.');
    } finally {
      if (request === profileRequest.current && currentUserId.current === userId) setProfileLoading(false);
    }
  }, [userId]);
  const invalidateProfileRequest = useCallback(() => { profileRequest.current++; }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return refreshProfile(); });
    return () => { active = false; invalidateProfileRequest(); };
  }, [refreshProfile, invalidateProfileRequest]);
  async function run<T>(operation: () => Promise<T>): Promise<T> {
    if (authConfigurationError) throw new Error(authConfigurationError);
    if (action.current) throw new Error('Authentication request in progress');
    action.current = true;
    try { return await operation(); } finally { action.current = false; }
  }
  const signIn = (email: string, password: string) => run(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setInitializationError(null);
  });
  const signUp = (name: string, email: string, password: string) => run(async () => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) throw error;
    return Boolean(data.session);
  });
  const signOut = () => run(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setRecoveryUserId(null);
    setProfile(null);
    setProfileError(null);
  });
  const finishRecovery = (password: string) => run(async () => {
    if (!isRecovery || !session) throw new Error('Invalid recovery session');
    const { data, error: identityError } = await supabase.auth.getUser();
    if (identityError || data.user?.id !== session.user.id) throw identityError ?? new Error('Invalid recovery session');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecoveryUserId(null);
  });
  return <AuthContext.Provider value={{ session, user: session?.user ?? null, isAuthenticated: Boolean(session), isLoading, initializationError, isRecovery, profile: profile?.id === userId ? profile : null, profileLoading, profileError, refreshProfile, signIn, signUp, signOut, finishRecovery }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider');
  return context;
}
