import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';
import { UserProfile } from '../types';

export const ADMIN_EMAIL = 'parikshitmonda@gmail.com';

export function generateUserUid(identifier: string): string {
  const clean = identifier.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  return `usr_${clean}`;
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_salt_virtual_spin_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return null;
  }
}

/**
 * Initializes or fetches a user profile.
 * CRITICAL RULE: Newly registered users MUST start with strictly 0 Coins.
 * NO welcome coins, NO signup bonus, NO demo coins, NO free coins.
 */
export async function ensureUserProfile(
  fbUser: FirebaseUser,
  extra?: { fullName?: string; mobileNumber?: string }
): Promise<UserProfile> {
  const userRef = doc(db, 'users', fbUser.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    const data = snap.data() as UserProfile;
    let needsUpdate = false;
    const updates: Partial<UserProfile> = {};

    if (extra?.fullName && (!data.fullName || data.fullName === 'Player')) {
      updates.fullName = extra.fullName;
      data.fullName = extra.fullName;
      needsUpdate = true;
    }
    if (extra?.mobileNumber && !data.mobileNumber) {
      updates.mobileNumber = extra.mobileNumber;
      data.mobileNumber = extra.mobileNumber;
      needsUpdate = true;
    }
    // Auto-grant admin role to user parikshitmonda@gmail.com
    if (fbUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() && data.role !== 'admin') {
      updates.role = 'admin';
      data.role = 'admin';
      needsUpdate = true;
    }
    if (needsUpdate) {
      await updateDoc(userRef, updates);
    }
    return data;
  }

  // Brand new profile
  const isAdmin = fbUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const newProfile: UserProfile = {
    uid: fbUser.uid,
    fullName: extra?.fullName || fbUser.displayName || (isAdmin ? 'Chief Administrator' : 'Player'),
    mobileNumber: extra?.mobileNumber || fbUser.phoneNumber || '',
    email: fbUser.email || '',
    balance: 0, // STRICTLY ZERO COINS FOR NEW USERS
    role: isAdmin ? 'admin' : 'user',
    isActive: true,
    createdAt: Date.now(),
  };

  await setDoc(userRef, newProfile);
  return newProfile;
}

export async function loginOrRegisterGoogleUser(
  email: string,
  displayName?: string
): Promise<UserProfile> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Please enter a valid Google email address.');
  }

  const isAdmin = normalizedEmail === ADMIN_EMAIL.toLowerCase();
  const uid = generateUserUid(normalizedEmail);
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    const existing = snap.data() as UserProfile;
    if (existing.isActive === false) {
      throw new Error('Your account has been deactivated. Please contact an administrator.');
    }
    if (isAdmin && existing.role !== 'admin') {
      await updateDoc(userRef, { role: 'admin' });
      existing.role = 'admin';
    }
    localStorage.setItem(
      'virtual_spin_active_session',
      JSON.stringify({ uid, email: existing.email })
    );
    return existing;
  }

  const newProfile: UserProfile = {
    uid,
    fullName:
      displayName?.trim() ||
      (isAdmin ? 'Chief Administrator' : normalizedEmail.split('@')[0].toUpperCase()),
    mobileNumber: '',
    email: normalizedEmail,
    balance: 0,
    role: isAdmin ? 'admin' : 'user',
    isActive: true,
    createdAt: Date.now(),
  };

  await setDoc(userRef, newProfile);
  localStorage.setItem(
    'virtual_spin_active_session',
    JSON.stringify({ uid, email: newProfile.email })
  );
  return newProfile;
}

export async function signInWithGoogle(fallbackEmail?: string): Promise<UserProfile> {
  if (fallbackEmail) {
    return loginOrRegisterGoogleUser(fallbackEmail);
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const profile = await ensureUserProfile(result.user);
    localStorage.setItem(
      'virtual_spin_active_session',
      JSON.stringify({ uid: profile.uid, email: profile.email })
    );
    return profile;
  } catch (fbErr: unknown) {
    const errCode = (fbErr as { code?: string })?.code || '';
    const errMsg = fbErr instanceof Error ? fbErr.message : '';
    console.warn('Firebase Google Auth popup error:', errCode, errMsg);

    // If popup was blocked or domain not authorized, provide clear error with code attached
    const customErr = new Error(
      errCode === 'auth/unauthorized-domain'
        ? `This domain (${typeof window !== 'undefined' ? window.location.hostname : 'preview'}) is not authorized in Firebase Console Auth settings.`
        : errCode === 'auth/operation-not-allowed'
        ? 'Google Sign-In is not enabled in Firebase Console (Authentication > Sign-in method).'
        : errCode === 'auth/popup-blocked'
        ? 'Popup was blocked by your browser. Please allow popups or use instant Google email sign-in.'
        : errMsg || 'Google sign-in popup failed.'
    );
    (customErr as unknown as { code: string }).code = errCode;
    throw customErr;
  }
}

