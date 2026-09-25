import React from 'react';
import { getWhatsAppSupportNumber, WHATSAPP_DEFAULT_MESSAGE } from '../utils/constants';

interface SupportModalProps {
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ onClose }) => {
  const whatsappNumber = getWhatsAppSupportNumber();
  const cleanNumber = whatsappNumber.replace(/\D/g, '');

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE);
    window.open(`https://wa.me/${cleanNumber}?text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col gap-4 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <h3 className="font-bold text-base tracking-wide uppercase text-slate-100">
              CUSTOMER SUPPORT
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* WhatsApp Direct Action */}
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="w-6 h-6"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
          </div>

          <div>
            <h4 className="font-bold text-sm text-slate-100">Official WhatsApp Support</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Contact our team directly for account or coin approval assistance.
            </p>
            <div className="text-[11px] font-mono text-emerald-400 font-semibold mt-1">
              +{whatsappNumber}
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>Open WhatsApp Chat</span>
            <span>➔</span>
          </button>
        </div>

        {/* Regulatory & Virtual Coins FAQ */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 text-xs text-slate-300">
          <div className="font-bold text-amber-300 uppercase tracking-wider text-[10px] font-mono">
            VIRTUAL COINS POLICY & RULES
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
            <li>Virtual coins are for entertainment gameplay only.</li>
            <li>No real-money deposits, withdrawals, or cryptocurrency.</li>
            <li>New players start with 0 Coins (request coins from Admin).</li>
            <li>Prizes pay 4× the bet on the matching color.</li>
            <li>Rounds synchronize globally every 4 minutes.</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold"
        >
          Back to Game
        </button>
      </div>
    </div>
  );
};
