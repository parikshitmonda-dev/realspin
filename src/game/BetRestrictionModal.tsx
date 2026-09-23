import React from 'react';
import { UserProfile } from '../types';

export type RestrictionType = 'LOGIN_REQUIRED' | 'NO_COINS' | 'INSUFFICIENT_BALANCE';

interface BetRestrictionModalProps {
  type: RestrictionType;
  user: UserProfile | null;
  requiredAmount?: number;
  onClose: () => void;
  onOpenLogin: () => void;
  onRequestCoins: () => void;
}

export const BetRestrictionModal: React.FC<BetRestrictionModalProps> = ({
  type,
  user,
  requiredAmount = 500,
  onClose,
  onOpenLogin,
  onRequestCoins,
}) => {
  const balance = Number(user?.balance || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center gap-4 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle decorative glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-200 text-lg w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
        >
          ✕
        </button>

        {/* 1. LOGIN REQUIRED */}
        {type === 'LOGIN_REQUIRED' && (
          <>
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow-inner mt-1">
              🔐
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="text-base font-bold tracking-wider text-slate-100 uppercase">
                LOGIN REQUIRED
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                You must authenticate before placing virtual coin bets or managing your wallet.
              </p>
            </div>
            <div className="w-full flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLogin();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all"
              >
                USER LOGIN / SIGN UP
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-medium"
              >
                Continue Viewing Wheel
              </button>
            </div>
          </>
        )}

        {/* 2. NO COINS AVAILABLE (Balance == 0) */}
        {type === 'NO_COINS' && (
          <>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl shadow-inner mt-1">
              🪙
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-bold tracking-wider text-amber-300 uppercase">
                INSUFFICIENT COINS
              </h3>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 my-1">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">
                  Your current balance is:
                </div>
                <div className="text-lg font-mono font-bold text-amber-400 mt-0.5">
                  0 Coins
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
                Please request virtual coins from the administrator.
              </p>
              <p className="text-[10px] text-slate-500 italic">
                *Virtual coins have strictly no real-world monetary value.
              </p>
            </div>
            <div className="w-full flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestCoins();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all"
              >
                REQUEST COINS
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* 3. INSUFFICIENT BALANCE (Balance > 0 but < bet) */}
        {type === 'INSUFFICIENT_BALANCE' && (
          <>
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-2xl shadow-inner mt-1">
              ⚠️
            </div>
            <div className="flex flex-col gap-2 w-full">
              <h3 className="text-base font-bold tracking-wider text-rose-300 uppercase">
                INSUFFICIENT BALANCE
              </h3>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 my-1 grid grid-cols-2 gap-2 text-left">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Available:</div>
                  <div className="text-sm font-mono font-bold text-amber-300">
                    {balance.toLocaleString()} Coins
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Required:</div>
                  <div className="text-sm font-mono font-bold text-rose-300">
                    {requiredAmount.toLocaleString()} Coins
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                You do not have enough coins to complete this bet. Request additional virtual coins from the admin.
              </p>
            </div>
            <div className="w-full flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestCoins();
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all"
              >
                REQUEST COINS
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
