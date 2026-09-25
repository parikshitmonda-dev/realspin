import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { GameRound, WheelColor, Bet, GameControlSettings, UserProfile } from '../types';
import {
  WHEEL_COLORS,
  WHEEL_SLICES,
  WIN_MULTIPLIER,
  MIN_SPIN_DURATION_MS,
  MAX_SPIN_DURATION_MS,
  RESULT_DISPLAY_MS,
} from '../utils/constants';

export const CURRENT_ROUND_DOC = 'current_round';

/**
 * Calculates target angle in degrees for the winning slice.
 * SVG wheel is configured so 0° is 12 o'clock (under the fixed top pointer).
 * Center angles:
 * Slice 0 (DARK RED): 0° -> rotation = N * 360 + 0°
 * Slice 1 (DARK PINK): 72° -> rotation = N * 360 + (360 - 72) = N * 360 + 288°
 * Slice 2 (DARK BLUE): 144° -> rotation = N * 360 + (360 - 144) = N * 360 + 216°
 * Slice 3 (DARK GREEN): 216° -> rotation = N * 360 + (360 - 216) = N * 360 + 144°
 * Slice 4 (DARK PURPLE): 288° -> rotation = N * 360 + (360 - 288) = N * 360 + 72°
 */
export function calculateTargetAngle(
  color: WheelColor,
  baseAngle = 0,
  fullRotations = 54 // 0.5x faster rotational speed (increased revolutions from 36-42 to 48-54)
): number {
  const slice = WHEEL_SLICES.find((s) => s.name === color);
  if (!slice) return baseAngle + fullRotations * 360;

  // Midpoint angle of slice relative to top (12 o'clock)
  const sliceCenter = (slice.startAngle + slice.endAngle) / 2; // e.g. 0, 72, 144, 216, 288
  // Add a slight random jitter within +/- 14 degrees so it's realistically within slice bounds
  const jitter = (Math.random() - 0.5) * 14;
  const normalizedCenter = (sliceCenter + 360) % 360;
  const stopOffset = (360 - normalizedCenter + jitter + 360) % 360;

  const currentTurns = Math.floor(baseAngle / 360) * 360;
  let target = currentTurns + fullRotations * 360 + stopOffset;
  while (target <= baseAngle + 48 * 360) {
    target += 360;
  }

  return target;
}

export function pickRandomColor(): WheelColor {
  const index = Math.floor(Math.random() * WHEEL_COLORS.length);
  return WHEEL_COLORS[index];
}

export const ACTIVE_ROUND_STORAGE_KEY = 'realspin_active_round';

export function getCachedCurrentRound(): GameRound | null {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(ACTIVE_ROUND_STORAGE_KEY);
    if (!raw) return null;
    const round = JSON.parse(raw) as GameRound;
    if (round && round.id && typeof round.bettingEndTime === 'number') {
      return round;
    }
  } catch {
    // non-fatal
  }
  return null;
}

export function saveCachedCurrentRound(round: GameRound | null): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    if (!round) {
      localStorage.removeItem(ACTIVE_ROUND_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_ROUND_STORAGE_KEY, JSON.stringify(round));
  } catch {
    // non-fatal
  }
}

let isAdvancingLock = false;

/**
 * Concurrency-safe, atomic round progression using Firestore transaction.
 * Ensures that even across multiple tabs, clients, or rapid timer ticks,
 * a completed round advances exactly once and active rounds are never overwritten.
 */
