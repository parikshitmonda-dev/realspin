import { useEffect, useState, useRef } from 'react';
import { GameRound, WheelColor } from '../types';
import {
  subscribeCurrentRound,
  syncRoundProgress,
  subscribeRecentWinningColors,
  getCachedCurrentRound,
} from '../services/roundService';
import confetti from 'canvas-confetti';

export function useGameRound() {
  const [round, setRound] = useState<GameRound | null>(() => getCachedCurrentRound());
  const [timeLeftMs, setTimeLeftMs] = useState<number>(() => {
    const cached = getCachedCurrentRound();
    if (!cached) return 0;
    const now = Date.now();
    if (cached.status === 'BETTING_OPEN') {
      return Math.max(0, cached.bettingEndTime - now);
    } else if (cached.status === 'SPINNING') {
      return Math.max(0, cached.spinEndTime - now);
    }
    return 0;
  });
  const [wheelRotation, setWheelRotation] = useState<number>(() => {
    const cached = getCachedCurrentRound();
    return cached?.targetAngle || 0;
  });
  const [isSpinningVisual, setIsSpinningVisual] = useState<boolean>(() => {
    const cached = getCachedCurrentRound();
    if (!cached) return false;
    const now = Date.now();
    return (
      cached.status === 'SPINNING' ||
      (cached.status === 'BETTING_OPEN' && now >= cached.bettingEndTime && now < cached.spinEndTime)
    );
  });
  const [celebrationColor, setCelebrationColor] = useState<WheelColor | null>(null);
  const [recentColors, setRecentColors] = useState<WheelColor[]>([]);
  const previousStatusRef = useRef<string>('');

  // 1. Subscribe to Firestore current round
  useEffect(() => {
    const unsub = subscribeCurrentRound((curRound) => {
      setRound(curRound);
    });
    return () => unsub();
  }, []);

  // 1b. Subscribe to recent 5 winning colors
  useEffect(() => {
    const unsub = subscribeRecentWinningColors((colors) => {
      setRecentColors(colors);
    });
    return () => unsub();
  }, []);

  // 2. Timer for countdown and auto-progression (smooth 250ms interval for UI countdown)
  useEffect(() => {
    if (!round) return;

    const updateTimer = () => {
      const now = Date.now();

      // Advance round lifecycle if needed (handles BETTING_OPEN -> SPINNING -> COMPLETED -> Next Round)
      syncRoundProgress(round).catch(() => {});

      if (round.status === 'BETTING_OPEN') {
        const remaining = Math.max(0, round.bettingEndTime - now);
        setTimeLeftMs(remaining);
        setIsSpinningVisual(false);
        if (remaining <= 0) {
          setRound((prev) => (prev ? { ...prev, status: 'SPINNING' } : null));
        }
      } else if (round.status === 'SPINNING') {
        const spinRemaining = Math.max(0, round.spinEndTime - now);
        setTimeLeftMs(spinRemaining);
        setIsSpinningVisual(true);
        if (spinRemaining <= 0) {
          setRound((prev) => (prev ? { ...prev, status: 'COMPLETED' } : null));
        }
      } else if (round.status === 'COMPLETED') {
        setTimeLeftMs(0);
        setIsSpinningVisual(false);
        setWheelRotation(round.targetAngle);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 250);

    return () => clearInterval(interval);
  }, [round]);

  // 3. Trigger victory confetti & highlight when round finishes
  useEffect(() => {
    if (!round) return;

    if (round.status === 'COMPLETED' && previousStatusRef.current === 'SPINNING') {
      setCelebrationColor(round.winningColor);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ef4444', '#ec4899', '#3b82f6', '#22c55e', '#a855f7', '#fbbf24'],
        });
      } catch {
        // ignore if not supported
      }

      const timer = setTimeout(() => {
        setCelebrationColor(null);
      }, 7000);
      return () => clearTimeout(timer);
    }

    previousStatusRef.current = round.status;
  }, [round?.status]);

  return {
    round,
    timeLeftMs,
    wheelRotation,
    isSpinningVisual,
    celebrationColor,
    recentColors,
  };
}
