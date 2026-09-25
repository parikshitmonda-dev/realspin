import React from 'react';
import { GameRound, WheelColor } from '../types';
import { WHEEL_SLICES } from '../utils/constants';

interface WheelStatusProps {
  round: GameRound | null;
  timeLeftMs: number;
}

export const WheelStatus: React.FC<WheelStatusProps> = ({ round, timeLeftMs }) => {
  if (!round) {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="animate-pulse text-xs text-slate-400 font-mono tracking-wider">
          SYNCHRONIZING WITH GLOBAL ROUND...
        </div>
      </div>
    );
  }

  // Format mm:ss
  const totalSeconds = Math.ceil(timeLeftMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const winningSlice = WHEEL_SLICES.find(
    (s) => s.name === round.winningColor || s.name === round.winningColor?.replace('DARK ', '')
  );

  return (
    <div className="w-full max-w-[385px] sm:max-w-[410px] mx-auto px-1.5 sm:px-2 py-1 flex flex-col items-center select-none">
      {/* Top micro-bar: Round Number */}
      <div className="flex items-center justify-between w-full text-xs text-slate-400 mb-1 px-1 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="font-bold text-slate-300">ROUND #{round.roundNumber || round.id.slice(-4)}</span>
        </span>
        <span className="text-slate-500 font-medium text-[11px]">GLOBAL MULTIPLAYER</span>
      </div>

      {/* Main Status Badge */}
      <div className="w-full bg-slate-900/95 border border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xl flex items-center justify-between backdrop-blur-md">
        {/* Left Side: Dynamic Status Label */}
        <div className="flex items-center gap-2.5">
          {round.status === 'BETTING_OPEN' && (
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
              <div>
                <div className="text-xs sm:text-sm font-extrabold text-emerald-400 tracking-wider">
                  BETTING OPEN
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Place your virtual bets</div>
              </div>
            </div>
          )}

          {round.status === 'BETTING_CLOSED' && (
            <div className="flex items-center gap-2.5">
              <span className="h-3.5 w-3.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <div>
                <div className="text-xs sm:text-sm font-extrabold text-amber-400 tracking-wider">
                  BETTING CLOSED
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Preparing wheel spin</div>
              </div>
            </div>
          )}

          {round.status === 'SPINNING' && (
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <div className="text-xs sm:text-sm font-extrabold text-amber-300 tracking-wider animate-pulse">
                  SPINNING...
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Determining winning color</div>
              </div>
            </div>
          )}

          {round.status === 'COMPLETED' && (
            <div className="flex items-center gap-2.5">
              <div
                className="w-4 h-4 rounded-full shadow-md animate-bounce shrink-0"
                style={{ backgroundColor: winningSlice?.accentColor || '#3b82f6' }}
              />
              <div>
                <div className="text-xs sm:text-sm font-black tracking-wider text-slate-100 flex items-center gap-1">
                  WINNER: <span style={{ color: winningSlice?.accentColor || '#60a5fa' }}>{round.winningColor?.replace('DARK ', '')}</span>
                </div>
                <div className="text-[10.5px] sm:text-xs text-amber-400 font-bold">4× Payouts Distributed!</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Countdown Timer */}
        <div className="text-right pl-2">
          {round.status === 'BETTING_OPEN' ? (
            <div className="bg-slate-950/90 border border-slate-750 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-center shadow-inner">
              <div className="text-[9.5px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                NEXT SPIN
              </div>
              <div className="font-mono text-base sm:text-lg font-black text-amber-300 tracking-widest leading-none mt-1">
                {formattedTime}
              </div>
            </div>
          ) : round.status === 'SPINNING' ? (
            <div className="bg-purple-950/50 border border-purple-800/70 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-center shadow-inner">
              <div className="text-[9.5px] sm:text-[10px] uppercase tracking-wider text-purple-300 font-bold">
                REVEAL IN
              </div>
              <div className="font-mono text-base sm:text-lg font-black text-purple-200 tracking-widest leading-none mt-1">
                {formattedTime}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-950/60 border border-emerald-700/80 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-center shadow-inner">
              <div className="text-[9.5px] sm:text-[10px] uppercase tracking-wider text-emerald-300 font-bold">
                {totalSeconds > 0 ? 'STARTING IN' : 'STARTING'}
              </div>
              <div className="font-mono text-base sm:text-lg font-black text-emerald-300 tracking-widest leading-none mt-1">
                {totalSeconds > 0 ? formattedTime : 'NOW...'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
