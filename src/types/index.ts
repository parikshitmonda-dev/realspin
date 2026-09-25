export type WheelColor =
  | 'RED'
  | 'PINK'
  | 'BLUE'
  | 'GREEN'
  | 'PURPLE'
  | 'DARK RED'
  | 'DARK PINK'
  | 'DARK BLUE'
  | 'DARK GREEN'
  | 'DARK PURPLE';

export interface WheelSliceConfig {
  name: WheelColor;
  label: string;
  bgGradient: string;
  borderColor: string;
  textColor: string;
  accentColor: string;
  badgeBg: string;
  dotColor: string;
  startAngle: number; // 0 to 360
  endAngle: number;
}

export type RoundStatus = 'BETTING_OPEN' | 'BETTING_CLOSED' | 'SPINNING' | 'COMPLETED';

export interface GameRound {
  id: string;
  roundNumber: number;
  status: RoundStatus;
  startTime: number; // ms timestamp
  bettingEndTime: number; // ms timestamp
  spinDuration: number; // in ms (e.g. 20000 - 35000 ms)
  spinEndTime: number; // ms timestamp
  winningColor: WheelColor;
  targetAngle: number; // degrees (e.g. 5 full rotations + slice offset)
  totalBetsCount: number;
  totalCoinsBet: number;
  payoutProcessed?: boolean;
  adminOverridden?: boolean;
  overriddenBy?: string;
  recentWinningColors?: WheelColor[];
  createdAt: number;
}

export interface GameControlSettings {
  nextForcedColor: WheelColor | null;
  mode: 'AUTO_RANDOM' | 'FORCED_COLOR' | 'LOWEST_PAYOUT_WINS' | 'HIGHEST_PAYOUT_WINS';
  autoResetForcedColor?: boolean;
  bettingDurationSeconds?: number;
  isPaused?: boolean;
  updatedAt?: number;
  updatedBy?: string;
}

export interface UserProfile {
  uid: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  balance: number; // Starts at 0
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: number;
  updatedAt?: number;
}

export type TransactionType =
  | 'ADMIN_CREDIT'
  | 'ADMIN_DEBIT'
  | 'BET_DEBIT'
  | 'WIN_CREDIT'
  | 'GIFT_SENT'
  | 'GIFT_RECEIVED'
  | 'BONUS'
  | 'ADJUSTMENT';

export interface LedgerTransaction {
  id: string;
  userId: string;
  userName: string;
  userMobile?: string;
  type: TransactionType;
  amount: number; // positive or negative
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId?: string; // roundId or requestId or recipientId
  createdAt: number;
  createdBy?: string;
}

export type CoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CoinRequest {
  id: string;
  userId: string;
  userName: string;
  userMobile: string;
  userEmail: string;
  requestedAmount: number;
  message: string;
  status: CoinRequestStatus;
  adminReason?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
}

export interface Bet {
  id: string;
  roundId: string;
  userId: string;
  userName: string;
  userMobile?: string;
  selectedColor: WheelColor;
  amount: number;
  payout?: number;
  status: 'PLACED' | 'WON' | 'LOST';
  createdAt: number;
}

export interface AdminActivityLog {
  id: string;
  adminUid: string;
  adminEmail: string;
  action: string;
  targetUserId?: string;
  details: string;
  createdAt: number;
}
