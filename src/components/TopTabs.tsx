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
    <header className="w-full max-w-lg mx-auto pt-2.5 pb-1.5 px-3 z-30 select-none">
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
