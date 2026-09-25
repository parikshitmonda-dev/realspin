import React, { useState } from 'react';
import { WheelColor, UserProfile, GameRound } from '../types';
import { WHEEL_SLICES, WIN_MULTIPLIER } from '../utils/constants';
import { placeBet } from '../services/walletService';

interface BetModalProps {
  color: WheelColor | null;
  user: UserProfile | null;
  round: GameRound | null;
  onClose: () => void;
  onRequestCoins: () => void;
  onSuccess: (color: WheelColor, amount: number) => void;
}

export const BetModal: React.FC<BetModalProps> = ({
  color,
  user,
  round,
  onClose,
  onRequestCoins,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<number>(500);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!color || !round) return null;

  const slice = WHEEL_SLICES.find((s) => s.name === color);
  const balance = Number(user?.balance || 0);

  const presets = [100, 250, 500, 1000, 2500];

  const handleQuickAdd = (val: number) => {
    setAmount(val);
    setErrorMessage(null);
  };

  const handleSetMax = () => {
    setAmount(Math.max(10, balance));
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setErrorMessage('Please enter a valid bet amount.');
      return;
    }

    if (balance < amount) {
      setErrorMessage(`Insufficient balance. You need ${amount.toLocaleString()} Coins but have ${balance.toLocaleString()} Coins.`);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const res = await placeBet(user, round.id, color, amount);
    setSubmitting(false);

    if (res.success) {
      onSuccess(color, amount);
      onClose();
    } else {
      setErrorMessage(res.errorMessage || 'Failed to place bet. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col gap-4 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with color indicator */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span
              className="w-4 h-4 rounded-full shadow-md"
              style={{ backgroundColor: slice?.accentColor || '#ef4444' }}
            />
            <h3 className="font-bold text-base tracking-wide uppercase text-slate-100">
              BET ON {color.replace('DARK ', '')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg p-1 leading-none rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* User Balance Info */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-medium">Available Balance</div>
          <div className="flex items-center gap-1.5 font-mono font-bold text-amber-300 text-sm">
            <span>🪙</span>
            <span>{balance.toLocaleString()} Coins</span>
          </div>
        </div>

        {/* Potential Payout Notice */}
        <div className="text-xs text-emerald-400/90 bg-emerald-950/30 border border-emerald-900/40 rounded-lg px-3 py-1.5 flex items-center justify-between font-mono">
          <span>POTENTIAL WIN (4×):</span>
          <span className="font-bold font-sans">
            🪙 {(amount * WIN_MULTIPLIER).toLocaleString()} Coins
          </span>
        </div>

        {/* Error notification if any */}
        {errorMessage && (
          <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-xs text-red-300 font-medium flex flex-col gap-2">
            <span>{errorMessage}</span>
            {balance === 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestCoins();
                }}
                className="mt-1 w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors"
              >
                REQUEST VIRTUAL COINS
              </button>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Bet Amount (Virtual Coins)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max={balance > 0 ? balance : 100000}
                value={amount || ''}
                onChange={(e) => {
                  setAmount(Math.max(0, parseInt(e.target.value) || 0));
                  setErrorMessage(null);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-base font-mono text-amber-200 focus:outline-none focus:border-amber-400 shadow-inner"
                placeholder="500"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">
                Coins
              </span>
            </div>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleQuickAdd(p)}
                className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-colors ${
                  amount === p
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                +{p}
              </button>
            ))}
            {balance > 0 && (
              <button
                type="button"
                onClick={handleSetMax}
                className="text-xs px-2.5 py-1 rounded-lg border border-amber-500/50 bg-amber-950/30 text-amber-300 hover:bg-amber-900/50 font-mono font-bold"
              >
                MAX
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold text-xs transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting || round.status !== 'BETTING_OPEN'}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'CONFIRMING...' : 'CONFIRM BET'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
