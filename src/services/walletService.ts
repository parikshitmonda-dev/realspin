import {
  doc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  onSnapshot,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Bet,
  CoinRequest,
  LedgerTransaction,
  UserProfile,
  WheelColor,
} from '../types';
import {
  MAX_PENDING_COIN_REQUESTS,
  MIN_COIN_REQUEST_AMOUNT,
  MAX_COIN_REQUEST_AMOUNT,
} from '../utils/constants';
import { CURRENT_ROUND_DOC } from './roundService';

export type BetError =
  | 'LOGIN_REQUIRED'
  | 'NO_COINS_AVAILABLE'
  | 'INSUFFICIENT_BALANCE'
  | 'BETTING_CLOSED'
  | 'INVALID_AMOUNT'
  | 'UNKNOWN';

export interface BetResult {
  success: boolean;
  error?: BetError;
  errorMessage?: string;
  balanceAfter?: number;
}

/**
 * Places a bet on the active round within a strict Firestore transaction.
 */
export async function placeBet(
  user: UserProfile | null,
  roundId: string,
  selectedColor: WheelColor,
  amount: number
): Promise<BetResult> {
  if (!user) {
    return { success: false, error: 'LOGIN_REQUIRED', errorMessage: 'Please log in to place bets.' };
  }

  const betAmount = Math.floor(amount);
  if (isNaN(betAmount) || betAmount <= 0) {
    return { success: false, error: 'INVALID_AMOUNT', errorMessage: 'Please enter a valid coin amount.' };
  }

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. Verify Round is BETTING_OPEN
      const roundRef = doc(db, 'rounds', CURRENT_ROUND_DOC);
      const roundSnap = await transaction.get(roundRef);

      if (!roundSnap.exists()) {
        throw new Error('ROUND_NOT_FOUND');
      }

      const roundData = roundSnap.data();
      if (roundData.status !== 'BETTING_OPEN') {
        throw new Error('BETTING_CLOSED');
      }

      if (Date.now() >= roundData.bettingEndTime) {
        throw new Error('BETTING_CLOSED');
      }

      // 2. Fetch fresh user balance
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists()) {
        throw new Error('USER_NOT_FOUND');
      }

      const freshUserData = userSnap.data() as UserProfile;
      const currentBalance = Number(freshUserData.balance || 0);

      if (currentBalance <= 0) {
        throw new Error('NO_COINS_AVAILABLE');
      }

      if (currentBalance < betAmount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const balanceAfter = currentBalance - betAmount;

      // 3. Deduct User Balance
      transaction.update(userRef, {
        balance: balanceAfter,
        updatedAt: Date.now(),
      });

      // 4. Create Bet Doc
      const betRef = doc(collection(db, 'bets'));
      const newBet: Bet = {
        id: betRef.id,
        roundId,
        userId: user.uid,
        userName: user.fullName || 'Player',
        userMobile: user.mobileNumber || '',
        selectedColor,
        amount: betAmount,
        status: 'PLACED',
        createdAt: Date.now(),
      };
      transaction.set(betRef, newBet);

      // 5. Create Ledger Entry: BET_DEBIT
      const ledgerRef = doc(collection(db, 'ledger'));
      const ledgerEntry: LedgerTransaction = {
        id: ledgerRef.id,
        userId: user.uid,
        userName: user.fullName || 'Player',
        userMobile: user.mobileNumber || '',
        type: 'BET_DEBIT',
        amount: -betAmount,
        balanceBefore: currentBalance,
        balanceAfter,
        description: `Bet placed on ${selectedColor} (Round #${roundData.roundNumber || roundId})`,
        referenceId: roundId,
        createdAt: Date.now(),
      };
      transaction.set(ledgerRef, ledgerEntry);

      // 6. Increment round stats
      const totalBets = Number(roundData.totalBetsCount || 0) + 1;
      const totalCoins = Number(roundData.totalCoinsBet || 0) + betAmount;
      transaction.update(roundRef, {
        totalBetsCount: totalBets,
        totalCoinsBet: totalCoins,
      });

      return { success: true, balanceAfter };
    });

    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'NO_COINS_AVAILABLE') {
      return { success: false, error: 'NO_COINS_AVAILABLE', errorMessage: 'Your current balance is 0 Coins. Please request virtual coins from the administrator.' };
    }
    if (msg === 'INSUFFICIENT_BALANCE') {
      return { success: false, error: 'INSUFFICIENT_BALANCE', errorMessage: 'Insufficient coin balance to place this bet.' };
    }
    if (msg === 'BETTING_CLOSED') {
      return { success: false, error: 'BETTING_CLOSED', errorMessage: 'Betting has closed for this round.' };
    }
    return { success: false, error: 'UNKNOWN', errorMessage: msg || 'Failed to place bet. Please try again.' };
  }
}

