import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const {
    signInWithGoogle,
    registerWithEmail,
    loginWithEmail,
    loginOrRegisterWithPhone,
    loginAsDemoUser,
  } = useAuth();

  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP' | 'PHONE'>('SIGNUP');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'SIGNUP') {
        if (!fullName.trim()) {
          setError('Please enter your Full Name.');
          setLoading(false);
          return;
        }
        if (!mobileNumber.trim() || mobileNumber.trim().length < 8) {
          setError('Please enter a valid Mobile Number (at least 8 digits).');
          setLoading(false);
          return;
        }
        if (!email.trim() || !email.includes('@')) {
          setError('Please enter a valid Email Address.');
          setLoading(false);
          return;
        }
        if (!password || password.length < 6) {
          setError('Password must be at least 6 characters long.');
          setLoading(false);
          return;
        }
        await registerWithEmail(email.trim(), password, fullName.trim(), mobileNumber.trim());
      } else {
        if (!email.trim()) {
          setError('Please enter your Email Address.');
          setLoading(false);
          return;
        }
        if (!password) {
          setError('Please enter your Password.');
          setLoading(false);
          return;
        }
        await loginWithEmail(email.trim(), password);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otpSent) {
      if (!mobileNumber.trim() || mobileNumber.replace(/\D/g, '').length < 8) {
        setError('Please enter a valid mobile number (e.g. +919876543210).');
        return;
      }
      setOtpSent(true);
    } else {
      if (!phoneOtp || phoneOtp.length < 4) {
        setError('Please enter the verification code.');
        return;
      }
      setLoading(true);
      try {
        await loginOrRegisterWithPhone(mobileNumber.trim(), fullName.trim());
        onSuccess();
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Phone authentication failed.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleQuickAccount = async () => {
    setLoading(true);
    try {
      await loginAsDemoUser(false);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError('Quick account switch failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col gap-4 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-base tracking-wide uppercase text-slate-100">
              {mode === 'SIGNUP'
                ? 'CREATE ACCOUNT'
                : mode === 'PHONE'
                ? 'PHONE LOGIN / OTP'
                : 'USER LOGIN'}
            </h3>
            <p className="text-[10px] text-slate-400">
              Starts strictly with 0 Coins • No demo coins
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab switchers */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              setError(null);
            }}
            className={`py-1.5 rounded-lg transition-colors ${
              mode === 'LOGIN'
                ? 'bg-slate-800 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            LOGIN
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('SIGNUP');
              setError(null);
            }}
            className={`py-1.5 rounded-lg transition-colors ${
              mode === 'SIGNUP'
                ? 'bg-slate-800 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SIGN UP
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('PHONE');
              setError(null);
            }}
            className={`py-1.5 rounded-lg transition-colors ${
              mode === 'PHONE'
                ? 'bg-slate-800 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PHONE OTP
          </button>
        </div>

        {/* Google Sign-In button */}
        {mode !== 'PHONE' && (
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogle}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        )}

        {mode !== 'PHONE' && (
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono my-0.5">
            <div className="h-px bg-slate-800 flex-1" />
            <span>OR WITH EMAIL</span>
            <div className="h-px bg-slate-800 flex-1" />
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="p-2.5 bg-rose-950/60 border border-rose-800/70 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Email Form */}
        {mode !== 'PHONE' ? (
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            {mode === 'SIGNUP' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Mobile Number (for gifts & coin requests)
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50 mt-1"
            >
              {loading
                ? 'PROCESSING...'
                : mode === 'SIGNUP'
                ? 'CREATE ACCOUNT (0 COINS)'
                : 'SIGN IN TO PLAY'}
            </button>
          </form>
        ) : (
          /* Phone Form */
          <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-3">
            {!otpSent ? (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md mt-1"
                >
                  SEND OTP CODE
                </button>
              </>
            ) : (
              <>
                <div className="p-2.5 bg-emerald-950/50 border border-emerald-700/60 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                  <span>OTP sent to {mobileNumber}</span>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-[10px] text-amber-300 underline"
                  >
                    Change
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Enter Verification Code (OTP)
                  </label>
                  <input
                    type="text"
                    required
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-center text-base font-mono tracking-widest text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 text-center">
                    Enter any 6-digit code for verification simulation
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md"
                >
                  {loading ? 'VERIFYING...' : 'VERIFY & SIGN IN'}
                </button>
              </>
            )}
          </form>
        )}

        {/* Fast Interactive Testing Switcher */}
        <div className="pt-2 border-t border-slate-800">
          <div className="text-[10px] text-slate-400 text-center uppercase tracking-wider mb-2 font-mono">
            Fast Interactive Testing Switcher
          </div>
          <div>
            <button
              type="button"
              onClick={handleQuickAccount}
              className="w-full py-1.5 px-2 bg-slate-950 border border-slate-700/80 rounded-lg text-[10px] text-amber-200/90 font-medium hover:bg-slate-800 transition-colors"
            >
              👤 Test Player (0 Coins)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
