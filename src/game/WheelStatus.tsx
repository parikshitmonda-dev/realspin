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

  const winningSlice = WHEEL_SLICES.find((s) => s.name === round.winningColor);

  return (
    <div className="w-full max-w-sm mx-auto px-4 py-1.5 flex flex-col items-center select-none">
      {/* Top micro-bar: Round Number */}
      <div className="flex items-center justify-between w-full text-[11px] text-slate-400 mb-1 px-1 font-mono">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          <span>ROUND #{round.roundNumber || round.id.slice(-4)}</span>
        </span>
        <span className="text-slate-500 font-normal">GLOBAL MULTIPLAYER</span>
      </div>

      {/* Main Status Badge */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-lg flex items-center justify-between backdrop-blur-sm">
        {/* Left Side: Dynamic Status Label */}
        <div className="flex items-center gap-2">
          {round.status === 'BETTING_OPEN' && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <div className="text-xs font-bold text-emerald-400 tracking-wider">
                  BETTING OPEN
                </div>
                <div className="text-[10px] text-slate-400">Place your virtual bets</div>
              </div>
            </div>
          )}

          {round.status === 'BETTING_CLOSED' && (
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
              <div>
                <div className="text-xs font-bold text-amber-400 tracking-wider">
                  BETTING CLOSED
                </div>
                <div className="text-[10px] text-slate-400">Preparing wheel spin</div>
              </div>
            </div>
          )}

          {round.status === 'SPINNING' && (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <div>
                <div className="text-xs font-bold text-amber-300 tracking-wider animate-pulse">
                  SPINNING...
                </div>
                <div className="text-[10px] text-slate-400">Determining winning color</div>
              </div>
            </div>
          )}

          {round.status === 'COMPLETED' && (
            <div className="flex items-center gap-2">
              <div
                className="w-3.5 h-3.5 rounded-full shadow-md animate-bounce"
                style={{ backgroundColor: winningSlice?.accentColor || '#3b82f6' }}
              />
              <div>
                <div className="text-xs font-black tracking-wider text-slate-100 flex items-center gap-1">
                  WINNER: <span style={{ color: winningSlice?.accentColor || '#60a5fa' }}>{round.winningColor}</span>
                </div>
                <div className="text-[10px] text-amber-400 font-semibold">4× Payouts Distributed!</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Countdown Timer */}
        <div className="text-right">
          {round.status === 'BETTING_OPEN' ? (
            <div className="bg-slate-950/80 border border-slate-700/80 rounded-lg px-2.5 py-1 text-center">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                NEXT SPIN
              </div>
              <div className="font-mono text-sm font-bold text-amber-300 tracking-widest leading-none mt-0.5">
                {formattedTime}
              </div>
            </div>
          ) : round.status === 'SPINNING' ? (
            <div className="bg-purple-950/40 border border-purple-800/60 rounded-lg px-2.5 py-1 text-center">
              <div className="text-[9px] uppercase tracking-wider text-purple-300 font-semibold">
                REVEAL IN
              </div>
              <div className="font-mono text-sm font-bold text-purple-200 tracking-widest leading-none mt-0.5">
                {formattedTime}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-lg px-2.5 py-1 text-center">
              <div className="text-[9px] uppercase tracking-wider text-emerald-300 font-semibold">
                NEW ROUND IN
              </div>
              <div className="font-mono text-xs font-bold text-emerald-200 tracking-widest leading-none mt-0.5">
                NEXT SOON
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
