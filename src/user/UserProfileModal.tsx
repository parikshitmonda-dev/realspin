import React, { useState, useEffect } from 'react';
import { UserProfile, LedgerTransaction } from '../types';
import { subscribeUserLedger } from '../services/walletService';

interface UserProfileModalProps {
  user: UserProfile;
  onClose: () => void;
  onOpenRequestCoins: () => void;
  onOpenGiftCoins: () => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  onClose,
  onOpenRequestCoins,
  onOpenGiftCoins,
  onLogout,
}) => {
  const [ledger, setLedger] = useState<LedgerTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LEDGER'>('OVERVIEW');
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    const unsub = subscribeUserLedger(user.uid, (data) => {
      setLedger(data);
    });
    return () => unsub();
  }, [user.uid]);

  const filteredLedger = ledger.filter((item) => {
    if (filterType === 'ALL') return true;
    return item.type === filterType;
  });

  const getLedgerBadge = (type: string) => {
    switch (type) {
      case 'ADMIN_CREDIT':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
      case 'WIN_CREDIT':
        return 'bg-amber-950/80 text-amber-300 border-amber-600/60';
      case 'BET_DEBIT':
        return 'bg-blue-950/80 text-blue-300 border-blue-700/60';
      case 'GIFT_SENT':
        return 'bg-purple-950/80 text-purple-300 border-purple-700/60';
      case 'GIFT_RECEIVED':
        return 'bg-pink-950/80 text-pink-300 border-pink-700/60';
      case 'ADMIN_DEBIT':
        return 'bg-rose-950/80 text-rose-300 border-rose-700/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col max-h-[90vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-base">
              {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-wide uppercase text-slate-100">
                {user.fullName || 'Player Account'}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                ID: {user.uid.slice(0, 10)}...
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab switchers */}
        <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 my-3">
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeTab === 'OVERVIEW'
                ? 'bg-slate-800 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            WALLET & PROFILE
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LEDGER')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeTab === 'LEDGER'
                ? 'bg-slate-800 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            TRANSACTION LEDGER ({ledger.length})
          </button>
        </div>

        {/* Tab 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-4">
            {/* Balance Card */}
            <div className="bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-1 shadow-lg">
              <div className="text-[11px] text-amber-300/80 uppercase font-mono tracking-wider font-semibold">
                CURRENT VIRTUAL COIN BALANCE
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-3xl">🪙</span>
                <span className="text-3xl font-mono font-bold text-amber-300 tracking-tight">
                  {Number(user.balance || 0).toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 font-mono self-end mb-1">Coins</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-800/80 pt-2 flex items-center justify-between">
                <span>Value: ₹0 / $0 (Entertainment Only)</span>
                <span className="text-amber-400/90 font-medium">Non-transferable to cash</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRequestCoins();
                }}
                className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <span>➕</span>
                <span>REQUEST COINS</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGiftCoins();
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs border border-slate-700 shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <span>🎁</span>
                <span>GIFT COINS</span>
              </button>
            </div>

            {/* Profile Info Fields */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Full Name</span>
                <span className="font-semibold text-slate-200">{user.fullName || 'Not specified'}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Mobile Number</span>
                <span className="font-mono text-slate-200">{user.mobileNumber || 'Not provided'}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Email</span>
                <span className="text-slate-200 truncate max-w-[200px]">{user.email || 'None'}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Account Role</span>
                <span className="font-mono uppercase font-bold text-purple-400">{user.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Joined Date</span>
                <span className="font-mono text-slate-300">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full py-2.5 rounded-xl border border-rose-900/60 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 text-xs font-bold transition-colors mt-auto"
            >
              LOG OUT OF ACCOUNT
            </button>
          </div>
        )}

        {/* Tab 2: TRANSACTION LEDGER */}
        {activeTab === 'LEDGER' && (
          <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-2.5">
            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-mono no-scrollbar">
              {['ALL', 'ADMIN_CREDIT', 'WIN_CREDIT', 'BET_DEBIT', 'GIFT_SENT', 'GIFT_RECEIVED'].map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setFilterType(f)}
                    className={`px-2 py-1 rounded-lg border whitespace-nowrap transition-colors ${
                      filterType === f
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.replace('_', ' ')}
                  </button>
                )
              )}
            </div>

            {filteredLedger.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                No ledger records found.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredLedger.map((tx) => {
                  const isPositive = tx.amount > 0;
                  return (
                    <div
                      key={tx.id}
                      className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getLedgerBadge(
                            tx.type
                          )}`}
                        >
                          {tx.type}
                        </span>
                        <span
                          className={`font-mono font-bold text-xs ${
                            isPositive ? 'text-emerald-400' : 'text-slate-300'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {tx.amount.toLocaleString()} Coins
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 leading-snug">
                        {tx.description}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-900">
                        <span>{new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>
                          Bal: {tx.balanceBefore.toLocaleString()} ➔{' '}
                          <strong className="text-slate-300">{tx.balanceAfter.toLocaleString()}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
