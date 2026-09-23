import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useGameRound } from '../hooks/useGameRound';
import { TopTabs } from '../components/TopTabs';
import { SpinWheel } from '../game/SpinWheel';
import { WheelStatus } from '../game/WheelStatus';
import { BettingButtons } from '../game/BettingButtons';
import { BetModal } from '../game/BetModal';
import { BetRestrictionModal, RestrictionType } from '../game/BetRestrictionModal';
import { WhatsAppButton } from '../components/WhatsAppButton';
import { SupportModal } from '../components/SupportModal';
import { AuthModal } from '../user/AuthModal';
import { UserProfileModal } from '../user/UserProfileModal';
import { CoinRequestModal } from '../wallet/CoinRequestModal';
import { GiftCoinsModal } from '../wallet/GiftCoinsModal';
import { AdminPanelModal } from '../admin/AdminPanelModal';
import { WheelColor, Bet } from '../types';
import { subscribeUserBetsForRound } from '../services/walletService';

export const HomePage: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();
  const { round, timeLeftMs, wheelRotation, isSpinningVisual, celebrationColor } = useGameRound();

  // Active bets by this user on the current round
  const [userBets, setUserBets] = useState<Bet[]>([]);

  // Modals state
  const [activeModal, setActiveModal] = useState<
    'AUTH' | 'PROFILE' | 'ADMIN' | 'SUPPORT' | 'COIN_REQUEST' | 'GIFT' | null
  >(null);

  // Betting states
  const [selectedBetColor, setSelectedBetColor] = useState<WheelColor | null>(null);
  const [restrictionType, setRestrictionType] = useState<RestrictionType | null>(null);

  // Success notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Subscribe to current round bets for the logged in user
  useEffect(() => {
    if (!user || !round) {
      setUserBets([]);
      return;
    }

    const unsub = subscribeUserBetsForRound(user.uid, round.id, (bets) => {
      setUserBets(bets);
    });

    return () => unsub();
  }, [user?.uid, round?.id]);

  // Handle color button selection
  const handleColorClick = (color: WheelColor) => {
    // 1. Check if logged in
    if (!user) {
      setRestrictionType('LOGIN_REQUIRED');
      return;
    }

    // 2. Check if balance is strictly 0
    const balance = Number(user.balance || 0);
    if (balance <= 0) {
      setRestrictionType('NO_COINS');
      return;
    }

    // 3. Open Bet Confirmation modal for selected color
    setSelectedBetColor(color);
  };

  const handleBetSuccess = (color: WheelColor, amount: number) => {
    showToast(`Bet placed: ${amount.toLocaleString()} coins on ${color}!`);
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Subtle background ambient game glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-gradient-to-b from-indigo-950/20 via-purple-950/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[250px] bg-gradient-to-t from-amber-950/15 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-amber-400 text-slate-950 font-bold text-xs rounded-full shadow-2xl animate-in slide-in-from-top-4 duration-200">
          {toastMessage}
        </div>
      )}

      {/* 1. TOP THREE TABS */}
      <TopTabs
        user={user}
        isAdmin={isAdmin}
        onOpenAuth={() => setActiveModal('AUTH')}
        onOpenProfile={() => setActiveModal('PROFILE')}
        onOpenAdmin={() => setActiveModal('ADMIN')}
        onOpenSupport={() => setActiveModal('SUPPORT')}
      />

      {/* 2 & 3. MAIN GAME ARENA (Centered on mobile screen) */}
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-lg mx-auto px-2 py-1 select-none">
        {/* Spin Wheel */}
        <SpinWheel
          round={round}
          rotation={wheelRotation}
          isSpinning={isSpinningVisual}
          winningColor={round?.status === 'COMPLETED' ? round.winningColor : null}
          celebrationColor={celebrationColor}
        />

        {/* Current Wheel Status & Countdown */}
        <WheelStatus round={round} timeLeftMs={timeLeftMs} />

        {/* 5 Betting Buttons */}
        <BettingButtons
          round={round}
          userBets={userBets}
          onSelectColor={handleColorClick}
          disabled={isSpinningVisual || round?.status === 'COMPLETED'}
        />
      </main>

      {/* Virtual Currency Disclaimer Footer (Compact & Mobile-friendly) */}
      <footer className="w-full text-center py-2 px-4 text-[10px] text-slate-500/80 font-sans select-none">
        <span>Virtual coin game only • No real money value • Zero cashout</span>
      </footer>

      {/* 4. FLOATING WHATSAPP SUPPORT ICON */}
      <WhatsAppButton />

      {/* 5. MODALS & DIALOGS */}
      {/* Bet Modal */}
      {selectedBetColor && (
        <BetModal
          color={selectedBetColor}
          user={user}
          round={round}
          onClose={() => setSelectedBetColor(null)}
          onRequestCoins={() => setActiveModal('COIN_REQUEST')}
          onSuccess={handleBetSuccess}
        />
      )}

      {/* Bet Restriction Modal (Login required, No coins 0 balance, Insufficient balance) */}
      {restrictionType && (
        <BetRestrictionModal
          type={restrictionType}
          user={user}
          onClose={() => setRestrictionType(null)}
          onOpenLogin={() => setActiveModal('AUTH')}
          onRequestCoins={() => setActiveModal('COIN_REQUEST')}
        />
      )}

      {/* Auth Modal (Login / Sign Up / Phone OTP / Test Accounts) */}
      {activeModal === 'AUTH' && (
        <AuthModal
          onClose={() => setActiveModal(null)}
          onSuccess={() => {
            setActiveModal(null);
            showToast('Welcome to Virtual Coin Spin!');
          }}
        />
      )}

      {/* User Profile & Ledger Modal */}
      {activeModal === 'PROFILE' && user && (
        <UserProfileModal
          user={user}
          onClose={() => setActiveModal(null)}
          onOpenRequestCoins={() => setActiveModal('COIN_REQUEST')}
          onOpenGiftCoins={() => setActiveModal('GIFT')}
          onLogout={() => {
            logout();
            setActiveModal(null);
            showToast('Logged out successfully.');
          }}
        />
      )}

      {/* Coin Request Modal (/add-coins) */}
      {activeModal === 'COIN_REQUEST' && (
        <CoinRequestModal
          user={user}
          onClose={() => setActiveModal(null)}
          onOpenLogin={() => setActiveModal('AUTH')}
        />
      )}

      {/* Gift Coins Modal */}
      {activeModal === 'GIFT' && user && (
        <GiftCoinsModal
          user={user}
          onClose={() => setActiveModal(null)}
          onSuccess={(recipient, amt) => {
            showToast(`Gifted ${amt.toLocaleString()} coins to ${recipient}!`);
          }}
        />
      )}

      {/* Admin Panel Modal */}
      {activeModal === 'ADMIN' && (
        <AdminPanelModal
          currentUser={user}
          currentRound={round}
          onClose={() => setActiveModal(null)}
          onOpenLogin={() => setActiveModal('AUTH')}
        />
      )}

      {/* Support Modal */}
      {activeModal === 'SUPPORT' && (
        <SupportModal onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
};
