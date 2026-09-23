import React, { useState } from 'react';
import { UserProfile } from '../types';
import { giftVirtualCoins } from '../services/walletService';

interface GiftCoinsModalProps {
  user: UserProfile;
  onClose: () => void;
  onSuccess: (recipient: string, amount: number) => void;
}

export const GiftCoinsModal: React.FC<GiftCoinsModalProps> = ({
  user,
  onClose,
  onSuccess,
}) => {
  const [recipientMobile, setRecipientMobile] = useState('');
  const [amount, setAmount] = useState<number>(500);
  const [message, setMessage] = useState('Enjoy!');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const balance = Number(user.balance || 0);
  const presets = [100, 250, 500, 1000, 2500];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (balance < amount) {
      setErrorMessage(`Insufficient balance. You have ${balance.toLocaleString()} Coins.`);
      return;
    }

    setSubmitting(true);
    const res = await giftVirtualCoins(user, recipientMobile, amount, message);
    setSubmitting(false);

    if (res.success) {
      onSuccess(recipientMobile, amount);
      onClose();
    } else {
      setErrorMessage(res.error || 'Failed to gift coins.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎁</span>
            <h3 className="font-bold text-base tracking-wide uppercase text-slate-100">
              GIFT VIRTUAL COINS
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Balance */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Your Balance</span>
          <span className="font-mono font-bold text-amber-300 text-sm">
            🪙 {balance.toLocaleString()} Coins
          </span>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-xs text-red-300 font-medium">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Recipient Mobile Number
            </label>
            <input
              type="tel"
              value={recipientMobile}
              onChange={(e) => setRecipientMobile(e.target.value)}
              placeholder="+919876543210"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Amount (Virtual Coins)
            </label>
            <input
              type="number"
              min="1"
              max={balance}
              value={amount || ''}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-amber-200 focus:outline-none focus:border-amber-400"
              required
            />
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(p)}
                  className={`text-[11px] px-2 py-0.5 rounded-lg border font-mono ${
                    amount === p
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  +{p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Message
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enjoy!"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-300 font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || balance < amount}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50"
            >
              {submitting ? 'TRANSFERRING...' : 'SEND GIFT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