export async function advanceToNextRound(completedRound: GameRound): Promise<GameRound | null> {
  if (isAdvancingLock) return null;
  isAdvancingLock = true;
  try {
    const currentRef = doc(db, 'rounds', CURRENT_ROUND_DOC);
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(currentRef);
      if (!snap.exists()) {
        return null;
      }
      const current = snap.data() as GameRound;

      // If already advanced by another client or tab (different id and higher round number)
      if (current.id !== completedRound.id && current.roundNumber > (completedRound.roundNumber || 0)) {
        return current;
      }

      const now = Date.now();
      // If round is still active and betting time has not elapsed, never overwrite
      if (current.status === 'BETTING_OPEN' && now < current.bettingEndTime) {
        return current;
      }

      let bettingDuration = 180 * 1000; // default 3 minutes (180s)
      let winningColor = pickRandomColor();
      let adminOverridden = false;

      // Check admin settings
      try {
        const controlRef = doc(db, 'system_settings', 'game_control');
        const controlSnap = await tx.get(controlRef);
        if (controlSnap.exists()) {
          const cfg = controlSnap.data() as GameControlSettings;
          if (cfg.nextForcedColor) {
            winningColor = cfg.nextForcedColor;
            adminOverridden = true;
            if (cfg.autoResetForcedColor !== false) {
              tx.update(controlRef, { nextForcedColor: null });
            }
          }
          if (cfg.bettingDurationSeconds && cfg.bettingDurationSeconds >= 15) {
            bettingDuration = cfg.bettingDurationSeconds * 1000;
          }
        }
      } catch {
        // non-fatal
      }

      const spinDuration =
        Math.floor(Math.random() * (MAX_SPIN_DURATION_MS - MIN_SPIN_DURATION_MS)) +
        MIN_SPIN_DURATION_MS;

      const bettingEndTime = now + bettingDuration;
      const spinEndTime = bettingEndTime + spinDuration;
      const targetAngle = calculateTargetAngle(winningColor, completedRound.targetAngle || 0);

      const roundNumber = (completedRound.roundNumber || 0) + 1;
      const roundId = `RND-${Date.now().toString().slice(-6)}-${roundNumber}`;

      const prior = completedRound.recentWinningColors || [];
      const updatedRecent =
        prior[0] === completedRound.winningColor
          ? prior
          : [completedRound.winningColor, ...prior.filter((_, i) => i < 9)];

      const nextRound: GameRound = {
        id: roundId,
        roundNumber,
        status: 'BETTING_OPEN',
        startTime: now,
        bettingEndTime,
        spinDuration,
        spinEndTime,
        winningColor,
        targetAngle,
        totalBetsCount: 0,
        totalCoinsBet: 0,
        payoutProcessed: false,
        adminOverridden,
        recentWinningColors: updatedRecent,
        createdAt: now,
      };

      tx.set(currentRef, nextRound);
      const archiveRef = doc(db, 'rounds', roundId);
      tx.set(archiveRef, nextRound);

      return nextRound;
    });

    if (result) {
      saveCachedCurrentRound(result);
    }
    return result;
  } catch (err) {
    console.error('advanceToNextRound error:', err);
    return null;
  } finally {
    isAdvancingLock = false;
  }
}

/**
 * Creates a new synchronized global round.
 * Betting open for configured duration (default 3 minutes = 180 seconds).
 */
export async function createNewRound(
  previousRoundNumber = 0,
  previousTargetAngle = 0,
  forcedWinningColor?: WheelColor,
  existingRecentColors?: WheelColor[]
): Promise<GameRound> {
  const now = Date.now();
  const spinDuration =
    Math.floor(Math.random() * (MAX_SPIN_DURATION_MS - MIN_SPIN_DURATION_MS)) +
    MIN_SPIN_DURATION_MS;

  let bettingDuration = 180 * 1000; // 3 minutes (180s) betting open before wheel spins
  let winningColor = forcedWinningColor || pickRandomColor();
  let adminOverridden = Boolean(forcedWinningColor);

  // Check if admin preset a forced color or custom duration in system_settings/game_control
  if (!forcedWinningColor) {
    try {
      const controlRef = doc(db, 'system_settings', 'game_control');
      const snap = await getDoc(controlRef);
      if (snap.exists()) {
        const cfg = snap.data() as GameControlSettings;
        if (cfg.nextForcedColor) {
          winningColor = cfg.nextForcedColor;
          adminOverridden = true;
          // Clear if autoResetForcedColor is true
          if (cfg.autoResetForcedColor !== false) {
            await updateDoc(controlRef, { nextForcedColor: null }).catch(() => {});
          }
        }
        if (cfg.bettingDurationSeconds && cfg.bettingDurationSeconds >= 15) {
          bettingDuration = cfg.bettingDurationSeconds * 1000;
        }
      }
    } catch {
      // non-fatal
    }
  }

  // Preserve or fetch recent winning colors
  let recentColors = existingRecentColors;
  if (!recentColors || recentColors.length === 0) {
    try {
      const currentRef = doc(db, 'rounds', CURRENT_ROUND_DOC);
      const snap = await getDoc(currentRef);
      if (snap.exists()) {
        const prev = snap.data() as GameRound;
        if (prev.recentWinningColors && prev.recentWinningColors.length > 0) {
          recentColors = prev.recentWinningColors;
        }
      }
    } catch {
      // non-fatal
    }
  }

  const bettingEndTime = now + bettingDuration;
  const spinEndTime = bettingEndTime + spinDuration;
  const targetAngle = calculateTargetAngle(winningColor, previousTargetAngle || 0);

  const roundNumber = previousRoundNumber + 1;
  const roundId = `RND-${Date.now().toString().slice(-6)}-${roundNumber}`;

  const newRound: GameRound = {
    id: roundId,
    roundNumber,
    status: 'BETTING_OPEN',
    startTime: now,
    bettingEndTime,
    spinDuration,
    spinEndTime,
    winningColor,
    targetAngle,
    totalBetsCount: 0,
    totalCoinsBet: 0,
    payoutProcessed: false,
    adminOverridden,
    recentWinningColors: recentColors || [],
    createdAt: now,
  };

  try {
    const currentRef = doc(db, 'rounds', CURRENT_ROUND_DOC);
    await setDoc(currentRef, newRound);

    // Also archive round
    const archiveRef = doc(db, 'rounds', roundId);
    await setDoc(archiveRef, newRound);
  } catch (err) {
    console.warn('Firestore round persist warning (using local fallback):', err);
  }

  saveCachedCurrentRound(newRound);
  return newRound;
}

