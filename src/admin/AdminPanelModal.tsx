import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  CoinRequest,
  LedgerTransaction,
  GameRound,
  AdminActivityLog,
  WheelColor,
  Bet,
  GameControlSettings,
} from '../types';
import {
  approveCoinRequest,
  rejectCoinRequest,
  manualAdjustCoins,
  manualSetExactBalance,
  deleteUserAccount,
  toggleUserActiveStatus,
  resetUserBalance,
  subscribeAllCoinRequests,
  subscribeAllUsers,
  subscribeAllLedger,
  subscribeAdminLogs,
} from '../services/adminService';
import {
  createNewRound,
  overrideCurrentRoundWinningColor,
  forceSpinCurrentRound,
  forceCompleteCurrentRound,
  setNextRoundPreselectedColor,
  setGameTimingSetting,
  subscribeGameControlSettings,
  subscribeCurrentRoundBets,
} from '../services/roundService';
import { ADMIN_EMAIL } from '../services/authService';
import {
  verifyAdminPassword,
  resetAdminPassword,
  recoverAndResetAdminPassword,
  getAdminSecurityMeta,
  DEFAULT_ADMIN_PASSWORD,
  AdminSecurityMeta,
} from '../services/adminSecurityService';
import { WHEEL_COLORS, WHEEL_SLICES } from '../utils/constants';
import {
  Shield,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ShieldCheck,
  RotateCcw,
  Trash2,
  UserX,
  UserCheck,
  Coins,
  Zap,
  Search,
  Clock,
  Target,
  Check,
  Ban,
  Play,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface AdminPanelModalProps {
  currentUser: UserProfile | null;
  currentRound: GameRound | null;
  onClose: () => void;
  onOpenLogin: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  currentUser,
  currentRound,
  onClose,
  onOpenLogin,
}) => {
  // CRITICAL REQUIREMENT: Password required for each and every login/access to Admin Panel
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  // Login Gatekeeper states
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Reset Password view states
  const [viewMode, setViewMode] = useState<'LOGIN' | 'RESET'>('LOGIN');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // In-Panel Change Password states
  const [currentPwdInPanel, setCurrentPwdInPanel] = useState('');
  const [newPwdInPanel, setNewPwdInPanel] = useState('');
  const [confirmPwdInPanel, setConfirmPwdInPanel] = useState('');
  const [changePwdMsg, setChangePwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  // Security Metadata
  const [securityMeta, setSecurityMeta] = useState<AdminSecurityMeta | null>(null);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<'GAME' | 'USERS' | 'REQUESTS' | 'LEDGER' | 'SECURITY'>('GAME');
  const [requests, setRequests] = useState<CoinRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [ledger, setLedger] = useState<LedgerTransaction[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminActivityLog[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  // Live Round & Game Control states
  const [gameSettings, setGameSettings] = useState<GameControlSettings | null>(null);
  const [currentBets, setCurrentBets] = useState<Bet[]>([]);
  const [isUpdatingRound, setIsUpdatingRound] = useState(false);
  const [nextPresetColor, setNextPresetColor] = useState<string>('AUTO_RANDOM');
  const [autoResetPreset, setAutoResetPreset] = useState(true);

  // User Management states
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'ADMIN'>('ALL');
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Rejection modal state
  const [rejectingRequest, setRejectingRequest] = useState<CoinRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('Please submit a new request with a valid amount.');

  // Manual adjust modal state
  const [adjustingUser, setAdjustingUser] = useState<UserProfile | null>(null);
  const [adjustMode, setAdjustMode] = useState<'DELTA' | 'EXACT'>('DELTA');
  const [adjustAmount, setAdjustAmount] = useState<number>(1000);
  const [exactBalanceInput, setExactBalanceInput] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<'ADMIN_CREDIT' | 'ADMIN_DEBIT'>('ADMIN_CREDIT');
  const [adjustReason, setAdjustReason] = useState('Administrative virtual coin adjustment');

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Effective admin identity for operator tracking
  const effectiveAdminUser: UserProfile = currentUser || {
    uid: 'admin_security_operator',
    fullName: 'Master Administrator',
    email: ADMIN_EMAIL,
    mobileNumber: '9999999999',
    balance: 0,
    role: 'admin',
    isActive: true,
    createdAt: Date.now(),
  };

  // Load security metadata on mount
  useEffect(() => {
    getAdminSecurityMeta().then(setSecurityMeta);
  }, []);

  // Subscribe to real-time streams only when unlocked
  useEffect(() => {
    if (!isUnlocked) return;

    const unsubReq = subscribeAllCoinRequests(setRequests);
    const unsubUsers = subscribeAllUsers(setUsers);
    const unsubLedger = subscribeAllLedger(setLedger);
    const unsubLogs = subscribeAdminLogs(setAdminLogs);
    const unsubSettings = subscribeGameControlSettings((settings) => {
      setGameSettings(settings);
      if (settings?.nextForcedColor) {
        setNextPresetColor(settings.nextForcedColor);
      } else if (settings?.mode) {
        setNextPresetColor(settings.mode);
      } else {
        setNextPresetColor('AUTO_RANDOM');
      }
      setAutoResetPreset(settings?.autoResetForcedColor !== false);
    });

    return () => {
      unsubReq();
      unsubUsers();
      unsubLedger();
      unsubLogs();
      unsubSettings();
    };
  }, [isUnlocked]);

  // Subscribe to bets of the active round
  useEffect(() => {
    if (!isUnlocked || !currentRound?.id) {
      setCurrentBets([]);
      return;
    }

    const unsubBets = subscribeCurrentRoundBets(currentRound.id, (bets) => {
      setCurrentBets(bets);
    });

    return () => unsubBets();
  }, [isUnlocked, currentRound?.id]);

  // Handle Admin Password Verification (Every login)
  const handleVerifyPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passwordInput.trim()) {
      setLoginError('Please enter the admin password.');
      return;
    }

    setIsVerifying(true);
    setLoginError(null);

    try {
      const isValid = await verifyAdminPassword(passwordInput);
      if (isValid) {
        setIsUnlocked(true);
        setPasswordInput('');
        getAdminSecurityMeta().then(setSecurityMeta);
      } else {
        setLoginError('Incorrect admin password. Please try again or use Reset Password below.');
      }
    } catch {
      setLoginError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Admin Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (!recoveryInput.trim()) {
      setResetError(`Please enter the admin recovery email (${ADMIN_EMAIL}) or master key.`);
      return;
    }

    if (newPassword.length < 4) {
      setResetError('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match. Please verify both inputs.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await recoverAndResetAdminPassword(recoveryInput, newPassword);
      if (res.success) {
        setResetSuccess('Admin password successfully reset! You can now log in.');
        setPasswordInput(newPassword);
        setNewPassword('');
        setConfirmPassword('');
        getAdminSecurityMeta().then(setSecurityMeta);
        setTimeout(() => {
          setViewMode('LOGIN');
        }, 1600);
      } else {
        setResetError(res.error || 'Failed to reset password.');
      }
    } catch {
      setResetError('An unexpected error occurred during password reset.');
    } finally {
      setIsResetting(false);
    }
  };

  // Handle In-Panel Change Password
  const handleChangePasswordInPanel = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwdMsg(null);

    if (!currentPwdInPanel.trim()) {
      setChangePwdMsg({ type: 'error', text: 'Enter current password to authorize changes.' });
      return;
    }

    if (newPwdInPanel.length < 4) {
      setChangePwdMsg({ type: 'error', text: 'New password must be at least 4 characters.' });
      return;
    }

    if (newPwdInPanel !== confirmPwdInPanel) {
      setChangePwdMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setIsChangingPwd(true);
    try {
      const isCurrentValid = await verifyAdminPassword(currentPwdInPanel);
      if (!isCurrentValid) {
        setChangePwdMsg({ type: 'error', text: 'Current password incorrect.' });
        setIsChangingPwd(false);
        return;
      }

      const res = await resetAdminPassword(newPwdInPanel, effectiveAdminUser.uid, effectiveAdminUser.email);
      if (res.success) {
        setChangePwdMsg({ type: 'success', text: 'Admin password updated successfully!' });
        setCurrentPwdInPanel('');
        setNewPwdInPanel('');
        setConfirmPwdInPanel('');
        getAdminSecurityMeta().then(setSecurityMeta);
      } else {
        setChangePwdMsg({ type: 'error', text: res.error || 'Update failed.' });
      }
    } catch {
      setChangePwdMsg({ type: 'error', text: 'Failed to update password.' });
    } finally {
      setIsChangingPwd(false);
    }
  };

  // Quick reset to default password
  const handleQuickResetToDefault = async () => {
    if (!window.confirm('Reset admin password to default ("admin123")?')) return;
    setIsChangingPwd(true);
    try {
      const res = await resetAdminPassword(DEFAULT_ADMIN_PASSWORD, effectiveAdminUser.uid, effectiveAdminUser.email);
      if (res.success) {
        setChangePwdMsg({ type: 'success', text: 'Password reset to default: admin123' });
        getAdminSecurityMeta().then(setSecurityMeta);
      }
    } finally {
      setIsChangingPwd(false);
    }
  };

  // Lock Admin Panel Session
  const handleLockSession = () => {
    setIsUnlocked(false);
    setPasswordInput('');
    setViewMode('LOGIN');
    setActionMessage('Admin session locked.');
  };

  // Close and Lock
  const handleCloseModal = () => {
    setIsUnlocked(false);
    setViewMode('LOGIN');
    setPasswordInput('');
    setRecoveryInput('');
    setNewPassword('');
    setConfirmPassword('');
    setLoginError(null);
    setResetError(null);
    setResetSuccess(null);
    onClose();
  };

  // Handlers for approvals, rejections, manual adjustments
  const handleApprove = async (req: CoinRequest) => {
    setProcessingId(req.id);
    setActionMessage(null);

    const res = await approveCoinRequest(req.id, effectiveAdminUser);
    setProcessingId(null);

    if (res.success) {
      setActionMessage(`Approved ${req.requestedAmount.toLocaleString()} virtual coins for ${req.userName}!`);
      setTimeout(() => setActionMessage(null), 4000);
    } else {
      setActionMessage(`Approval failed: ${res.error}`);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingRequest) return;
    setProcessingId(rejectingRequest.id);

    const res = await rejectCoinRequest(rejectingRequest.id, rejectReason, effectiveAdminUser);
    setProcessingId(null);
    setRejectingRequest(null);

    if (res.success) {
      setActionMessage(`Rejected request for ${rejectingRequest.userName}. User balance unchanged.`);
      setTimeout(() => setActionMessage(null), 4000);
    } else {
      setActionMessage(`Rejection failed: ${res.error}`);
    }
  };

  const handleManualAdjust = async () => {
    if (!adjustingUser) return;
    setProcessingId(adjustingUser.uid);

    let res: { success: boolean; error?: string };

    if (adjustMode === 'EXACT') {
      res = await manualSetExactBalance(
        adjustingUser.uid,
        exactBalanceInput,
        adjustReason,
        effectiveAdminUser
      );
    } else {
      res = await manualAdjustCoins(
        adjustingUser.uid,
        adjustAmount,
        adjustType,
        adjustReason,
        effectiveAdminUser
      );
    }

    setProcessingId(null);
    setAdjustingUser(null);

    if (res.success) {
      setActionMessage(`Successfully updated balance for ${adjustingUser.fullName}.`);
      setTimeout(() => setActionMessage(null), 4000);
    } else {
      setActionMessage(`Adjustment failed: ${res.error}`);
    }
  };

  // Force winning color for current active round
  const handleForceCurrentWinner = async (color: WheelColor) => {
    setIsUpdatingRound(true);
    const res = await overrideCurrentRoundWinningColor(color, effectiveAdminUser);
    setIsUpdatingRound(false);
    if (res.success) {
      setActionMessage(`🎯 Active Round winner forced to ${color}! Wheel target angle updated.`);
      setTimeout(() => setActionMessage(null), 4000);
    } else {
      setActionMessage(`Failed to set winner: ${res.error}`);
    }
  };

  // Force spin immediately
  const handleForceSpinNow = async () => {
    setIsUpdatingRound(true);
    const res = await forceSpinCurrentRound(effectiveAdminUser);
    setIsUpdatingRound(false);
    if (res.success) {
      setActionMessage('⚡ Wheel spin triggered immediately! Betting closed.');
      setTimeout(() => setActionMessage(null), 3500);
    } else {
      setActionMessage(`Failed to start spin: ${res.error}`);
    }
  };

  // Force complete & payout
  const handleForceCompleteNow = async () => {
    setIsUpdatingRound(true);
    const res = await forceCompleteCurrentRound(effectiveAdminUser);
    setIsUpdatingRound(false);
    if (res.success) {
      setActionMessage('🏁 Round completed and all winner payouts processed!');
      setTimeout(() => setActionMessage(null), 3500);
    } else {
      setActionMessage(`Failed to complete round: ${res.error}`);
    }
  };

  // Force new round
  const handleForceNewRound = async (colorChoice?: WheelColor) => {
    setIsUpdatingRound(true);
    try {
      await createNewRound(currentRound?.roundNumber || 0, currentRound?.targetAngle || 0, colorChoice);
      setActionMessage(
        colorChoice
          ? `New Round started with predetermined winner: ${colorChoice}!`
          : 'New round started successfully!'
      );
      setTimeout(() => setActionMessage(null), 3500);
    } catch {
      setActionMessage('Failed to reset round.');
    } finally {
      setIsUpdatingRound(false);
    }
  };

  // Save preset for next round
  const handleSaveNextPreset = async () => {
    setIsUpdatingRound(true);
    let color: WheelColor | null = null;
    let mode: 'AUTO_RANDOM' | 'FORCED_COLOR' | 'LOWEST_PAYOUT_WINS' | 'HIGHEST_PAYOUT_WINS' = 'AUTO_RANDOM';

    if (WHEEL_COLORS.includes(nextPresetColor as WheelColor)) {
      color = nextPresetColor as WheelColor;
      mode = 'FORCED_COLOR';
    } else if (nextPresetColor === 'LOWEST_PAYOUT_WINS') {
      mode = 'LOWEST_PAYOUT_WINS';
    } else if (nextPresetColor === 'HIGHEST_PAYOUT_WINS') {
      mode = 'HIGHEST_PAYOUT_WINS';
    } else {
      mode = 'AUTO_RANDOM';
    }

    const res = await setNextRoundPreselectedColor(color, mode, autoResetPreset, effectiveAdminUser);
    setIsUpdatingRound(false);
    if (res.success) {
      setActionMessage(
        color
          ? `🔮 Next round winning color pre-set to: ${color}!`
          : `🔮 Next round configured to: ${mode}`
      );
      setTimeout(() => setActionMessage(null), 4000);
    } else {
      setActionMessage(`Failed to save next round configuration: ${res.error}`);
    }
  };

  // Change betting timer setting
  const handleChangeBettingDuration = async (seconds: number) => {
    const res = await setGameTimingSetting(seconds, effectiveAdminUser);
    if (res.success) {
      setActionMessage(`⏱️ Betting duration changed to ${seconds}s for upcoming rounds!`);
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  // Delete User Account
  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeletingUser(true);

    const res = await deleteUserAccount(deletingUser.uid, deletingUser.fullName, effectiveAdminUser);
    setIsDeletingUser(false);
    setDeletingUser(null);

    if (res.success) {
      setActionMessage(`🗑️ Player "${deletingUser.fullName}" permanently removed.`);
      setTimeout(() => setActionMessage(null), 4000);
    } else {
      setActionMessage(`Failed to remove player: ${res.error}`);
    }
  };

  // Toggle User Active / Suspended
  const handleToggleUserStatus = async (user: UserProfile) => {
    const nextStatus = !user.isActive;
    const res = await toggleUserActiveStatus(user.uid, nextStatus, user.fullName, effectiveAdminUser);
    if (res.success) {
      setActionMessage(
        nextStatus
          ? `✅ Re-activated account for ${user.fullName}.`
          : `🚫 Suspended/Banned account for ${user.fullName}.`
      );
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  // Reset Balance to 0
  const handleResetUserBalance = async (user: UserProfile) => {
    if (!window.confirm(`Reset balance of "${user.fullName}" to 0 Coins?`)) return;
    const res = await resetUserBalance(user.uid, effectiveAdminUser);
    if (res.success) {
      setActionMessage(`🔄 Balance of ${user.fullName} reset to 0 Coins.`);
      setTimeout(() => setActionMessage(null), 3500);
    }
  };

  // -------------------------------------------------------------
  // 1. GATEKEEPER VIEW: PASSWORD REQUIRED ON EVERY LOGIN
  // -------------------------------------------------------------
  if (!isUnlocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-150">
        <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-2xl p-6 sm:p-7 shadow-2xl flex flex-col gap-4 relative overflow-hidden">
          {/* Decorative glowing top line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-amber-500 to-purple-600" />

          {/* VIEW: LOGIN WITH PASSWORD */}
          {viewMode === 'LOGIN' ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-500/50 flex items-center justify-center text-purple-300 shadow-inner">
                    <Shield className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
                      <span>ADMIN SECURITY ACCESS</span>
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                    </h3>
                    <p className="text-[11px] text-slate-400">Password required for every login</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-slate-200 text-lg p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-slate-300">
                  Full administrative authority: Force current/next winning color, inspect live bets, remove users, and approve coin requests.
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-rose-950/80 border border-rose-500/60 rounded-xl text-xs text-rose-200 flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleVerifyPassword} className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Admin Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoFocus
                      placeholder="Enter admin password..."
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (loginError) setLoginError(null);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-3.5 pr-10 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <span className="font-mono text-slate-500">
                    Default: <strong className="text-amber-400/90 font-mono">admin123</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('RESET');
                      setRecoveryInput('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setResetError(null);
                      setResetSuccess(null);
                    }}
                    className="text-purple-400 hover:text-purple-300 font-semibold underline underline-offset-2 transition-colors"
                  >
                    Reset Password?
                  </button>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-1/3 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="w-2/3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-amber-300" />
                        <span>Unlock Admin Console</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* VIEW: RESET ADMIN PASSWORD */
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/50 flex items-center justify-center text-amber-300 shadow-inner">
                    <KeyRound className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-100 uppercase tracking-wide">
                      RESET ADMIN PASSWORD
                    </h3>
                    <p className="text-[11px] text-slate-400">Security recovery verification</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('LOGIN')}
                  className="text-slate-400 hover:text-slate-200 text-lg p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  ✕
                </button>
              </div>

              {resetError && (
                <div className="p-3 bg-rose-950/80 border border-rose-500/60 rounded-xl text-xs text-rose-200 flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              {!resetSuccess && (
                <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Admin Recovery Email / Master Key
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      placeholder="Enter admin email manually..."
                      value={recoveryInput}
                      onChange={(e) => setRecoveryInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      New Admin Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Enter new admin password..."
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-3 pr-10 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      placeholder="Repeat new admin password..."
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setViewMode('LOGIN')}
                      className="w-1/3 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isResetting}
                      className="w-2/3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isResetting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Save & Set Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. UNLOCKED ADMIN DASHBOARD VIEW
  // -------------------------------------------------------------
  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'ALL') return true;
    return r.status === statusFilter;
  });

  // Calculate live bets distribution per color
  const totalBetsCoins = currentBets.reduce((acc, b) => acc + Number(b.amount || 0), 0);
  const colorBreakdowns = WHEEL_COLORS.map((c) => {
    const betsOnColor = currentBets.filter(
      (b) => b.selectedColor === c || b.selectedColor === `DARK ${c}` || b.selectedColor?.replace('DARK ', '') === c
    );
    const coinsOnColor = betsOnColor.reduce((acc, b) => acc + Number(b.amount || 0), 0);
    const count = betsOnColor.length;
    const projectedPayout = coinsOnColor * 4;
    const netHouseProfit = totalBetsCoins - projectedPayout;
    return {
      color: c,
      count,
      coins: coinsOnColor,
      projectedPayout,
      netHouseProfit,
    };
  });

  // Find lowest payout color for house safeguard
  const lowestPayoutColor = [...colorBreakdowns].sort((a, b) => a.projectedPayout - b.projectedPayout)[0]?.color;

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const q = userSearchTerm.toLowerCase();
    const matchQuery =
      !q ||
      u.fullName?.toLowerCase().includes(q) ||
      u.mobileNumber?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.uid?.toLowerCase().includes(q);

    if (!matchQuery) return false;

    if (userStatusFilter === 'ACTIVE') return u.isActive !== false;
    if (userStatusFilter === 'SUSPENDED') return u.isActive === false;
    if (userStatusFilter === 'ADMIN') return u.role === 'admin';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-purple-800/80 rounded-2xl shadow-2xl flex flex-col h-[95vh] max-h-[760px] p-3 sm:p-5 overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-950 border border-purple-600/50 text-purple-300 text-lg shadow-inner">
              🛡️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-100 uppercase tracking-wide">
                  REALSPIN ADMIN MASTER CONSOLE
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AUTHENTICATED
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Operator: {effectiveAdminUser.email || effectiveAdminUser.fullName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Lock Admin Session Button */}
            <button
              type="button"
              onClick={handleLockSession}
              title="Lock Admin Session (Requires password to enter again)"
              className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg border border-purple-600/50 bg-purple-950/50 hover:bg-purple-900/60 text-purple-200 text-xs font-semibold transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Lock Session</span>
            </button>

            {/* Close Modal Button */}
            <button
              onClick={handleCloseModal}
              title="Close Admin Panel"
              className="text-slate-400 hover:text-slate-200 text-lg p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Global Action Message banner */}
        {actionMessage && (
          <div className="my-2 p-2.5 bg-purple-950/90 border border-purple-500/60 text-purple-200 text-xs rounded-xl flex items-center justify-between animate-in fade-in">
            <span className="font-medium">{actionMessage}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="text-purple-300 font-bold ml-2 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Tabs Navigation (5 Tabs) */}
        <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 my-2 text-[10px] sm:text-[11px] font-bold font-mono select-none">
          <button
            onClick={() => setActiveTab('GAME')}
            className={`py-1.5 rounded-lg transition-colors truncate flex items-center justify-center gap-1 ${
              activeTab === 'GAME'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ROUND &</span> WINNER
          </button>
          <button
            onClick={() => setActiveTab('USERS')}
            className={`py-1.5 rounded-lg transition-colors truncate flex items-center justify-center gap-1 ${
              activeTab === 'USERS'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>PLAYERS ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`py-1.5 rounded-lg transition-colors truncate flex items-center justify-center gap-1 ${
              activeTab === 'REQUESTS'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>REQUESTS ({requests.filter((r) => r.status === 'PENDING').length})</span>
          </button>
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`py-1.5 rounded-lg transition-colors truncate flex items-center justify-center gap-1 ${
              activeTab === 'LEDGER'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>LEDGER</span>
          </button>
          <button
            onClick={() => setActiveTab('SECURITY')}
            className={`py-1.5 rounded-lg transition-colors truncate flex items-center justify-center gap-1 ${
              activeTab === 'SECURITY'
                ? 'bg-purple-900/90 text-purple-200 shadow-sm border border-purple-500/50'
                : 'text-slate-400 hover:text-purple-300'
            }`}
          >
            <KeyRound className="w-3 h-3 text-amber-400" />
            <span>SECURITY</span>
          </button>
        </div>

        {/* -------------------------------------------------------------
            TAB 1: ROUND WINNER & REAL-TIME GAME ACTIVITY CONTROL
        ------------------------------------------------------------- */}
        {activeTab === 'GAME' && (
          <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-3">
            {/* Live Round Header & Quick Triggers */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 font-mono">ACTIVE ROUND</span>
                    <span className="font-mono font-bold text-sm sm:text-base text-amber-400">
                      #{currentRound?.roundNumber || 'Loading'}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                        currentRound?.status === 'SPINNING'
                          ? 'bg-purple-950 text-purple-300 border border-purple-600 animate-pulse'
                          : currentRound?.status === 'BETTING_OPEN'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {currentRound?.status}
                    </span>
                    {currentRound?.adminOverridden && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        ADMIN OVERRIDDEN
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Round ID: {currentRound?.id || 'N/A'} • Total Placed Coins: {totalBetsCoins.toLocaleString()}
                  </div>
                </div>

                {/* Quick Emergency Controls */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    disabled={isUpdatingRound || currentRound?.status === 'SPINNING'}
                    onClick={handleForceSpinNow}
                    title="Stop countdown and spin wheel right now"
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>FORCE SPIN NOW</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingRound || currentRound?.status === 'COMPLETED'}
                    onClick={handleForceCompleteNow}
                    title="Instantly stop wheel and credit 4x payout to winners"
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>FORCE COMPLETE</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingRound}
                    onClick={() => handleForceNewRound()}
                    title="Generate brand new round immediately"
                    className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>NEW ROUND</span>
                  </button>
                </div>
              </div>

              {/* CURRENT ROUND OUTCOME SELECTION */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                      FORCE WINNER FOR CURRENT ROUND (LIVE)
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Target Winner:{' '}
                    <strong className="text-amber-300 underline underline-offset-2">
                      {currentRound?.winningColor || 'NONE'}
                    </strong>
                  </div>
                </div>

                {/* 5 Color Selection Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {WHEEL_SLICES.map((slice) => {
                    const breakdown = colorBreakdowns.find((b) => b.color === slice.name);
                    const isCurrentTarget = currentRound?.winningColor === slice.name;
                    const isSafest = lowestPayoutColor === slice.name;

                    return (
                      <div
                        key={slice.name}
                        className={`rounded-xl p-2.5 flex flex-col justify-between border transition-all ${
                          isCurrentTarget
                            ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: slice.borderColor }}
                            />
                            <span className="font-bold text-[11px] text-slate-200 truncate">
                              {slice.name.replace('DARK ', '')}
                            </span>
                            {isCurrentTarget && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-400 text-slate-950">
                                TARGET
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] font-mono text-slate-400 space-y-0.5 my-1.5">
                            <div className="flex justify-between">
                              <span>Bets:</span>
                              <strong className="text-slate-200">{breakdown?.count || 0}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Coins:</span>
                              <strong className="text-amber-300">
                                {(breakdown?.coins || 0).toLocaleString()}
                              </strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Payout 4x:</span>
                              <strong className="text-rose-300">
                                {(breakdown?.projectedPayout || 0).toLocaleString()}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="pt-1 mt-1 border-t border-slate-800/80">
                          {isSafest && (
                            <div className="text-[9px] text-emerald-400 font-mono font-semibold text-center mb-1">
                              🛡️ Lowest Payout
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={isUpdatingRound || isCurrentTarget}
                            onClick={() => handleForceCurrentWinner(slice.name)}
                            className={`w-full py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                              isCurrentTarget
                                ? 'bg-amber-400 text-slate-950 cursor-default'
                                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-amber-400/50'
                            }`}
                          >
                            {isCurrentTarget ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>WINNING COLOR</span>
                              </>
                            ) : (
                              <span>MAKE WINNER</span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* PRE-SELECT NEXT ROUND WINNING COLOR & ALGORITHM */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <h4 className="font-bold text-xs sm:text-sm text-slate-100 uppercase tracking-wide">
                    PRE-SELECT NEXT ROUND WINNING COLOR
                  </h4>
                </div>
                {gameSettings?.nextForcedColor && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700">
                    NEXT PRESET: {gameSettings.nextForcedColor.replace('DARK ', '')}
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-400 leading-relaxed">
                Choose which color will win in the <strong>NEXT round</strong> before it begins. As soon
                as the current round finishes and the new round starts, it will automatically adopt this winning slice!
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNextPresetColor('AUTO_RANDOM')}
                  className={`p-2 rounded-xl border text-xs font-semibold text-left transition-all ${
                    nextPresetColor === 'AUTO_RANDOM'
                      ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-[11px]">🎲 Auto Random</div>
                  <div className="text-[10px] text-slate-500">Fair algorithm</div>
                </button>

                <button
                  type="button"
                  onClick={() => setNextPresetColor('LOWEST_PAYOUT_WINS')}
                  className={`p-2 rounded-xl border text-xs font-semibold text-left transition-all ${
                    nextPresetColor === 'LOWEST_PAYOUT_WINS'
                      ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-[11px] text-emerald-400">🛡️ Lowest Bet Wins</div>
                  <div className="text-[10px] text-slate-500">House Safeguard</div>
                </button>

                {WHEEL_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setNextPresetColor(col)}
                    className={`p-2 rounded-xl border text-xs font-semibold text-left transition-all ${
                      nextPresetColor === col
                        ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-sm ring-1 ring-purple-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-[11px] text-slate-200">{col.replace('DARK ', '')}</div>
                    <div className="text-[10px] text-slate-500">Preset color</div>
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoResetPreset}
                    onChange={(e) => setAutoResetPreset(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
                  />
                  <span>Revert back to Auto Random after next round finishes</span>
                </label>

                <button
                  type="button"
                  disabled={isUpdatingRound}
                  onClick={handleSaveNextPreset}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save Next Round Outcome</span>
                </button>
              </div>
            </div>

            {/* GAME SPEED & TIMING CONTROLS */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-xs sm:text-sm text-slate-100 uppercase tracking-wide">
                  ROUND TIMING CONTROLS
                </h4>
              </div>
              <p className="text-xs text-slate-400">
                Set betting window duration for players across all devices:
              </p>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {[
                  { label: '🎯 4 Min (Default - 240s)', sec: 240 },
                  { label: '⏳ 2 Min (120s)', sec: 120 },
                  { label: '⏱️ 60s (Fast)', sec: 60 },
                  { label: '⚡ 30s (Turbo)', sec: 30 },
                ].map((t) => (
                  <button
                    key={t.sec}
                    type="button"
                    onClick={() => handleChangeBettingDuration(t.sec)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-colors ${
                      (gameSettings?.bettingDurationSeconds || 240) === t.sec
                        ? 'border-amber-500 bg-amber-500/20 text-amber-300 shadow-sm ring-1 ring-amber-500/40'
                        : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 2: PLAYER MANAGEMENT & USER REMOVAL
        ------------------------------------------------------------- */}
        {activeTab === 'USERS' && (
          <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-3">
            {/* Player Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search player by name, mobile, email, or UID..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg py-1.5 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                {(['ALL', 'ACTIVE', 'SUSPENDED', 'ADMIN'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setUserStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md border transition-colors ${
                      userStatusFilter === st
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Player Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500">TOTAL PLAYERS</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">{users.length}</div>
              </div>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500">ACTIVE</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">
                  {users.filter((u) => u.isActive !== false).length}
                </div>
              </div>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500">SUSPENDED</div>
                <div className="text-sm font-bold text-rose-400 mt-0.5">
                  {users.filter((u) => u.isActive === false).length}
                </div>
              </div>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500">CIRCULATING COINS</div>
                <div className="text-sm font-bold text-amber-400 mt-0.5">
                  {users.reduce((acc, u) => acc + Number(u.balance || 0), 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Players List */}
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800 font-mono">
                No player accounts matching your search/filter criteria.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredUsers.map((u) => {
                  const isSuspended = u.isActive === false;
                  return (
                    <div
                      key={u.uid}
                      className={`bg-slate-950/80 border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isSuspended ? 'border-rose-900/50 bg-rose-950/10' : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSuspended
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-slate-800 text-amber-400 border border-slate-700'
                          }`}
                        >
                          {u.fullName?.charAt(0)?.toUpperCase() || 'P'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-100">
                              {u.fullName || 'Anonymous Player'}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${
                                u.role === 'admin'
                                  ? 'bg-purple-950 text-purple-300 border border-purple-700'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {u.role}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                                isSuspended
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {isSuspended ? 'BANNED' : 'ACTIVE'}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="text-amber-400/90">{u.mobileNumber || 'No Phone'}</span>
                            <span>•</span>
                            <span>{u.email || 'No Email'}</span>
                            <span>•</span>
                            <span className="text-slate-500">UID: {u.uid.slice(0, 10)}...</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Balance and Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-900">
                        <div className="text-left sm:text-right">
                          <div className="font-mono font-bold text-xs sm:text-sm text-amber-300">
                            🪙 {Number(u.balance || 0).toLocaleString()} Coins
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Joined: {new Date(u.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          {/* Adjust Coins Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustingUser(u);
                              setAdjustMode('DELTA');
                              setAdjustAmount(1000);
                              setExactBalanceInput(Number(u.balance || 0));
                              setAdjustType('ADMIN_CREDIT');
                              setAdjustReason('Administrative adjustment');
                            }}
                            title="Credit, debit, or set exact coins"
                            className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1"
                          >
                            <Coins className="w-3.5 h-3.5" />
                            <span>Coins</span>
                          </button>

                          {/* Ban / Unban Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u)}
                            title={isSuspended ? 'Unban player' : 'Suspend / Ban player'}
                            className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                              isSuspended
                                ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300 hover:bg-emerald-900'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-600/60'
                            }`}
                          >
                            {isSuspended ? (
                              <UserCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Ban className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Reset to 0 */}
                          <button
                            type="button"
                            onClick={() => handleResetUserBalance(u)}
                            title="Reset balance to 0"
                            className="p-1.5 rounded-lg border border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-amber-300"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Remove User Permanently */}
                          <button
                            type="button"
                            onClick={() => setDeletingUser(u)}
                            title="Permanently remove user account"
                            className="p-1.5 rounded-lg border border-rose-900/60 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 3: COIN REQUESTS APPROVAL / REJECTION
        ------------------------------------------------------------- */}
        {activeTab === 'REQUESTS' && (
          <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold transition-colors ${
                      statusFilter === st
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Showing {filteredRequests.length} request(s)
              </span>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800 font-mono">
                No {statusFilter.toLowerCase()} coin requests found.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredRequests.map((req) => {
                  const targetUser = users.find((u) => u.uid === req.userId);
                  const userCurrentBal = Number(targetUser?.balance || 0);

                  return (
                    <div
                      key={req.id}
                      className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2.5 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-100">
                              {req.userName || 'Player'}
                            </span>
                            <span className="font-mono text-[11px] text-amber-400">
                              {req.userMobile || 'No Mobile'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            UID: {req.userId.slice(0, 12)}... • Date:{' '}
                            {new Date(req.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-bold text-base text-amber-300">
                            🪙 {req.requestedAmount.toLocaleString()} Coins
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Current Bal: {userCurrentBal.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2 text-xs text-slate-300 italic flex items-start gap-1.5">
                        <span className="not-italic text-slate-500">💬</span>
                        <span>"{req.message || 'Please add virtual coins to my account'}"</span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                        <div>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              req.status === 'APPROVED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                : req.status === 'REJECTED'
                                ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                                : 'bg-amber-950 text-amber-300 border border-amber-700/60 animate-pulse'
                            }`}
                          >
                            STATUS: {req.status}
                          </span>
                          {req.adminReason && (
                            <span className="text-[11px] text-slate-400 ml-2">
                              Reason: {req.adminReason}
                            </span>
                          )}
                        </div>

                        {req.status === 'PENDING' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={processingId === req.id}
                              onClick={() => {
                                setRejectingRequest(req);
                                setRejectReason('Please submit a new request with a valid amount.');
                              }}
                              className="px-3 py-1.5 rounded-lg border border-rose-800/60 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-bold transition-colors disabled:opacity-50"
                            >
                              REJECT
                            </button>
                            <button
                              type="button"
                              disabled={processingId === req.id}
                              onClick={() => handleApprove(req)}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors disabled:opacity-50"
                            >
                              {processingId === req.id ? 'CREDITING...' : 'APPROVE'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 4: GLOBAL LEDGER & AUDIT
        ------------------------------------------------------------- */}
        {activeTab === 'LEDGER' && (
          <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-2">
            <div className="text-xs text-slate-400 mb-1 font-mono">
              Global Ledger Entries: {ledger.length}
            </div>

            {ledger.slice(0, 40).map((tx) => (
              <div
                key={tx.id}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-semibold">
                      {tx.type}
                    </span>
                    <span className="font-bold text-slate-200">{tx.userName}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{tx.description}</div>
                </div>
                <div className="text-right font-mono">
                  <div
                    className={`font-bold ${
                      tx.amount > 0 ? 'text-emerald-400' : 'text-slate-300'
                    }`}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    {tx.amount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Bal: {tx.balanceAfter.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 5: SECURITY & PASSWORD SETTINGS
        ------------------------------------------------------------- */}
        {activeTab === 'SECURITY' && (
          <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-4">
            {/* Status Card */}
            <div className="bg-slate-950/80 border border-purple-900/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wide">
                    ADMIN PASSWORD ENFORCEMENT
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Mandatory password check on every login is <strong className="text-emerald-400 font-semibold">ACTIVE</strong>.
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Authorized Recovery: {ADMIN_EMAIL}
                    {securityMeta?.updatedAt && (
                      <span> • Last Updated: {new Date(securityMeta.updatedAt).toLocaleDateString()}</span>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLockSession}
                className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>Lock Panel Now</span>
              </button>
            </div>

            {/* Change Password Form */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs sm:text-sm text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>CHANGE ADMIN PANEL PASSWORD</span>
                </h4>
                <button
                  type="button"
                  onClick={handleQuickResetToDefault}
                  className="text-[11px] font-mono text-slate-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Default (admin123)</span>
                </button>
              </div>

              {changePwdMsg && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    changePwdMsg.type === 'success'
                      ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-200'
                      : 'bg-rose-950/80 border border-rose-500/60 text-rose-200'
                  }`}
                >
                  {changePwdMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{changePwdMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePasswordInPanel} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPwdInPanel}
                    onChange={(e) => setCurrentPwdInPanel(e.target.value)}
                    placeholder="Enter current password..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPwdInPanel}
                    onChange={(e) => setNewPwdInPanel(e.target.value)}
                    placeholder="New password (min 4 chars)..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPwdInPanel}
                    onChange={(e) => setConfirmPwdInPanel(e.target.value)}
                    placeholder="Confirm new password..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="sm:col-span-3 flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isChangingPwd}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isChangingPwd ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Save New Admin Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Security Audit Activity Logs */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-2.5">
              <h4 className="font-bold text-xs sm:text-sm text-slate-300 uppercase tracking-wide flex items-center justify-between">
                <span>ADMIN ACTION AUDIT LOGS</span>
                <span className="text-[10px] font-mono text-slate-500 font-normal">
                  {adminLogs.length} logged events
                </span>
              </h4>

              {adminLogs.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 font-mono">
                  No administrative events recorded yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {adminLogs.slice(0, 25).map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800/60">
                            {log.action}
                          </span>
                          <span className="text-slate-300 text-[11px]">{log.details}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            SUB-MODAL 1: DELETE USER ACCOUNT CONFIRMATION
        ------------------------------------------------------------- */}
        {deletingUser && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-sm bg-slate-900 border border-rose-600 rounded-2xl p-5 flex flex-col gap-3 shadow-2xl">
              <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-500/50 flex items-center justify-center text-rose-300">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <h4 className="font-bold text-sm uppercase text-rose-300">
                PERMANENTLY REMOVE PLAYER?
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete user account{' '}
                <strong className="text-slate-100">{deletingUser.fullName}</strong> ({deletingUser.mobileNumber || deletingUser.email || deletingUser.uid})?
              </p>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
                <div>Current Balance: {Number(deletingUser.balance || 0).toLocaleString()} Coins</div>
                <div>Account UID: {deletingUser.uid}</div>
              </div>
              <p className="text-[11px] text-rose-400/90 font-medium">
                ⚠️ This will immediately delete their Firestore account and revoke their access. This action cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingUser(null)}
                  className="py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingUser}
                  onClick={handleConfirmDeleteUser}
                  className="py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingUser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>YES, REMOVE USER</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            SUB-MODAL 2: REJECT COIN REQUEST
        ------------------------------------------------------------- */}
        {rejectingRequest && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80">
            <div className="w-full max-w-sm bg-slate-900 border border-rose-800/80 rounded-2xl p-5 flex flex-col gap-3 shadow-2xl">
              <h4 className="font-bold text-sm uppercase text-rose-300">
                REJECT COIN REQUEST
              </h4>
              <p className="text-xs text-slate-300">
                Rejecting request for <strong>{rejectingRequest.userName}</strong> (
                {rejectingRequest.requestedAmount.toLocaleString()} Coins). The user's wallet will remain
                unchanged.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Rejection Reason (Visible to user)
                </label>
                <textarea
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-rose-400 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingRequest(null)}
                  className="py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md"
                >
                  CONFIRM REJECT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            SUB-MODAL 3: ADJUST COINS / SET EXACT BALANCE
        ------------------------------------------------------------- */}
        {adjustingUser && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 shadow-2xl">
              <h4 className="font-bold text-sm uppercase text-amber-300">
                MANAGE USER COIN BALANCE
              </h4>
              <p className="text-xs text-slate-300">
                Target player: <strong>{adjustingUser.fullName}</strong>. Current balance:{' '}
                <strong className="text-amber-400 font-mono">
                  {Number(adjustingUser.balance || 0).toLocaleString()} Coins
                </strong>
                .
              </p>

              {/* Mode Switcher: Delta vs Exact Set */}
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setAdjustMode('DELTA')}
                  className={`py-1 rounded-lg transition-colors ${
                    adjustMode === 'DELTA'
                      ? 'bg-slate-800 text-amber-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Add / Deduct Coins
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('EXACT')}
                  className={`py-1 rounded-lg transition-colors ${
                    adjustMode === 'EXACT'
                      ? 'bg-slate-800 text-amber-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Set Exact Balance
                </button>
              </div>

              {adjustMode === 'DELTA' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustType('ADMIN_CREDIT')}
                      className={`py-1.5 rounded-lg border text-xs font-bold ${
                        adjustType === 'ADMIN_CREDIT'
                          ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      CREDIT (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustType('ADMIN_DEBIT')}
                      className={`py-1.5 rounded-lg border text-xs font-bold ${
                        adjustType === 'ADMIN_DEBIT'
                          ? 'bg-rose-950 border-rose-500 text-rose-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      DEBIT (-)
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Amount to {adjustType === 'ADMIN_CREDIT' ? 'Credit' : 'Deduct'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={adjustAmount || ''}
                      onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs font-mono text-amber-200"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Set Exact New Balance
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={exactBalanceInput}
                    onChange={(e) => setExactBalanceInput(parseInt(e.target.value) || 0)}
                    placeholder="Enter target balance amount..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs font-mono text-amber-300 font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Reason for Ledger
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingUser(null)}
                  className="py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleManualAdjust}
                  className="py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md"
                >
                  APPLY CHANGE
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
