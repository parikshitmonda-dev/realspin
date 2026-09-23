import { useEffect, useState, useRef } from 'react';
import { GameRound, WheelColor } from '../types';
import {
  subscribeCurrentRound,
  syncRoundProgress,
  calculateTargetAngle,
  createNewRound,
} from '../services/roundService';
import { RESULT_DISPLAY_MS } from '../utils/constants';
import confetti from 'canvas-confetti';

export function useGameRound() {
  const [round, setRound] = useState<GameRound | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [isSpinningVisual, setIsSpinningVisual] = useState<boolean>(false);
  const [celebrationColor, setCelebrationColor] = useState<WheelColor | null>(null);
  const previousStatusRef = useRef<string>('');

  // 1. Subscribe to Firestore current round
  useEffect(() => {
    const unsub = subscribeCurrentRound((curRound) => {
      setRound(curRound);
    });
    return () => unsub();
  }, []);

  // 2. Timer for countdown and auto-progression (smooth 500ms interval for UI countdown)
  useEffect(() => {
    if (!round) return;

    const updateTimer = () => {
      const now = Date.now();

      // Advance round lifecycle if needed
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

        // Fallback auto-advancement: If completed for more than RESULT_DISPLAY_MS, advance round smoothly
        if (now >= round.spinEndTime + RESULT_DISPLAY_MS) {
          createNewRound(round.roundNumber, round.targetAngle)
            .then((nextRound) => {
              setRound(nextRound);
            })
            .catch(() => {});
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);

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
  };
}