/**
 * Creates a coin request with abuse protection:
 * - Max pending requests limit
 * - Duplicate request detection
 * - Amount bounds check
 */
export async function requestVirtualCoins(
  user: UserProfile,
  requestedAmount: number,
  message: string
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  const amount = Math.floor(requestedAmount);

  if (isNaN(amount) || amount < MIN_COIN_REQUEST_AMOUNT || amount > MAX_COIN_REQUEST_AMOUNT) {
    return {
      success: false,
      error: `Requested amount must be between ${MIN_COIN_REQUEST_AMOUNT.toLocaleString()} and ${MAX_COIN_REQUEST_AMOUNT.toLocaleString()} virtual coins.`,
    };
  }

  try {
    // 1. Check pending requests count for this user
    const pendingQuery = query(
      collection(db, 'coin_requests'),
      where('userId', '==', user.uid),
      where('status', '==', 'PENDING')
    );
    const pendingSnap = await getDocs(pendingQuery);

    if (pendingSnap.size >= MAX_PENDING_COIN_REQUESTS) {
      return {
        success: false,
        error: `You already have ${pendingSnap.size} pending coin request(s). Please wait for admin review before submitting another.`,
      };
    }

    // 2. Duplicate detection: same amount within last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const hasDuplicate = pendingSnap.docs.some((d) => {
      const data = d.data() as CoinRequest;
      return data.requestedAmount === amount && data.createdAt > fiveMinutesAgo;
    });

    if (hasDuplicate) {
      return {
        success: false,
        error: 'A request with this exact amount was recently submitted and is pending review.',
      };
    }

    // 3. Create pending request
    const reqRef = doc(collection(db, 'coin_requests'));
    const newRequest: CoinRequest = {
      id: reqRef.id,
      userId: user.uid,
      userName: user.fullName || 'Player',
      userMobile: user.mobileNumber || '',
      userEmail: user.email || '',
      requestedAmount: amount,
      message: message.trim() || 'Please add virtual coins to my account',
      status: 'PENDING',
      createdAt: Date.now(),
    };

    await runTransaction(db, async (tx) => {
      tx.set(reqRef, newRequest);
    });

    return { success: true, requestId: reqRef.id };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to submit coin request.';
    return { success: false, error: errorMsg };
  }
}

/**
 * Gifts virtual coins to another user by mobile number in an atomic transaction.
 */