/**
 * Realtime listener for the active round with persistent cache and resilient offline support.
 * Never resets the timer or creates an unrequested new round on refresh.
 */
export function subscribeCurrentRound(callback: (round: GameRound | null) => void) {
  // 1. Immediately provide cached round from local storage for instant zero-latency rendering
  const cached = getCachedCurrentRound();
  if (cached) {
    callback(cached);
  }

  // 2. Real-time subscription to active round document in Firestore
  const currentRef = doc(db, 'rounds', CURRENT_ROUND_DOC);
  const unsub = onSnapshot(
    currentRef,
    async (snapshot) => {
      if (snapshot.exists()) {
        const round = snapshot.data() as GameRound;
        saveCachedCurrentRound(round);
        callback(round);
      } else {
        // Initialize first round only if no round exists at all in the database
        try {
          const firstRound = await createNewRound(0);
          saveCachedCurrentRound(firstRound);
          callback(firstRound);
        } catch {
          callback(null);
        }
      }
    },
    (err) => {
      console.warn('Current round snapshot warning:', err);
      // Resilient fallback: never overwrite an active round on connection errors!
      const fallbackCached = getCachedCurrentRound();
      if (fallbackCached) {
        callback(fallbackCached);
      }
    }
  );

  return unsub;
}

/**
 * Checks round timing and transitions status if needed:
 * BETTING_OPEN -> SPINNING -> COMPLETED -> Next Round.
 * Keeps spin timer completely consistent across page reloads.
 */
export async function syncRoundProgress(round: GameRound): Promise<void> {
  const now = Date.now();
  const currentRef = doc(db, 'rounds', CURRENT_ROUND_DOC);

  // If the round has completely expired in the past (e.g. user reopens app after a long time)
  if (now >= round.spinEndTime + RESULT_DISPLAY_MS) {
    await advanceToNextRound(round);
    return;
  }

  // 1. Betting open -> Betting closed / Spinning
  if (round.status === 'BETTING_OPEN' && now >= round.bettingEndTime) {
    try {
      await updateDoc(currentRef, { status: 'SPINNING' });
      const archiveRef = doc(db, 'rounds', round.id);
      await updateDoc(archiveRef, { status: 'SPINNING' }).catch(() => {});
      saveCachedCurrentRound({ ...round, status: 'SPINNING' });
    } catch {}
    return;
  }

  // 2. Spinning -> Completed
  if (round.status === 'SPINNING' && now >= round.spinEndTime) {
    const prior = round.recentWinningColors || [];
    const updatedRecent =
      prior[0] === round.winningColor
        ? prior
        : [round.winningColor, ...prior.filter((_, i) => i < 9)];

    try {
      await updateDoc(currentRef, {
        status: 'COMPLETED',
        recentWinningColors: updatedRecent,
      });
      const archiveRef = doc(db, 'rounds', round.id);
      await updateDoc(archiveRef, {
        status: 'COMPLETED',
        recentWinningColors: updatedRecent,
      }).catch(() => {});

      saveCachedCurrentRound({
        ...round,
        status: 'COMPLETED',
        recentWinningColors: updatedRecent,
      });

      // Trigger payout processing
      if (!round.payoutProcessed) {
        await processRoundPayout(round);
      }
    } catch {}
    return;
  }

  // 3. Completed -> Next round after RESULT_DISPLAY_MS
  if (round.status === 'COMPLETED' && now >= round.spinEndTime + RESULT_DISPLAY_MS) {
    await advanceToNextRound(round);
  }
}

