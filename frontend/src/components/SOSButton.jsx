import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Siren } from "lucide-react";

export default function SOSButton({ onTrigger, disabled = false, doubleTapMs = 400 }) {
  const [tapped, setTapped] = useState(false);
  const lastTap = useRef(0);
  const resetTimer = useRef(null);

  const playBeep = (frequency = 880, duration = 0.15, volume = 1) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  const playSOSAlarm = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Three rising beeps — SOS pattern
      [0, 0.2, 0.4].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1200;
        gain.gain.setValueAtTime(1, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.18);
      });
    } catch {}
  };

  const handleTap = () => {
    if (disabled) return;
    const now = Date.now();
    if (now - lastTap.current <= doubleTapMs) {
      clearTimeout(resetTimer.current);
      setTapped(false);
      lastTap.current = 0;
      playSOSAlarm();
      onTrigger?.();
    } else {
      lastTap.current = now;
      setTapped(true);
      playBeep(660, 0.12);
      resetTimer.current = setTimeout(() => {
        setTapped(false);
        lastTap.current = 0;
      }, doubleTapMs);
    }
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
          whileTap={{ scale: 0.95 }}
          className="absolute inset-3 rounded-full bg-rose-600 text-white font-black flex flex-col items-center justify-center gap-2 shadow-[0_0_60px_rgba(225,29,72,0.45)] hover:bg-rose-700 transition-colors disabled:opacity-50 pulse-ring"
          data-testid="sos-trigger-btn"
        >
          <Siren size={40} />
          <span className="font-display text-3xl tracking-tight">SOS</span>
          <span className="text-[10px] uppercase tracking-[0.25em] font-medium">Double Tap to Alert</span>
        </motion.button>
      </div>
      <AnimatePresence>
        {tapped && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-xs uppercase tracking-widest text-rose-600 font-bold"
            data-testid="sos-holding-indicator"
          >
            Tap again to confirm SOS!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
