import React, { useRef } from "react";
import { motion } from "framer-motion";
import { Siren } from "lucide-react";

export default function SOSButton({ onTrigger, onStopAlarm, disabled = false }) {
  const alarmRef = useRef(null);

  const playSOSAlarm = () => {
    try {
      const playSiren = (context) => {
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
          if (i % 2 === 0) {
            osc.frequency.setValueAtTime(600, t);
            osc.frequency.linearRampToValueAtTime(1200, t + sweepTime);
          } else {
            osc.frequency.setValueAtTime(1200, t);
            osc.frequency.linearRampToValueAtTime(600, t + sweepTime);
          }
        }
        osc.start(context.currentTime);
        osc.stop(context.currentTime + duration);
      };

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      playSiren(ctx);

      alarmRef.current = setInterval(() => {
        try {
          const loopCtx = new (window.AudioContext || window.webkitAudioContext)();
          playSiren(loopCtx);
        } catch {}
      }, 10000);

      if (onStopAlarm) {
        onStopAlarm.current = () => {
          clearInterval(alarmRef.current);
          alarmRef.current = null;
        };
      }
    } catch {}
  };

  const handleTap = () => {
    if (disabled) return;
    playSOSAlarm();
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
