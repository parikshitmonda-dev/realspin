import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
} from '../firebase/config';
import {
  OperationType,
  handleFirestoreError,
} from '../firebase/firestoreErrors';
import {
  subscribeAuth,
  ensureUserProfile,
  logOut as firebaseLogout,
  signInWithGoogle,
  registerWithEmail,
  loginWithEmail,
  loginOrRegisterWithPhone,
  ADMIN_EMAIL,
} from '../services/authService';
import { UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: (email?: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, phone: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  loginOrRegisterWithPhone: (phone: string, name?: string) => Promise<void>;
  loginAsDemoUser: (asAdmin?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Active listener reference
  const unsubDocRef = React.useRef<(() => void) | null>(null);

  const attachUserListener = (uid: string, initialProfile?: UserProfile) => {
    if (unsubDocRef.current) {
      unsubDocRef.current();
      unsubDocRef.current = null;
    }
    if (initialProfile) {
      setUser(initialProfile);
    }
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setUser(snap.data() as UserProfile);
        } else if (initialProfile) {
          setUser(initialProfile);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('User doc snapshot warning:', error);
        setLoading(false);
      }
    );
    unsubDocRef.current = unsub;
  };

  // 1. Listen to Firebase auth state and check stored session on boot
  useEffect(() => {
    // Check saved session in localStorage
    const savedSession = localStorage.getItem('virtual_spin_active_session');
    const savedDemo = localStorage.getItem('virtual_spin_demo_user');

    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.uid) {
          attachUserListener(parsed.uid);
        }
      } catch {
        // ignore
      }
    } else if (savedDemo) {
      try {
        const parsed = JSON.parse(savedDemo) as UserProfile;
        if (parsed.uid) {
          attachUserListener(parsed.uid, parsed);
        }
      } catch {
        // ignore
      }
    }

    const unsubAuth = subscribeAuth(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const profile = await ensureUserProfile(fbUser);
          attachUserListener(fbUser.uid, profile);
        } catch (err) {
          console.error('Error ensuring user profile for Firebase User:', err);
          setLoading(false);
        }
      } else {
        // If not in Firebase Auth, check if custom session exists
        const activeSess = localStorage.getItem('virtual_spin_active_session');
        const activeDemo = localStorage.getItem('virtual_spin_demo_user');
        if (!activeSess && !activeDemo) {
          if (unsubDocRef.current) {
            unsubDocRef.current();
            unsubDocRef.current = null;
          }
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      unsubAuth();
      if (unsubDocRef.current) {
        unsubDocRef.current();
      }
    };
  }, []);

  const handleGoogleSignIn = async (email?: string) => {
    setLoading(true);
    try {
      const profile = await signInWithGoogle(email);
      attachUserListener(profile.uid, profile);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterEmail = async (
    email: string,
    pass: string,
    name: string,
    phone: string
  ) => {
    setLoading(true);
    try {
      const profile = await registerWithEmail(email, pass, name, phone);
      attachUserListener(profile.uid, profile);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const profile = await loginWithEmail(email, pass);
      attachUserListener(profile.uid, profile);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneAuth = async (mobileNumber: string, name?: string) => {
    setLoading(true);
    try {
      const profile = await loginOrRegisterWithPhone(mobileNumber, name);
      attachUserListener(profile.uid, profile);
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemoUser = async (asAdmin = false) => {
    setLoading(true);
    try {
      const uid = asAdmin ? 'admin_test_parikshit' : 'demo_player_9876';
      const demoProfile: UserProfile = {
        uid,
        fullName: asAdmin ? 'Parikshit Monda (Admin)' : 'Rahul Sharma',
        mobileNumber: asAdmin ? '+919876500001' : '+919876543210',
        email: asAdmin ? ADMIN_EMAIL : 'player@virtualspin.local',
        balance: 0, // STRICTLY 0 COINS
        role: asAdmin ? 'admin' : 'user',
        isActive: true,
        createdAt: Date.now(),
      };

      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, demoProfile, { merge: true });

      localStorage.setItem('virtual_spin_active_session', JSON.stringify({ uid, email: demoProfile.email }));
      localStorage.setItem('virtual_spin_demo_user', JSON.stringify(demoProfile));
      attachUserListener(uid, demoProfile);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (unsubDocRef.current) {
      unsubDocRef.current();
      unsubDocRef.current = null;
    }
    await firebaseLogout();
    setUser(null);
  };

  const isAdmin = Boolean(
    user &&
      (user.role === 'admin' ||
        user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isAdmin,
        signInWithGoogle: handleGoogleSignIn,
        registerWithEmail: handleRegisterEmail,
        loginWithEmail: handleLoginEmail,
        loginOrRegisterWithPhone: handlePhoneAuth,
        loginAsDemoUser,
        logout: handleLogout,
        refreshProfile: () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