export async function giftVirtualCoins(
  sender: UserProfile,
  recipientMobile: string,
  amount: number,
  message: string
): Promise<{ success: boolean; error?: string; balanceAfter?: number }> {
  const cleanMobile = recipientMobile.trim();
  const giftAmount = Math.floor(amount);

  if (!cleanMobile) {
    return { success: false, error: 'Recipient mobile number is required.' };
  }
  if (cleanMobile === sender.mobileNumber) {
    return { success: false, error: 'You cannot gift virtual coins to your own mobile number.' };
  }
  if (isNaN(giftAmount) || giftAmount <= 0) {
    return { success: false, error: 'Please enter a valid gift amount.' };
  }

  try {
    // Look up recipient
    const recipientQuery = query(
      collection(db, 'users'),
      where('mobileNumber', '==', cleanMobile),
      limit(1)
    );
    const recipientSnap = await getDocs(recipientQuery);

    if (recipientSnap.empty) {
      return {
        success: false,
        error: `No user found with mobile number "${cleanMobile}". Please verify the number.`,
      };
    }

    const recipientDoc = recipientSnap.docs[0];
    const recipientUid = recipientDoc.id;

    if (recipientUid === sender.uid) {
      return { success: false, error: 'You cannot gift virtual coins to yourself.' };
    }

    const result = await runTransaction(db, async (tx) => {
      const senderRef = doc(db, 'users', sender.uid);
      const recipientRef = doc(db, 'users', recipientUid);

      const [senderDocSnap, recipientDocSnap] = await Promise.all([
        tx.get(senderRef),
        tx.get(recipientRef),
      ]);

      if (!senderDocSnap.exists() || !recipientDocSnap.exists()) {
        throw new Error('Account record missing.');
      }

      const senderData = senderDocSnap.data() as UserProfile;
      const recipientData = recipientDocSnap.data() as UserProfile;

      const senderBalance = Number(senderData.balance || 0);
      if (senderBalance < giftAmount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const senderBalanceAfter = senderBalance - giftAmount;
      const recipientBalance = Number(recipientData.balance || 0);
      const recipientBalanceAfter = recipientBalance + giftAmount;

      tx.update(senderRef, {
        balance: senderBalanceAfter,
        updatedAt: Date.now(),
      });

      tx.update(recipientRef, {
        balance: recipientBalanceAfter,
        updatedAt: Date.now(),
      });

      // Sender Ledger
      const senderLedgerRef = doc(collection(db, 'ledger'));
      tx.set(senderLedgerRef, {
        id: senderLedgerRef.id,
        userId: sender.uid,
        userName: sender.fullName || 'Sender',
        userMobile: sender.mobileNumber || '',
        type: 'GIFT_SENT',
        amount: -giftAmount,
        balanceBefore: senderBalance,
        balanceAfter: senderBalanceAfter,
        description: `Gifted coins to ${recipientData.fullName || cleanMobile}: "${message || 'Enjoy!'}"`,
        referenceId: recipientUid,
        createdAt: Date.now(),
      });

      // Recipient Ledger
      const recipientLedgerRef = doc(collection(db, 'ledger'));
      tx.set(recipientLedgerRef, {
        id: recipientLedgerRef.id,
        userId: recipientUid,
        userName: recipientData.fullName || 'Recipient',
        userMobile: recipientData.mobileNumber || cleanMobile,
        type: 'GIFT_RECEIVED',
        amount: giftAmount,
        balanceBefore: recipientBalance,
        balanceAfter: recipientBalanceAfter,
        description: `Gift received from ${sender.fullName || sender.mobileNumber}: "${message || 'Enjoy!'}"`,
        referenceId: sender.uid,
        createdAt: Date.now(),
      });

      return { success: true, balanceAfter: senderBalanceAfter };
    });

    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'INSUFFICIENT_BALANCE') {
      return { success: false, error: 'Insufficient coin balance to gift this amount.' };
    }
    return { success: false, error: msg || 'Gift transfer failed.' };
  }
}

/**
 * Realtime subscription for user's coin requests.
 */
export function subscribeUserCoinRequests(
  userId: string,
  callback: (requests: CoinRequest[]) => void
) {
  const reqQuery = query(
    collection(db, 'coin_requests'),
    where('userId', '==', userId)
  );

  return onSnapshot(
    reqQuery,
    (snap) => {
      const list: CoinRequest[] = [];
      snap.forEach((d) => list.push(d.data() as CoinRequest));
      list.sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    },
    (err) => console.warn('Coin requests subscription error:', err)
  );
}

/**
 * Realtime subscription for user's ledger transactions.
 */
export function subscribeUserLedger(
  userId: string,
  callback: (ledger: LedgerTransaction[]) => void
) {
  const ledgerQuery = query(
    collection(db, 'ledger'),
    where('userId', '==', userId)
  );

  return onSnapshot(
    ledgerQuery,
    (snap) => {
      const list: LedgerTransaction[] = [];
      snap.forEach((d) => list.push(d.data() as LedgerTransaction));
      list.sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    },
    (err) => console.warn('Ledger subscription error:', err)
  );
}

/**
 * Realtime subscription for bets placed in current round by user.
 */
export function subscribeUserBetsForRound(
  userId: string,
  roundId: string,
  callback: (bets: Bet[]) => void
) {
  const betsQuery = query(
    collection(db, 'bets'),
    where('userId', '==', userId),
    where('roundId', '==', roundId)
  );

  return onSnapshot(
    betsQuery,
    (snap) => {
      const list: Bet[] = [];
      snap.forEach((d) => list.push(d.data() as Bet));
      callback(list);
    },
    (err) => console.warn('Bets subscription error:', err)
  );
}