/**
 * Processes payouts for winning bets in the round.
 * Payout: 4 x original bet!
 * Atomic ledger entry: WIN_CREDIT
 */
export async function processRoundPayout(round: GameRound): Promise<void> {
  try {
    const currentRef = doc(db, 'rounds', CURRENT_ROUND_DOC);
    const archiveRef = doc(db, 'rounds', round.id);

    await updateDoc(currentRef, { payoutProcessed: true }).catch(() => {});
    await updateDoc(archiveRef, { payoutProcessed: true }).catch(() => {});

    // Fetch bets placed for this round
    const betsQuery = query(collection(db, 'bets'), where('roundId', '==', round.id));
    const betsSnap = await getDocs(betsQuery);

    if (betsSnap.empty) return;

    for (const betDoc of betsSnap.docs) {
      const bet = betDoc.data() as Bet;
      if (bet.status !== 'PLACED') continue;

      if (bet.selectedColor === round.winningColor) {
        // Winner!
        const payoutAmount = bet.amount * WIN_MULTIPLIER;

        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', bet.userId);
          const userSnap = await transaction.get(userRef);

          if (!userSnap.exists()) return;

          const userData = userSnap.data();
          const balanceBefore = Number(userData.balance || 0);
          const balanceAfter = balanceBefore + payoutAmount;

          // Credit winner
          transaction.update(userRef, {
            balance: balanceAfter,
            updatedAt: Date.now(),
          });

          // Update bet record
          transaction.update(betDoc.ref, {
            status: 'WON',
            payout: payoutAmount,
          });

          // Ledger record WIN_CREDIT
          const ledgerRef = doc(collection(db, 'ledger'));
          transaction.set(ledgerRef, {
            id: ledgerRef.id,
            userId: bet.userId,
            userName: bet.userName,
            userMobile: bet.userMobile || '',
            type: 'WIN_CREDIT',
            amount: payoutAmount,
            balanceBefore,
            balanceAfter,
            description: `Won 4x on ${bet.selectedColor} in Round #${round.roundNumber}!`,
            referenceId: round.id,
            createdAt: Date.now(),
          });
        });
      } else {
        // Lost bet (coins were deducted on placement)
        await updateDoc(betDoc.ref, {
          status: 'LOST',
          payout: 0,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Error processing round payouts:', err);
  }
}

/**
 * Fetch recent rounds history
 */
export async function getRecentRounds(count = 10): Promise<GameRound[]> {
  try {
    const roundsQuery = query(
      collection(db, 'rounds'),
      where('status', '==', 'COMPLETED'),
      limit(count)
    );
    const snap = await getDocs(roundsQuery);
    const rounds: GameRound[] = [];
    snap.forEach((d) => {
      if (d.id !== CURRENT_ROUND_DOC) {
        rounds.push(d.data() as GameRound);
      }
    });
    return rounds.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/**
 * Admin override: Immediately changes the active round's winning color.
 * Re-calculates wheel target angle so when it spins or finishes, it lands on this exact color.
 */
export async function overrideCurrentRoundWinningColor(
  color: WheelColor,
  adminUser?: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentRef = doc(db, 'rounds', CURRENT_ROUND_DOC);
    const snap = await getDoc(currentRef);
    if (!snap.exists()) throw new Error('Active round not found.');
    const round = snap.data() as GameRound;

    const baseAngle = round.targetAngle ? round.targetAngle - 36 * 360 : 0;
    const newTargetAngle = calculateTargetAngle(color, baseAngle);

    await updateDoc(currentRef, {
      winningColor: color,
      targetAngle: newTargetAngle,
      adminOverridden: true,
      overriddenBy: adminUser?.email || adminUser?.fullName || 'Master Admin',
    });

    if (round.id) {
      const archRef = doc(db, 'rounds', round.id);
      await updateDoc(archRef, {
        winningColor: color,
        targetAngle: newTargetAngle,
        adminOverridden: true,
      }).catch(() => {});
    }

    saveCachedCurrentRound({
      ...round,
      winningColor: color,
      targetAngle: newTargetAngle,
      adminOverridden: true,
      overriddenBy: adminUser?.email || adminUser?.fullName || 'Master Admin',
    });

    try {
      const logRef = doc(collection(db, 'admin_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        adminUid: adminUser?.uid || 'admin',
        adminEmail: adminUser?.email || 'admin',
        action: 'OVERRIDE_CURRENT_WINNER',
        details: `Active Round #${round.roundNumber}: Forced winning color to ${color}`,
        createdAt: Date.now(),
      });
    } catch {}

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to override winning color.';
    return { success: false, error: msg };
  }
}

/**
 * Admin action: Force wheel to start spinning immediately (ends betting now).
 */
export async function forceSpinCurrentRound(
  adminUser?: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentRef = doc(db, 'rounds', CURRENT_ROUND_DOC);
    const snap = await getDoc(currentRef);
    if (!snap.exists()) throw new Error('Active round not found.');
    const round = snap.data() as GameRound;

    const now = Date.now();
    const spinDuration = 25000; // 25s (within 20s-30s duration range)
    const updates = {
      status: 'SPINNING' as const,
      bettingEndTime: now - 1000,
      spinEndTime: now + spinDuration,
    };

    await updateDoc(currentRef, updates);
    if (round.id) {
      const archRef = doc(db, 'rounds', round.id);
      await updateDoc(archRef, updates).catch(() => {});
    }

    saveCachedCurrentRound({ ...round, ...updates });

    try {
      const logRef = doc(collection(db, 'admin_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        adminUid: adminUser?.uid || 'admin',
        adminEmail: adminUser?.email || 'admin',
        action: 'FORCE_SPIN_ROUND',
        details: `Forced spin start for Round #${round.roundNumber}`,
        createdAt: Date.now(),
      });
    } catch {}

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to force spin.';
    return { success: false, error: msg };
  }
}

/**
 * Admin action: Force round completion and immediate payouts.
 */
export async function forceCompleteCurrentRound(
  adminUser?: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentRef = doc(db, 'rounds', CURRENT_ROUND_DOC);
    const snap = await getDoc(currentRef);
    if (!snap.exists()) throw new Error('Active round not found.');
    const round = snap.data() as GameRound;

    const now = Date.now();
    const updates = {
      status: 'COMPLETED' as const,
      spinEndTime: now - 500,
    };

    await updateDoc(currentRef, updates);
    if (round.id) {
      const archRef = doc(db, 'rounds', round.id);
      await updateDoc(archRef, updates).catch(() => {});
    }

    saveCachedCurrentRound({ ...round, ...updates });

    await processRoundPayout({ ...round, status: 'COMPLETED' });

    try {
      const logRef = doc(collection(db, 'admin_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        adminUid: adminUser?.uid || 'admin',
        adminEmail: adminUser?.email || 'admin',
        action: 'FORCE_COMPLETE_ROUND',
        details: `Forced round completion and payout for Round #${round.roundNumber}`,
        createdAt: Date.now(),
      });
    } catch {}

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to complete round.';
    return { success: false, error: msg };
  }
}

/**
 * Admin setting: Pre-select winning color for next round.
 */
export async function setNextRoundPreselectedColor(
  color: WheelColor | null,
  mode: 'AUTO_RANDOM' | 'FORCED_COLOR' | 'LOWEST_PAYOUT_WINS' | 'HIGHEST_PAYOUT_WINS' = 'FORCED_COLOR',
  autoReset = true,
  adminUser?: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    const controlRef = doc(db, 'system_settings', 'game_control');
    const data: GameControlSettings = {
      nextForcedColor: color,
      mode,
      autoResetForcedColor: autoReset,
      updatedAt: Date.now(),
      updatedBy: adminUser?.email || adminUser?.fullName || 'Master Admin',
    };
    await setDoc(controlRef, data, { merge: true });

    try {
      const logRef = doc(collection(db, 'admin_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        adminUid: adminUser?.uid || 'admin',
        adminEmail: adminUser?.email || 'admin',
        action: 'SET_NEXT_ROUND_WINNER',
        details: color
          ? `Pre-selected next round winner: ${color} (Mode: ${mode})`
          : `Next round mode set to: ${mode}`,
        createdAt: Date.now(),
      });
    } catch {}

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save next round configuration.';
    return { success: false, error: msg };
  }
}

