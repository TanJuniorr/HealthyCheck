import type { ProfileRow } from '../types/database';
import { onboardingComplete } from './healthOnboarding';
type GateInput={isLoading:boolean;isAuthenticated:boolean;isRecovery:boolean;user:{id:string}|null;profile:ProfileRow|null;profileChecked:boolean;profileError:string|null};
export function authGate(auth:GateInput) {
 if(auth.isLoading)return 'restoring';
 if(!auth.isAuthenticated)return 'guest';
 if(auth.isRecovery)return 'recovery';
 if(auth.profileError)return 'error';
 if(!auth.profileChecked || (auth.profile && auth.profile.id!==auth.user?.id))return 'checking';
 return onboardingComplete(auth.profile)?'ready':'onboarding';
}
export function gateDestination(gate:ReturnType<typeof authGate>) {
 if(gate==='guest')return '/login' as const;
 if(gate==='recovery')return '/reset-password' as const;
 if(gate==='ready')return '/(tabs)' as const;
 if(gate==='onboarding')return '/health-onboarding' as const;
 return '/auth/profile-check' as const;
}
