import React, { useState } from 'react';
import { getWhatsAppSupportNumber, WHATSAPP_DEFAULT_MESSAGE } from '../utils/constants';

interface WhatsAppButtonProps {
  customNumber?: string;
  onClickCustom?: () => void;
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
  customNumber,
  onClickCustom,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const rawNumber = customNumber || getWhatsAppSupportNumber();
  const cleanNumber = rawNumber.replace(/\D/g, '');

  const handleClick = (e: React.MouseEvent) => {
    if (onClickCustom) {
      e.preventDefault();
      onClickCustom();
      return;
    }

    const encodedMsg = encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE);
    const url = `https://wa.me/${cleanNumber}?text=${encodedMsg}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end pointer-events-auto">
      {/* Desktop Tooltip */}
      {showTooltip && (
        <div className="hidden sm:block mb-2 px-3 py-1.5 bg-slate-900/95 border border-emerald-500/40 text-emerald-300 text-xs font-medium rounded-lg shadow-xl backdrop-blur-sm animate-in fade-in duration-150">
          Chat with Virtual Spin Support
        </div>
      )}

      {/* Floating Button */}
      <button
        type="button"
        id="whatsapp-support-button"
        aria-label="Contact Customer Support on WhatsApp"
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="group relative flex flex-col items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-[0_6px_20px_rgba(37,211,102,0.45)] hover:shadow-[0_8px_25px_rgba(37,211,102,0.6)] hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-emerald-400/40"
      >
        {/* Continuous soft pulse animation ring */}
        <span className="absolute -inset-1 rounded-full bg-[#25D366] opacity-35 animate-ping pointer-events-none" />

        {/* WhatsApp Icon SVG */}
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6 text-white drop-shadow-sm"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>

        {/* Micro-label underneath */}
        <span className="text-[8px] font-bold tracking-tight text-white/95 uppercase -mt-0.5">
          Support
        </span>
      </button>
    </div>
  );
};