/**
 * Admin setting: Update betting duration.
 */
export async function setGameTimingSetting(
  bettingDurationSeconds: number,
  adminUser?: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    const controlRef = doc(db, 'system_settings', 'game_control');
    await setDoc(
      controlRef,
      {
        bettingDurationSeconds,
        updatedAt: Date.now(),
        updatedBy: adminUser?.email || adminUser?.fullName || 'Master Admin',
      },
      { merge: true }
    );

    try {
      const logRef = doc(collection(db, 'admin_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        adminUid: adminUser?.uid || 'admin',
        adminEmail: adminUser?.email || 'admin',
        action: 'UPDATE_BETTING_TIMER',
        details: `Betting duration updated to ${bettingDurationSeconds} seconds`,
        createdAt: Date.now(),
      });
    } catch {}

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update timing.';
    return { success: false, error: msg };
  }
}

/**
 * Real-time subscription to game control settings.
 */
export function subscribeGameControlSettings(
  callback: (settings: GameControlSettings | null) => void
) {
  const controlRef = doc(db, 'system_settings', 'game_control');
  return onSnapshot(
    controlRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as GameControlSettings);
      } else {
        callback({
          nextForcedColor: null,
          mode: 'AUTO_RANDOM',
          autoResetForcedColor: true,
          bettingDurationSeconds: 180,
        });
      }
    },
    (err) => console.warn('Game control settings snapshot warning:', err)
  );
}

