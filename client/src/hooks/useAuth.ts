import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';
import { logUsageEvent } from '../services/usageTracking';

export interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  getIdToken: () => Promise<string>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    logUsageEvent(cred.user.uid, cred.user.email ?? email, 'login');
  }, []);

  const signOut = useCallback(async () => {
    const u = auth.currentUser;
    if (u) logUsageEvent(u.uid, u.email ?? '', 'logout');
    await firebaseSignOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const getIdToken = useCallback(async () => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    return auth.currentUser.getIdToken();
  }, []);

  return { user, loading, signIn, signOut, resetPassword, getIdToken };
}
