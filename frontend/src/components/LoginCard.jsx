import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldAlert, UserCircle2, Siren } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const ROLES = [
  { key: "user", label: "User", icon: UserCircle2, desc: "Personal safety monitoring" },
  { key: "authority", label: "Authority", icon: Siren, desc: "Respond to live incidents" },
];

export default function LoginCard({ compact = false }) {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [role, setRole] = useState("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const res = await login({ email, password, role });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    const dest =
      
      res.user.role === "authority" ? "/authority" : "/app";
    const from = loc.state?.from?.pathname;
    nav(from && !from.startsWith("/login") ? from : dest, { replace: true });
  };

  const current = ROLES.find((r) => r.key === role);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`backdrop-blur-xl bg-white/80 border border-zinc-200 shadow-2xl ${compact ? "p-6" : "p-8 md:p-10"}`}
      data-testid="login-card"
    >
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert className="text-rose-600" size={18} />
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Secure Access</span>
      </div>
      <h3 className="font-display text-2xl font-black tracking-tight text-zinc-950 mb-6">
        Login to your HerNet account
      </h3>

      <div className="mb-5">
        <label className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-2 block">Select Role</label>
        <div className="grid grid-cols-3 gap-2" role="tablist" data-testid="role-tabs">
          {ROLES.map((r) => {
            const Icon = r.icon;
            const active = role === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRole(r.key)}
                className={`flex flex-col items-center gap-1 py-3 border text-xs font-bold uppercase tracking-wider transition-colors ${
                  active
                    ? "bg-zinc-950 text-white border-zinc-950"
                    : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                }`}
                data-testid={`role-tab-${r.key}`}
              >
                <Icon size={18} />
                {r.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500 mt-2">{current.desc}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
        <div>
          <label className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-2 block">Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-zinc-50 border border-zinc-200 rounded-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all p-3 w-full text-sm"
            placeholder="you@example.com"
            data-testid="login-email-input"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-2 block">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-zinc-50 border border-zinc-200 rounded-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all p-3 w-full text-sm"
            placeholder="••••••••"
            data-testid="login-password-input"
          />
        </div>
        {err && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3" data-testid="login-error">
            {err}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-rose-600 text-white font-bold uppercase tracking-widest text-sm py-4 hover:bg-rose-700 transition-colors disabled:opacity-60"
          data-testid="login-submit-btn"
        >
          {busy ? "Authenticating…" : "Secure Access"}
        </button>
        <Link
          to="/"
          className="block text-center text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-4"
          data-testid="login-anon-link"
        >
          Continue anonymously (limited features)
        </Link>
      </form>

      <div className="mt-6 pt-5 border-t border-zinc-200 text-xs text-zinc-600 space-y-1" data-testid="demo-credentials">
        <div className="text-zinc-500">Register to create User/Authority accounts</div>
      </div>

      <div className="mt-4 text-center">
        <span className="text-xs text-zinc-500">No account yet?</span>{" "}
        <Link to="/register" className="text-xs font-bold text-rose-600 hover:underline" data-testid="login-to-register">
          Register here
        </Link>
      </div>
    </motion.div>
  );
}
