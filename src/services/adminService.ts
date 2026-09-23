import {
  doc,
  collection,
  query,
  runTransaction,
  onSnapshot,
  orderBy,
  limit,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  CoinRequest,
  LedgerTransaction,
  UserProfile,
  AdminActivityLog,
} from '../types';
import { CURRENT_ROUND_DOC, createNewRound } from './roundService';

/**
 * Approves a coin request.
 * Transaction:
 * 1. Verify status is PENDING
 * 2. Credit virtual coins to user wallet
 * 3. Update request status to APPROVED
 * 4. Create ledger transaction ADMIN_CREDIT ("Virtual coins added after admin approval.")
 * 5. Create admin activity log
 */
export async function approveCoinRequest(
  requestId: string,
  adminUser: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    await runTransaction(db, async (tx) => {
      const reqRef = doc(db, 'coin_requests', requestId);
      const reqSnap = await tx.get(reqRef);

      if (!reqSnap.exists()) {
        throw new Error('Coin request not found.');
      }

      const reqData = reqSnap.data() as CoinRequest;
      if (reqData.status !== 'PENDING') {
        throw new Error(`Request is already ${reqData.status}.`);
      }

      const userRef = doc(db, 'users', reqData.userId);
      const userSnap = await tx.get(userRef);

      if (!userSnap.exists()) {
        throw new Error('User profile not found.');
      }

      const userData = userSnap.data() as UserProfile;
      const balanceBefore = Number(userData.balance || 0);
      const creditAmount = Number(reqData.requestedAmount || 0);
      const balanceAfter = balanceBefore + creditAmount;

      // 1. Update Request
      tx.update(reqRef, {
        status: 'APPROVED',
        reviewedBy: adminUser.email || adminUser.fullName || adminUser.uid,
        reviewedAt: Date.now(),
      });

      // 2. Credit User
      tx.update(userRef, {
        balance: balanceAfter,
        updatedAt: Date.now(),
      });

      // 3. Ledger record: ADMIN_CREDIT
      const ledgerRef = doc(collection(db, 'ledger'));
      const ledgerItem: LedgerTransaction = {
        id: ledgerRef.id,
        userId: reqData.userId,
        userName: reqData.userName || userData.fullName || 'Player',
        userMobile: reqData.userMobile || userData.mobileNumber || '',
        type: 'ADMIN_CREDIT',
        amount: creditAmount,
        balanceBefore,
        balanceAfter,
        description: 'Virtual coins added after admin approval.',
        referenceId: requestId,
        createdAt: Date.now(),
        createdBy: adminUser.email || adminUser.fullName,
      };
      tx.set(ledgerRef, ledgerItem);

      // 4. Admin log
      const logRef = doc(collection(db, 'admin_logs'));
      const adminLog: AdminActivityLog = {
        id: logRef.id,
        adminUid: adminUser.uid,
        adminEmail: adminUser.email || 'admin',
        action: 'APPROVE_COIN_REQUEST',
        targetUserId: reqData.userId,
        details: `Approved ${creditAmount.toLocaleString()} coins for ${reqData.userName} (${reqData.userMobile}). Balance: ${balanceBefore} -> ${balanceAfter}`,
        createdAt: Date.now(),
      };
      tx.set(logRef, adminLog);
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to approve request.';
    return { success: false, error: msg };
  }
}

/**
 * Rejects a coin request.
 * Wallet remains UNCHANGED!
 * Status updated to REJECTED with reason.
 */
export async function rejectCoinRequest(
  requestId: string,
  reason: string,
  adminUser: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    await runTransaction(db, async (tx) => {
      const reqRef = doc(db, 'coin_requests', requestId);
      const reqSnap = await tx.get(reqRef);

      if (!reqSnap.exists()) {
        throw new Error('Coin request not found.');
      }

      const reqData = reqSnap.data() as CoinRequest;
      if (reqData.status !== 'PENDING') {
        throw new Error(`Request is already ${reqData.status}.`);
      }

      // Wallet unchanged. Update status and reason only.
      tx.update(reqRef, {
        status: 'REJECTED',
        adminReason: reason.trim() || 'Please submit a new request with a valid amount.',
        reviewedBy: adminUser.email || adminUser.fullName || adminUser.uid,
        reviewedAt: Date.now(),
      });

      // Admin log
      const logRef = doc(collection(db, 'admin_logs'));
      const adminLog: AdminActivityLog = {
        id: logRef.id,
        adminUid: adminUser.uid,
        adminEmail: adminUser.email || 'admin',
        action: 'REJECT_COIN_REQUEST',
        targetUserId: reqData.userId,
        details: `Rejected coin request for ${reqData.userName} (${reqData.userMobile}). Reason: ${reason || 'Default'}`,
        createdAt: Date.now(),
      };
      tx.set(logRef, adminLog);
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reject request.';
    return { success: false, error: msg };
  }
}

/**
 * Admin manual adjustment of coins (Credit or Debit) with ledger record.
 */
export async function manualAdjustCoins(
  targetUserId: string,
  amount: number,
  type: 'ADMIN_CREDIT' | 'ADMIN_DEBIT',
  reason: string,
  adminUser: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', targetUserId);
      const userSnap = await tx.get(userRef);

      if (!userSnap.exists()) throw new Error('User not found.');

      const userData = userSnap.data() as UserProfile;
      const currentBalance = Number(userData.balance || 0);
      const delta = type === 'ADMIN_CREDIT' ? Math.abs(amount) : -Math.abs(amount);
      const balanceAfter = Math.max(0, currentBalance + delta);

      tx.update(userRef, { balance: balanceAfter, updatedAt: Date.now() });

      const ledgerRef = doc(collection(db, 'ledger'));
      tx.set(ledgerRef, {
        id: ledgerRef.id,
        userId: targetUserId,
        userName: userData.fullName || 'User',
        userMobile: userData.mobileNumber || '',
        type,
        amount: delta,
        balanceBefore: currentBalance,
        balanceAfter,
        description: `Manual adjustment by Admin: ${reason || 'Administrative correction'}`,
        createdAt: Date.now(),
        createdBy: adminUser.email || adminUser.fullName,
      });

      const logRef = doc(collection(db, 'admin_logs'));
      tx.set(logRef, {
        id: logRef.id,
        adminUid: adminUser.uid,
        adminEmail: adminUser.email || 'admin',
        action: type,
        targetUserId,
        details: `${type} ${Math.abs(amount)} coins for ${userData.fullName}. Reason: ${reason}`,
        createdAt: Date.now(),
      });
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Adjustment failed.';
    return { success: false, error: msg };
  }
}

export function subscribeAllCoinRequests(callback: (list: CoinRequest[]) => void) {
  const q = query(collection(db, 'coin_requests'));
  return onSnapshot(
    q,
    (snap) => {
      const list: CoinRequest[] = [];
      snap.forEach((d) => list.push(d.data() as CoinRequest));
      list.sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    },
    (err) => console.warn('All coin requests error:', err)
  );
}

export function subscribeAllUsers(callback: (list: UserProfile[]) => void) {
  const q = query(collection(db, 'users'));
  return onSnapshot(
    q,
    (snap) => {
      const list: UserProfile[] = [];
      snap.forEach((d) => list.push(d.data() as UserProfile));
      list.sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    },
    (err) => console.warn('All users error:', err)
  );
}

export function subscribeAllLedger(callback: (list: LedgerTransaction[]) => void) {
  const q = query(collection(db, 'ledger'));
  return onSnapshot(
    q,
    (snap) => {
      const list: LedgerTransaction[] = [];
      snap.forEach((d) => list.push(d.data() as LedgerTransaction));
      list.sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    },
    (err) => console.warn('All ledger error:', err)
  );
}

export function subscribeAdminLogs(callback: (list: AdminActivityLog[]) => void) {
  const q = query(collection(db, 'admin_logs'));
  return onSnapshot(
    q,
    (snap) => {
      const list: AdminActivityLog[] = [];
      snap.forEach((d) => list.push(d.data() as AdminActivityLog));
      list.sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    },
    (err) => console.warn('Admin logs error:', err)
  );
}

/**
 * Permanently deletes a player user account from Firestore.
 */
export async function deleteUserAccount(
  targetUserId: string,
  targetUserName: string,
  adminUser: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', targetUserId);
    await deleteDoc(userRef);

    // Record in admin activity log
    const logRef = doc(collection(db, 'admin_logs'));
    await setDoc(logRef, {
      id: logRef.id,
      adminUid: adminUser.uid,
      adminEmail: adminUser.email || 'admin',
      action: 'DELETE_USER',
      targetUserId,
      details: `Permanently removed player account: ${targetUserName} (UID: ${targetUserId})`,
      createdAt: Date.now(),
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete user.';
    return { success: false, error: msg };
  }
}

/**
 * Toggles user active status (Ban or Unban).
 */
export async function toggleUserActiveStatus(
  targetUserId: string,
  isActive: boolean,
  targetUserName: string,
  adminUser: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', targetUserId);
    await updateDoc(userRef, {
      isActive,
      updatedAt: Date.now(),
    });

    const logRef = doc(collection(db, 'admin_logs'));
    await setDoc(logRef, {
      id: logRef.id,
      adminUid: adminUser.uid,
      adminEmail: adminUser.email || 'admin',
      action: isActive ? 'UNBAN_USER' : 'BAN_USER',
      targetUserId,
      details: isActive
        ? `Re-activated player account: ${targetUserName}`
        : `Suspended/Banned player account: ${targetUserName}`,
      createdAt: Date.now(),
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update user status.';
    return { success: false, error: msg };
  }
}

/**
 * Resets user balance to 0.
 */
export async function resetUserBalance(
  targetUserId: string,
  adminUser: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    let balanceBefore = 0;
    let userName = 'Player';

    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', targetUserId);
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error('User not found.');

      const data = snap.data() as UserProfile;
      balanceBefore = Number(data.balance || 0);
      userName = data.fullName || 'Player';

      tx.update(userRef, { balance: 0, updatedAt: Date.now() });

      const ledgerRef = doc(collection(db, 'ledger'));
      tx.set(ledgerRef, {
        id: ledgerRef.id,
        userId: targetUserId,
        userName,
        userMobile: data.mobileNumber || '',
        type: 'ADMIN_DEBIT',
        amount: -balanceBefore,
        balanceBefore,
        balanceAfter: 0,
        description: 'Account balance reset to 0 by Administrator.',
        createdAt: Date.now(),
        createdBy: adminUser.email || adminUser.fullName,
      });

      const logRef = doc(collection(db, 'admin_logs'));
      tx.set(logRef, {
        id: logRef.id,
        adminUid: adminUser.uid,
        adminEmail: adminUser.email || 'admin',
        action: 'RESET_BALANCE',
        targetUserId,
        details: `Reset balance for ${userName} from ${balanceBefore.toLocaleString()} to 0 Coins.`,
        createdAt: Date.now(),
      });
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reset balance.';
    return { success: false, error: msg };
  }
}

/**
 * Sets exact user balance.
 */
export async function manualSetExactBalance(
  targetUserId: string,
  newBalance: number,
  reason: string,
  adminUser: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    const safeBalance = Math.max(0, Math.floor(newBalance));

    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', targetUserId);
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error('User not found.');

      const data = snap.data() as UserProfile;
      const currentBalance = Number(data.balance || 0);
      const diff = safeBalance - currentBalance;
      const type = diff >= 0 ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT';

      tx.update(userRef, { balance: safeBalance, updatedAt: Date.now() });

      const ledgerRef = doc(collection(db, 'ledger'));
      tx.set(ledgerRef, {
        id: ledgerRef.id,
        userId: targetUserId,
        userName: data.fullName || 'Player',
        userMobile: data.mobileNumber || '',
        type,
        amount: diff,
        balanceBefore: currentBalance,
        balanceAfter: safeBalance,
        description: `Admin set exact balance: ${reason || 'Manual balance override'}`,
        createdAt: Date.now(),
        createdBy: adminUser.email || adminUser.fullName,
      });

      const logRef = doc(collection(db, 'admin_logs'));
      tx.set(logRef, {
        id: logRef.id,
        adminUid: adminUser.uid,
        adminEmail: adminUser.email || 'admin',
        action: 'SET_EXACT_BALANCE',
        targetUserId,
        details: `Set balance for ${data.fullName} to ${safeBalance.toLocaleString()} (was ${currentBalance.toLocaleString()})`,
        createdAt: Date.now(),
      });
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to set balance.';
    return { success: false, error: msg };
  }
}
