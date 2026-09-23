import { WheelColor, WheelSliceConfig } from '../types';

export const WHEEL_COLORS: WheelColor[] = [
  'DARK RED',
  'DARK PINK',
  'DARK BLUE',
  'DARK GREEN',
  'DARK PURPLE',
];

export const WHEEL_SLICES: WheelSliceConfig[] = [
  {
    name: 'DARK RED',
    label: 'DARK RED',
    bgGradient: 'from-red-950 via-red-900 to-rose-950',
    borderColor: '#dc2626',
    textColor: '#fecaca',
    accentColor: '#ef4444',
    badgeBg: 'bg-red-900/60 border-red-500/40 text-red-200',
    dotColor: '#f87171',
    startAngle: -36,
    endAngle: 36,
  },
  {
    name: 'DARK PINK',
    label: 'DARK PINK',
    bgGradient: 'from-pink-950 via-pink-900 to-fuchsia-950',
    borderColor: '#db2777',
    textColor: '#fbcfe8',
    accentColor: '#ec4899',
    badgeBg: 'bg-pink-900/60 border-pink-500/40 text-pink-200',
    dotColor: '#f472b6',
    startAngle: 36,
    endAngle: 108,
  },
  {
    name: 'DARK BLUE',
    label: 'DARK BLUE',
    bgGradient: 'from-blue-950 via-blue-900 to-indigo-950',
    borderColor: '#2563eb',
    textColor: '#bfdbfe',
    accentColor: '#3b82f6',
    badgeBg: 'bg-blue-900/60 border-blue-500/40 text-blue-200',
    dotColor: '#60a5fa',
    startAngle: 108,
    endAngle: 180,
  },
  {
    name: 'DARK GREEN',
    label: 'DARK GREEN',
    bgGradient: 'from-emerald-950 via-emerald-900 to-green-950',
    borderColor: '#16a34a',
    textColor: '#bbf7d0',
    accentColor: '#22c55e',
    badgeBg: 'bg-emerald-900/60 border-emerald-500/40 text-emerald-200',
    dotColor: '#4ade80',
    startAngle: 180,
    endAngle: 252,
  },
  {
    name: 'DARK PURPLE',
    label: 'DARK PURPLE',
    bgGradient: 'from-purple-950 via-purple-900 to-violet-950',
    borderColor: '#9333ea',
    textColor: '#e9d5ff',
    accentColor: '#a855f7',
    badgeBg: 'bg-purple-900/60 border-purple-500/40 text-purple-200',
    dotColor: '#c084fc',
    startAngle: 252,
    endAngle: 324,
  },
];

export const WIN_MULTIPLIER = 4; // 4x payout on winning color

// Timing config
export const ROUND_DURATION_MS = 180 * 1000; // 3 minutes betting duration before wheel spins
export const MIN_SPIN_DURATION_MS = 30 * 1000; // 30s wheel movement time
export const MAX_SPIN_DURATION_MS = 45 * 1000; // 45s wheel movement time
export const BETTING_CLOSES_BEFORE_SPIN_MS = 5 * 1000; // 5s betting closed buffer before spin
export const RESULT_DISPLAY_MS = 10 * 1000; // 10s result view before next round starts

// Protection against multiple pending requests
export const MAX_PENDING_COIN_REQUESTS = 2;
export const MIN_COIN_REQUEST_AMOUNT = 100;
export const MAX_COIN_REQUEST_AMOUNT = 100000;

// WhatsApp Support config
export const DEFAULT_WHATSAPP_NUMBER = '15551234567';
export const WHATSAPP_DEFAULT_MESSAGE = 'Hello Support, I need help with my Real Spin account.';

export function getWhatsAppSupportNumber(): string {
  const envNumber =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER) ||
    '';
  return envNumber.trim() || DEFAULT_WHATSAPP_NUMBER;
}