/**
 * Real-time subscription to bets placed on the active round.
 */
export function subscribeCurrentRoundBets(
  roundId: string,
  callback: (bets: Bet[]) => void
) {
  if (!roundId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'bets'), where('roundId', '==', roundId));
  return onSnapshot(
    q,
    (snap) => {
      const list: Bet[] = [];
      snap.forEach((d) => list.push(d.data() as Bet));
      callback(list);
    },
    (err) => console.warn('Current round bets snapshot warning:', err)
  );
}

/**
 * Real-time subscription to the last 5 winning colors.
 * Synchronized globally across all clients and persisted in Firestore & localStorage.
 */
export function subscribeRecentWinningColors(
  callback: (colors: WheelColor[]) => void
): () => void {
  const DEFAULT_COLORS: WheelColor[] = [
    'DARK RED',
    'DARK BLUE',
    'DARK GREEN',
    'DARK PINK',
    'DARK PURPLE',
  ];

  // Immediate cached render to eliminate layout shift or loading delay
  try {
    const cached = localStorage.getItem('realspin_last_5_colors');
    if (cached) {
      const parsed = JSON.parse(cached) as WheelColor[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        callback(parsed.slice(0, 5));
      } else {
        callback(DEFAULT_COLORS);
      }
    } else {
      callback(DEFAULT_COLORS);
    }
  } catch {
    callback(DEFAULT_COLORS);
  }

  // Real-time listener on active round document
  const currentRef = doc(db, 'rounds', CURRENT_ROUND_DOC);
  return onSnapshot(
    currentRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as GameRound;
        const list = [...(data.recentWinningColors || [])];
        if (data.status === 'COMPLETED' && data.winningColor) {
          if (list[0] !== data.winningColor) {
            list.unshift(data.winningColor);
          }
        }
        if (list.length > 0) {
          const finalFive = list.slice(0, 5);
          while (finalFive.length < 5) {
            finalFive.push(DEFAULT_COLORS[finalFive.length % DEFAULT_COLORS.length]);
          }
          try {
            localStorage.setItem('realspin_last_5_colors', JSON.stringify(finalFive));
          } catch {}
          callback(finalFive);
          return;
        }
      }

      // If document doesn't have recent colors yet, query recent completed rounds
      getRecentRounds(5)
        .then((rounds) => {
          if (rounds.length > 0) {
            const colors = rounds.map((r) => r.winningColor);
            while (colors.length < 5) {
              colors.push(DEFAULT_COLORS[colors.length % DEFAULT_COLORS.length]);
            }
            const five = colors.slice(0, 5);
            try {
              localStorage.setItem('realspin_last_5_colors', JSON.stringify(five));
            } catch {}
            callback(five);
          }
        })
        .catch(() => {});
    },
    (err) => console.warn('Recent winning colors snapshot warning:', err)
  );
}