export async function registerWithEmail(
  email: string,
  pass: string,
  fullName: string,
  mobileNumber: string
): Promise<UserProfile> {
  const normalizedEmail = email.toLowerCase().trim();
  const isAdmin = normalizedEmail === ADMIN_EMAIL.toLowerCase();

  // Try standard Firebase Auth first
  try {
    const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, pass);
    const profile = await ensureUserProfile(cred.user, { fullName, mobileNumber });
    localStorage.setItem(
      'virtual_spin_active_session',
      JSON.stringify({ uid: profile.uid, email: profile.email })
    );
    return profile;
  } catch (fbErr: unknown) {
    const errCode = (fbErr as { code?: string })?.code || '';
    const errMsg = fbErr instanceof Error ? fbErr.message : '';

    // If email already in use in Firebase Auth, throw clear error
    if (errCode === 'auth/email-already-in-use') {
      throw new Error('This email address is already registered. Please sign in instead.');
    }
    if (errCode === 'auth/weak-password') {
      throw new Error('Password must be at least 6 characters long.');
    }
    if (errCode === 'auth/invalid-email') {
      throw new Error('Please provide a valid email address.');
    }

    // If Firebase Auth provider is not enabled (OPERATION_NOT_ALLOWED),
    // proceed with direct Firestore user account registration!
    console.info('Firebase Auth signup bypassed/fallback to Firestore account:', errCode || errMsg);

    const uid = generateUserUid(normalizedEmail);
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      throw new Error('This email address is already registered. Please sign in instead.');
    }

    const pHash = await hashPassword(pass);
    const newProfile: UserProfile = {
      uid,
      fullName: fullName.trim() || (isAdmin ? 'Chief Administrator' : 'Player'),
      mobileNumber: mobileNumber.trim(),
      email: normalizedEmail,
      balance: 0, // STRICTLY ZERO COINS FOR NEW USERS
      role: isAdmin ? 'admin' : 'user',
      isActive: true,
      createdAt: Date.now(),
    };

    // Store in Firestore with hashed credential for verification
    await setDoc(userRef, {
      ...newProfile,
      passwordHash: pHash,
    });

    localStorage.setItem(
      'virtual_spin_active_session',
      JSON.stringify({ uid, email: newProfile.email })
    );

    return newProfile;
  }
}

export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  const normalizedEmail = email.toLowerCase().trim();

  // Try Firebase Auth first
  try {
    const cred = await signInWithEmailAndPassword(auth, normalizedEmail, pass);
    const profile = await ensureUserProfile(cred.user);
    localStorage.setItem(
      'virtual_spin_active_session',
      JSON.stringify({ uid: profile.uid, email: profile.email })
    );
    return profile;
  } catch (fbErr: unknown) {
    // If not in Firebase Auth or provider disabled, check Firestore-backed user accounts
    const uid = generateUserUid(normalizedEmail);
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      throw new Error('No account found with this email. Please click SIGN UP to create an account.');
    }

    const data = snap.data() as UserProfile & { passwordHash?: string };
    if (data.isActive === false) {
      throw new Error('Your account has been deactivated. Please contact an administrator.');
    }

    if (data.passwordHash) {
      const pHash = await hashPassword(pass);
      if (data.passwordHash !== pHash) {
        throw new Error('Incorrect password. Please verify and try again.');
      }
    }

    localStorage.setItem(
      'virtual_spin_active_session',
      JSON.stringify({ uid, email: data.email })
    );

    return data;
  }
}

export async function loginOrRegisterWithPhone(
  mobileNumber: string,
  fullName?: string
): Promise<UserProfile> {
  const cleanPhone = mobileNumber.replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 8) {
    throw new Error('Please enter a valid mobile number with country code (e.g. +919876543210).');
  }

  const uid = `usr_phone_${cleanPhone}`;
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    const existing = snap.data() as UserProfile;
    if (existing.isActive === false) {
      throw new Error('Your account has been deactivated. Please contact an administrator.');
    }
    localStorage.setItem(
      'virtual_spin_active_session',
      JSON.stringify({ uid, email: existing.email })
    );
    return existing;
  }

  const newProfile: UserProfile = {
    uid,
    fullName: fullName?.trim() || `Player ${cleanPhone.slice(-4)}`,
    mobileNumber: mobileNumber.trim(),
    email: `phone_${cleanPhone}@mobile.virtualspin`,
    balance: 0, // STRICTLY ZERO COINS FOR NEW USERS
    role: 'user',
    isActive: true,
    createdAt: Date.now(),
  };

  await setDoc(userRef, newProfile);
  localStorage.setItem(
    'virtual_spin_active_session',
    JSON.stringify({ uid, email: newProfile.email })
  );

  return newProfile;
}

export async function logOut(): Promise<void> {
  localStorage.removeItem('virtual_spin_active_session');
  localStorage.removeItem('virtual_spin_demo_user');
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Sign out warning:', err);
  }
}

export function subscribeAuth(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

