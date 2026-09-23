import React from 'react';
import { UserProfile } from '../types';

interface TopTabsProps {
  user: UserProfile | null;
  isAdmin: boolean;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenAdmin: () => void;
  onOpenSupport?: () => void;
}

export const TopTabs: React.FC<TopTabsProps> = ({
  user,
  isAdmin,
  onOpenAuth,
  onOpenProfile,
  onOpenAdmin,
}) => {
  return (
    <header className="w-full max-w-lg mx-auto pt-2 pb-1.5 px-3 z-30 select-none flex flex-col gap-1.5">
      {/* Brand Header: Real Spin */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-[1.5px] shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <span className="text-xs">🎡</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-black text-base tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 uppercase drop-shadow-[0_2px_10px_rgba(245,158,11,0.25)]">
              REAL SPIN
            </span>
            <span className="text-[10px] font-semibold text-emerald-400 font-mono tracking-tight flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-800/80">
            <span className="text-slate-300 font-medium truncate max-w-[120px]">{user.fullName || 'Player'}</span>
          </div>
        )}
      </div>

      {/* 2 Clean Top Tabs */}
      <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-md backdrop-blur-md">
        {/* TAB 1: USER LOGIN / SIGN UP (or user balance if logged in) */}
        {user ? (
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-slate-800/90 border border-amber-500/30 text-amber-300 hover:bg-slate-750 transition-all text-xs font-semibold overflow-hidden shadow-sm"
            title="View User Profile & Balance"
          >
            <span className="text-xs">🪙</span>
            <span className="font-mono font-bold truncate">
              {Number(user.balance || 0).toLocaleString()}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="flex items-center justify-center py-2 px-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all text-[11px] sm:text-xs font-bold shadow-sm leading-tight text-center truncate"
          >
            USER LOGIN / SIGN UP
          </button>
        )}

        {/* TAB 2: ADMIN PANEL */}
        <button
          type="button"
          onClick={onOpenAdmin}
          className={`flex items-center justify-center gap-1 py-2 px-1 rounded-lg border transition-all text-[11px] sm:text-xs font-bold leading-tight text-center truncate ${
            isAdmin
              ? 'bg-purple-950/70 border-purple-500/60 text-purple-200 hover:bg-purple-900/60'
              : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>🛡️</span>
          <span>ADMIN PANEL</span>
        </button>
      </div>
    </header>
  );
};
