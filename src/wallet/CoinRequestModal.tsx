import React, { useState, useEffect } from 'react';
import { UserProfile, CoinRequest } from '../types';
import { requestVirtualCoins, subscribeUserCoinRequests } from '../services/walletService';
import { MAX_PENDING_COIN_REQUESTS } from '../utils/constants';

interface CoinRequestModalProps {
  user: UserProfile | null;
  onClose: () => void;
  onOpenLogin: () => void;
}

export const CoinRequestModal: React.FC<CoinRequestModalProps> = ({
  user,
  onClose,
  onOpenLogin,
}) => {
  const [amount, setAmount] = useState<number>(5000);
  const [message, setMessage] = useState<string>('Please add virtual coins to my account');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [requests, setRequests] = useState<CoinRequest[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserCoinRequests(user.uid, (data) => {
      setRequests(data);
    });
    return () => unsub();
  }, [user]);

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center gap-4">
          <div className="text-3xl">🪙</div>
          <h3 className="text-base font-bold text-slate-100 uppercase">
            AUTHENTICATION REQUIRED
          </h3>
          <p className="text-xs text-slate-400">
            Please log in or register before requesting virtual coins.
          </p>
          <div className="flex gap-2 w-full pt-2">
            <button
              onClick={onClose}
              className="w-1/2 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenLogin();
              }}
              className="w-1/2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
            >
              Log In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const isPendingMaxed = pendingCount >= MAX_PENDING_COIN_REQUESTS;

  const presets = [1000, 2500, 5000, 10000, 25000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (isPendingMaxed) {
      setSubmitError(
        `Pending limit reached (${pendingCount}/${MAX_PENDING_COIN_REQUESTS}). Please wait for administrator review.`
      );
      return;
    }

    setSubmitting(true);
    const res = await requestVirtualCoins(user, amount, message);
    setSubmitting(false);

    if (res.success) {
      setSubmitSuccess('Coin request submitted successfully with status PENDING!');
      setMessage('Please add virtual coins to my account');
    } else {
      setSubmitError(res.error || 'Failed to submit coin request.');
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
          <div className="flex items-center gap-2">
            <span className="text-xl">🪙</span>
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-wide uppercase text-slate-100">
                REQUEST VIRTUAL COINS
              </h3>
              <p className="text-[10px] text-slate-400">
                Direct admin approval system • No payment required
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

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-4 my-3">
          {/* Important Virtual Coin Notice */}
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200/90 leading-relaxed flex items-start gap-2">
            <span className="text-amber-400 text-base leading-none">ℹ️</span>
            <div>
              <strong className="text-amber-300">Strictly Virtual Entertainment:</strong> Coins are
              for gameplay only, hold zero cash/crypto value, and cannot be withdrawn.
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Amount input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Requested Amount:
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  Balance: {Number(user.balance || 0).toLocaleString()} Coins
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="100"
                  max="100000"
                  value={amount || ''}
                  onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                  disabled={isPendingMaxed || submitting}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-base font-mono text-amber-200 focus:outline-none focus:border-amber-400 shadow-inner disabled:opacity-50"
                  placeholder="5000"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">
                  Coins
                </span>
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={isPendingMaxed || submitting}
                  onClick={() => setAmount(p)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-colors disabled:opacity-40 ${
                    amount === p
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  {p.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Message input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Message to Administrator:
              </label>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isPendingMaxed || submitting}
                placeholder="Please add virtual coins to my account"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 resize-none disabled:opacity-50 shadow-inner"
              />
            </div>

            {/* Alerts */}
            {submitSuccess && (
              <div className="p-2.5 bg-emerald-950/50 border border-emerald-700/60 rounded-xl text-xs text-emerald-300">
                {submitSuccess}
              </div>
            )}
            {submitError && (
              <div className="p-2.5 bg-red-950/50 border border-red-700/60 rounded-xl text-xs text-red-300">
                {submitError}
              </div>
            )}

            {/* Pending protection notice */}
            {isPendingMaxed && (
              <div className="p-2.5 bg-amber-950/40 border border-amber-700/50 rounded-xl text-[11px] text-amber-300">
                ⚠️ Multiple Pending Request Protection: You currently have {pendingCount} pending
                request(s). Please wait for admin approval before requesting again.
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || isPendingMaxed}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'SENDING REQUEST...' : 'SEND REQUEST'}
            </button>
          </form>

          {/* Past Requests History Table */}
          <div className="pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Your Coin Requests History
            </h4>

            {requests.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/80">
                No coin requests submitted yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-amber-300">
                        <span>🪙</span>
                        <span>{req.requestedAmount.toLocaleString()} Coins</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase font-mono tracking-wider ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                            : req.status === 'REJECTED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                            : 'bg-amber-950 text-amber-300 border border-amber-700/60 animate-pulse'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>{new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="italic truncate max-w-[180px]">"{req.message}"</span>
                    </div>

                    {req.adminReason && (
                      <div className="mt-1 p-1.5 bg-slate-900 border border-slate-700/60 rounded-lg text-[11px] text-slate-300">
                        <strong className="text-slate-400">Admin Response:</strong> {req.adminReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
