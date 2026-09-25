import React from 'react';
import { WheelColor, GameRound, Bet } from '../types';
import { WHEEL_SLICES } from '../utils/constants';

interface BettingButtonsProps {
  round: GameRound | null;
  userBets: Bet[];
  onSelectColor: (color: WheelColor) => void;
  disabled?: boolean;
}

export const BettingButtons: React.FC<BettingButtonsProps> = ({
  round,
  userBets,
  onSelectColor,
  disabled = false,
}) => {
  const isBettingOpen = round?.status === 'BETTING_OPEN';

  // Specific styling for each of the 5 exact colors
  const buttonStyles: Record<
    string,
    {
      gradient: string;
      border: string;
      hover: string;
      glow: string;
      icon: string;
      activeGlow: string;
    }
  > = {
    RED: {
      gradient: 'from-red-950 via-red-900 to-rose-950',
      border: 'border-red-600/70',
      hover: 'hover:border-red-400 hover:from-red-900 hover:to-rose-900',
      glow: 'shadow-[0_4px_18px_rgba(220,38,38,0.3)]',
      icon: '🔴',
      activeGlow: 'ring-2 ring-red-400',
    },
    'DARK RED': {
      gradient: 'from-red-950 via-red-900 to-rose-950',
      border: 'border-red-600/70',
      hover: 'hover:border-red-400 hover:from-red-900 hover:to-rose-900',
      glow: 'shadow-[0_4px_18px_rgba(220,38,38,0.3)]',
      icon: '🔴',
      activeGlow: 'ring-2 ring-red-400',
    },
    PINK: {
      gradient: 'from-pink-950 via-pink-900 to-fuchsia-950',
      border: 'border-pink-600/70',
      hover: 'hover:border-pink-400 hover:from-pink-900 hover:to-fuchsia-900',
      glow: 'shadow-[0_4px_18px_rgba(219,39,119,0.3)]',
      icon: '💗',
      activeGlow: 'ring-2 ring-pink-400',
    },
    'DARK PINK': {
      gradient: 'from-pink-950 via-pink-900 to-fuchsia-950',
      border: 'border-pink-600/70',
      hover: 'hover:border-pink-400 hover:from-pink-900 hover:to-fuchsia-900',
      glow: 'shadow-[0_4px_18px_rgba(219,39,119,0.3)]',
      icon: '💗',
      activeGlow: 'ring-2 ring-pink-400',
    },
    BLUE: {
      gradient: 'from-blue-950 via-blue-900 to-indigo-950',
      border: 'border-blue-600/70',
      hover: 'hover:border-blue-400 hover:from-blue-900 hover:to-indigo-900',
      glow: 'shadow-[0_4px_18px_rgba(37,99,235,0.3)]',
      icon: '🔵',
      activeGlow: 'ring-2 ring-blue-400',
    },
    'DARK BLUE': {
      gradient: 'from-blue-950 via-blue-900 to-indigo-950',
      border: 'border-blue-600/70',
      hover: 'hover:border-blue-400 hover:from-blue-900 hover:to-indigo-900',
      glow: 'shadow-[0_4px_18px_rgba(37,99,235,0.3)]',
      icon: '🔵',
      activeGlow: 'ring-2 ring-blue-400',
    },
    GREEN: {
      gradient: 'from-emerald-950 via-emerald-900 to-green-950',
      border: 'border-emerald-600/70',
      hover: 'hover:border-emerald-400 hover:from-emerald-900 hover:to-green-900',
      glow: 'shadow-[0_4px_18px_rgba(22,163,74,0.3)]',
      icon: '🟢',
      activeGlow: 'ring-2 ring-emerald-400',
    },
    'DARK GREEN': {
      gradient: 'from-emerald-950 via-emerald-900 to-green-950',
      border: 'border-emerald-600/70',
      hover: 'hover:border-emerald-400 hover:from-emerald-900 hover:to-green-900',
      glow: 'shadow-[0_4px_18px_rgba(22,163,74,0.3)]',
      icon: '🟢',
      activeGlow: 'ring-2 ring-emerald-400',
    },
    PURPLE: {
      gradient: 'from-purple-950 via-purple-900 to-violet-950',
      border: 'border-purple-600/70',
      hover: 'hover:border-purple-400 hover:from-purple-900 hover:to-violet-900',
      glow: 'shadow-[0_4px_18px_rgba(147,51,234,0.3)]',
      icon: '🟣',
      activeGlow: 'ring-2 ring-purple-400',
    },
    'DARK PURPLE': {
      gradient: 'from-purple-950 via-purple-900 to-violet-950',
      border: 'border-purple-600/70',
      hover: 'hover:border-purple-400 hover:from-purple-900 hover:to-violet-900',
      glow: 'shadow-[0_4px_18px_rgba(147,51,234,0.3)]',
      icon: '🟣',
      activeGlow: 'ring-2 ring-purple-400',
    },
  };

  return (
    <div className="w-full max-w-[385px] sm:max-w-[410px] mx-auto px-1 sm:px-2 py-1">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 px-1 font-mono">
        <span className="font-bold text-[11px] sm:text-xs uppercase tracking-wider text-slate-300">
          SELECT COLOR TO BET (4× WIN)
        </span>
        <span className="text-[10.5px] sm:text-[11px] text-amber-400 font-semibold">
          {isBettingOpen ? '● LIVE' : '○ LOCKED'}
        </span>
      </div>

      {/* 5 Betting Tabs: enlarged to comfortably fill mobile width with clear visibility */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5 w-full">
        {WHEEL_SLICES.map((slice) => {
          const style = buttonStyles[slice.name];
          const colorBets = userBets.filter((b) => b.selectedColor === slice.name);
          const totalBetOnColor = colorBets.reduce((acc, b) => acc + b.amount, 0);
          const isWinningColor = round?.status === 'COMPLETED' && round.winningColor === slice.name;

          return (
            <button
              key={slice.name}
              id={`bet-tab-${slice.name.toLowerCase().replace(/\s+/g, '-')}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelectColor(slice.name)}
              className={`relative overflow-hidden rounded-xl sm:rounded-2xl border py-2.5 sm:py-3 px-1.5 sm:px-2 w-[calc(33.333%-6px)] sm:w-[118px] min-w-[106px] max-w-[125px] flex-shrink-0 flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all duration-200 active:scale-95 bg-gradient-to-b ${style.gradient} ${style.border} ${style.hover} ${style.glow} shadow-md ${
                isWinningColor ? 'ring-2 sm:ring-4 ring-amber-400 animate-pulse' : ''
              }`}
            >
              {/* Top Row: Icon and Label */}
              <div className="flex items-center justify-center gap-1.5 z-10 w-full px-0.5">
                <span className="text-base sm:text-lg shrink-0 drop-shadow-sm">{style?.icon || '●'}</span>
                <span className="font-black text-xs sm:text-[14px] tracking-wide text-white uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                  {slice.label.replace('DARK ', '')}
                </span>
              </div>

              {/* Sub-label: 4x Payout Multiplier */}
              <div className="text-[9.5px] sm:text-[10px] font-mono font-bold text-amber-300 z-10">
                PAYOUT 4×
              </div>

              {/* Active user bet badge if user has bet on this color */}
              {totalBetOnColor > 0 && (
                <div className="mt-0.5 px-2 py-0.5 rounded-full bg-slate-950/90 border border-amber-400/60 text-[9.5px] sm:text-[10px] font-mono font-bold text-amber-300 z-10 flex items-center gap-1 max-w-full truncate">
                  <span>🪙</span>
                  <span className="truncate">{totalBetOnColor.toLocaleString()}</span>
                </div>
              )}

              {/* Winning banner if completed */}
              {isWinningColor && (
                <div className="absolute inset-x-0 bottom-0 bg-amber-500 text-slate-950 text-[8.5px] font-black tracking-widest uppercase py-0.5 text-center">
                  WINNER!
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
