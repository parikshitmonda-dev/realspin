import React, { useState } from 'react';
import { WheelColor } from '../types';

interface RecentResultsBulletsProps {
  colors: WheelColor[];
  latestWinningColor?: WheelColor | null;
}

interface ColorBulletMeta {
  name: WheelColor;
  shortLabel: string;
  gradient: string;
  borderColor: string;
  textColor: string;
  glowColor: string;
  primerColor: string;
}

const COLOR_BULLET_CONFIG: Record<WheelColor, ColorBulletMeta> = {
  'DARK RED': {
    name: 'DARK RED',
    shortLabel: 'RED',
    gradient: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 50%, #ef4444 100%)',
    borderColor: '#ef4444',
    textColor: '#fee2e2',
    glowColor: 'rgba(239, 68, 68, 0.55)',
    primerColor: '#450a0a',
  },
  'DARK PINK': {
    name: 'DARK PINK',
    shortLabel: 'PINK',
    gradient: 'linear-gradient(135deg, #831843 0%, #be185d 50%, #ec4899 100%)',
    borderColor: '#ec4899',
    textColor: '#fce7f3',
    glowColor: 'rgba(236, 72, 153, 0.55)',
    primerColor: '#500724',
  },
  'DARK BLUE': {
    name: 'DARK BLUE',
    shortLabel: 'BLUE',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #3b82f6 100%)',
    borderColor: '#3b82f6',
    textColor: '#dbeafe',
    glowColor: 'rgba(59, 130, 246, 0.55)',
    primerColor: '#172554',
  },
  'DARK GREEN': {
    name: 'DARK GREEN',
    shortLabel: 'GRN',
    gradient: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)',
    borderColor: '#10b981',
    textColor: '#d1fae5',
    glowColor: 'rgba(16, 185, 129, 0.55)',
    primerColor: '#022c22',
  },
  'DARK PURPLE': {
    name: 'DARK PURPLE',
    shortLabel: 'PURP',
    gradient: 'linear-gradient(135deg, #581c87 0%, #7e22ce 50%, #a855f7 100%)',
    borderColor: '#a855f7',
    textColor: '#f3e8ff',
    glowColor: 'rgba(168, 85, 247, 0.55)',
    primerColor: '#3b0764',
  },
};

export const RecentResultsBullets: React.FC<RecentResultsBulletsProps> = ({
  colors,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  // Guarantee 5 bullet shapes are always shown
  const fallbackDefaults: WheelColor[] = [
    'DARK RED',
    'DARK BLUE',
    'DARK GREEN',
    'DARK PINK',
    'DARK PURPLE',
  ];

  const displayList =
    colors && colors.length > 0
      ? colors.slice(0, 5)
      : fallbackDefaults;

  while (displayList.length < 5) {
    displayList.push(fallbackDefaults[displayList.length % fallbackDefaults.length]);
  }

  return (
    <section
      aria-label="Last 5 Round Results"
      className="w-full flex flex-col items-center justify-center -mt-1 sm:-mt-1.5 mb-2.5 sm:mb-3.5 select-none"
    >
      <div className="flex items-center gap-1.5 sm:gap-2.5 bg-slate-900/95 py-1.5 px-3 sm:px-3.5 rounded-full border border-slate-800/90 shadow-xl backdrop-blur-md">
        {/* Subtle Label */}
        <div className="flex items-center gap-1 pl-0.5 pr-1.5 border-r border-slate-800">
          <span className="text-xs sm:text-sm leading-none">🎯</span>
          <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-wider text-slate-300 uppercase whitespace-nowrap">
            LAST 5:
          </span>
        </div>

        {/* 5 Bullet Shapes */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {displayList.map((color, idx) => {
            const isLatest = idx === 0;
            const config = COLOR_BULLET_CONFIG[color] || COLOR_BULLET_CONFIG['DARK RED'];

            return (
              <div
                key={`bullet-${idx}-${color}`}
                className="relative group cursor-pointer"
                onMouseEnter={() => setActiveTooltip(idx)}
                onMouseLeave={() => setActiveTooltip(null)}
                onClick={() => setActiveTooltip((prev) => (prev === idx ? null : idx))}
              >
                {/* Bullet Shell Container */}
                <div
                  className={`relative flex items-center h-6 sm:h-7 w-11 sm:w-13 rounded-r-full rounded-l-[4px] border transition-all duration-300 transform group-hover:scale-110 active:scale-95 ${
                    isLatest ? 'ring-1.5 ring-amber-400 ring-offset-1 ring-offset-slate-950' : ''
                  }`}
                  style={{
                    background: config.gradient,
                    borderColor: config.borderColor,
                    boxShadow: isLatest
                      ? `0 0 12px ${config.glowColor}, inset 0 1px 1px rgba(255,255,255,0.4)`
                      : `0 1px 4px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.2)`,
                  }}
                >
                  {/* Cartridge primer base line (flat left edge) */}
                  <div
                    className="w-1.5 h-full rounded-l-[3px] opacity-80 border-r border-black/35"
                    style={{ backgroundColor: config.primerColor }}
                  />

                  {/* Top gloss highlight reflection on bullet body */}
                  <div className="absolute top-0.5 left-1.5 right-2 h-[2px] bg-white/40 rounded-full pointer-events-none" />

                  {/* Bullet Color Label */}
                  <div className="flex-1 text-center pr-1.5">
                    <span
                      className="text-[9.5px] sm:text-[11px] font-heading font-black tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] truncate block"
                      style={{ color: config.textColor }}
                    >
                      {config.shortLabel}
                    </span>
                  </div>

                  {/* "NEW" / Latest indicator glow pip on the 1st bullet */}
                  {isLatest && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-300 border border-slate-900 shadow-sm" />
                    </span>
                  )}
                </div>

                {/* Floating Tooltip */}
                {activeTooltip === idx && (
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 z-40 bg-slate-950 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold text-slate-200 whitespace-nowrap shadow-xl pointer-events-none animate-in fade-in duration-150">
                    {isLatest ? '★ Latest: ' : `#${idx + 1}: `}
                    <span style={{ color: config.borderColor }}>{config.name}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
