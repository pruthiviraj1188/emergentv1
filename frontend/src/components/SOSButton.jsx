import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Siren } from "lucide-react";

export default function SOSButton({ onTrigger, onStopAlarm, disabled = false }) {
  const alarmRef = useRef(null);

  const playSiren = () => {
    try {
      const run = (context) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.connect(gain);
        gain.connect(context.destination);
        osc.type = "sawtooth";
        gain.gain.setValueAtTime(2, context.currentTime);
        const duration = 10;
        const sweepTime = 0.6;
        for (let i = 0; i < duration / sweepTime; i++) {
          const t = context.currentTime + i * sweepTime;
          osc.frequency.setValueAtTime(i % 2 === 0 ? 600 : 1200, t);
          osc.frequency.linearRampToValueAtTime(i % 2 === 0 ? 1200 : 600, t + sweepTime);
        }
        osc.start(context.currentTime);
        osc.stop(context.currentTime + duration);
      };
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      run(ctx);
      alarmRef.current = setInterval(() => {
        try { const c = new (window.AudioContext || window.webkitAudioContext)(); run(c); } catch {}
      }, 10000);
      if (onStopAlarm) {
        onStopAlarm.current = () => { clearInterval(alarmRef.current); alarmRef.current = null; };
      }
    } catch {}
  };

  // Listen for delayed siren trigger from dashboard
  useEffect(() => {
    const handler = () => playSiren();
    window.addEventListener("hernet-play-siren", handler);
    return () => window.removeEventListener("hernet-play-siren", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = () => {
    if (disabled) return;
    onTrigger?.();
  };

  const size = 240;
  const stroke = 8;
  const r = (size - stroke) / 2;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }} data-testid="sos-button-wrap">
        <svg width={size} height={size} className="absolute inset-0 -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fecdd3" strokeWidth={stroke} />
        </svg>
        <motion.button
          type="button"
          disabled={disabled}
          onClick={handleTap}
          whileTap={{ scale: 0.92 }}
          className="absolute inset-3 rounded-full bg-rose-600 text-white font-black flex flex-col items-center justify-center gap-2 shadow-[0_0_60px_rgba(225,29,72,0.45)] hover:bg-rose-700 transition-colors disabled:opacity-50 pulse-ring"
          data-testid="sos-trigger-btn"
        >
          <Siren size={40} />
          <span className="font-display text-3xl tracking-tight">SOS</span>
          <span className="text-[10px] uppercase tracking-[0.25em] font-medium">Tap to Alert</span>
        </motion.button>
      </div>
    </div>
  );
}
