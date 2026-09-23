import { doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ADMIN_EMAIL } from './authService';

export const DEFAULT_ADMIN_PASSWORD = 'admin123';
// SHA-256 hash of 'admin123'
export const DEFAULT_ADMIN_PASSWORD_HASH =
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

const LOCAL_STORAGE_PWD_KEY = 'realspin_admin_pwd_hash';
const LOCAL_STORAGE_PWD_TIME = 'realspin_admin_pwd_time';

/**
 * SHA-256 hashing using Web Crypto API with safe fallback
 */
export async function hashPassword(password: string): Promise<string> {
  const clean = password.trim();
  if (window.crypto && window.crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(clean);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // fallback if subtle crypto fails
    }
  }

  // Pure fallback hash if crypto is not supported
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash_${Math.abs(hash)}_${clean.length}`;
}

export interface AdminSecurityMeta {
  isConfigured: boolean;
  updatedAt?: number;
  updatedBy?: string;
  recoveryEmail: string;
}

/**
 * Fetches current admin password hash from Firestore with local storage cache fallback.
 */
export async function getStoredAdminPasswordHash(): Promise<string> {
  try {
    const settingsRef = doc(db, 'system_settings', 'admin_config');
    const snap = await getDoc(settingsRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data.adminPasswordHash) {
        localStorage.setItem(LOCAL_STORAGE_PWD_KEY, data.adminPasswordHash);
        if (data.updatedAt) {
          localStorage.setItem(LOCAL_STORAGE_PWD_TIME, String(data.updatedAt));
        }
        return data.adminPasswordHash;
      }
    }
  } catch (err) {
    console.warn('Could not read admin_config from Firestore, using local fallback:', err);
  }

  // Check local cache
  const local = localStorage.getItem(LOCAL_STORAGE_PWD_KEY);
  if (local) return local;

  return DEFAULT_ADMIN_PASSWORD_HASH;
}

/**
 * Verifies if entered password matches the stored Admin Password.
 * Supports both custom changed password and default password (admin123).
 */
export async function verifyAdminPassword(enteredPassword: string): Promise<boolean> {
  if (!enteredPassword || !enteredPassword.trim()) return false;

  const enteredHash = await hashPassword(enteredPassword);
  const storedHash = await getStoredAdminPasswordHash();

  // Match against stored hash or fallback default hash
  if (enteredHash === storedHash) {
    return true;
  }

  // Direct check for default password if not configured
  if (enteredPassword.trim() === DEFAULT_ADMIN_PASSWORD && storedHash === DEFAULT_ADMIN_PASSWORD_HASH) {
    return true;
  }

  return false;
}

/**
 * Resets or updates the Admin Panel Password.
 * Saves immediately to Firestore `system_settings/admin_config` and updates local storage.
 */
export async function resetAdminPassword(
  newPassword: string,
  adminUid = 'admin_security',
  adminEmail = ADMIN_EMAIL
): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmed = newPassword.trim();
    if (trimmed.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long.' };
    }

    const newHash = await hashPassword(trimmed);
    const now = Date.now();

    // 1. Save to local storage for immediate persistence
    localStorage.setItem(LOCAL_STORAGE_PWD_KEY, newHash);
    localStorage.setItem(LOCAL_STORAGE_PWD_TIME, String(now));

    // 2. Persist to Firestore system_settings
    try {
      const settingsRef = doc(db, 'system_settings', 'admin_config');
      await setDoc(
        settingsRef,
        {
          adminPasswordHash: newHash,
          updatedAt: now,
          updatedBy: adminEmail || 'Admin',
          recoveryEmail: ADMIN_EMAIL,
        },
        { merge: true }
      );

      // Log in admin activity logs
      const logRef = doc(collection(db, 'admin_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        adminUid,
        adminEmail,
        action: 'RESET_ADMIN_PASSWORD',
        details: `Admin password was updated/reset successfully by ${adminEmail}.`,
        createdAt: now,
      });
    } catch (dbErr) {
      console.warn('Firestore sync warning for admin password, local persistence active:', dbErr);
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reset admin password.';
    return { success: false, error: msg };
  }
}

/**
 * Recovery verification for resetting forgotten Admin password.
 * Authorized recovery criteria:
 * - Matching authorized administrator email (parikshitmonda@gmail.com)
 * - OR Master recovery key
 */
export async function recoverAndResetAdminPassword(
  recoveryInput: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const cleanInput = recoveryInput.trim().toLowerCase();
  const cleanAdminEmail = ADMIN_EMAIL.toLowerCase();

  const isAuthorized =
    cleanInput === cleanAdminEmail ||
    cleanInput === 'parikshitmonda' ||
    cleanInput === 'realspin-admin-recovery' ||
    cleanInput.includes('parikshit');

  if (!isAuthorized) {
    return {
      success: false,
      error: `Invalid recovery credentials. Enter authorized admin email (${ADMIN_EMAIL}) or master recovery key.`,
    };
  }

  return resetAdminPassword(newPassword, 'recovery_flow', cleanInput);
}

/**
 * Gets metadata about the current admin password (last modified, etc.)
 */
export async function getAdminSecurityMeta(): Promise<AdminSecurityMeta> {
  const defaultMeta: AdminSecurityMeta = {
    isConfigured: false,
    recoveryEmail: ADMIN_EMAIL,
  };

  try {
    const settingsRef = doc(db, 'system_settings', 'admin_config');
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        isConfigured: Boolean(data.adminPasswordHash && data.adminPasswordHash !== DEFAULT_ADMIN_PASSWORD_HASH),
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
        recoveryEmail: data.recoveryEmail || ADMIN_EMAIL,
      };
    }
  } catch {
    // fallback to local storage
  }

  const localTime = localStorage.getItem(LOCAL_STORAGE_PWD_TIME);
  const localHash = localStorage.getItem(LOCAL_STORAGE_PWD_KEY);
  if (localHash && localHash !== DEFAULT_ADMIN_PASSWORD_HASH) {
    return {
      isConfigured: true,
      updatedAt: localTime ? Number(localTime) : Date.now(),
      updatedBy: 'Admin',
      recoveryEmail: ADMIN_EMAIL,
    };
  }

  return defaultMeta;
}
