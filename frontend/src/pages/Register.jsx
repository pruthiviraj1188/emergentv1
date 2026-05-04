import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "user" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const res = await register(form);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    nav(res.user.role === "authority" ? "/authority" : "/app", { replace: true });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-zinc-50" data-testid="register-page">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-rose-600 text-white relative overflow-hidden">
        <div className="flex items-center gap-2 font-display font-black text-xl">
          <ShieldAlert /> HerNet
        </div>
        <div>
          <h1 className="font-display text-5xl font-black tracking-tighter">
            Create your <br /> safety network.
          </h1>
          <p className="mt-6 text-rose-100 max-w-md">Sign up and get AI-powered monitoring, emergency contacts, and instant alerts.</p>
        </div>
        <div className="text-xs uppercase tracking-widest text-rose-100">Free · Cancel anytime · No card required</div>
      </div>
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="text-xs uppercase tracking-widest text-zinc-500 hover:text-rose-600" data-testid="register-back-home">← Back to home</Link>
          <h2 className="mt-4 font-display text-3xl font-black tracking-tight">Register</h2>
          <p className="text-sm text-zinc-500 mt-1">Join the HerNet safety network.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="register-form">
            <div>
              <label className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-2 block">Account Type</label>
              <div className="grid grid-cols-2 gap-2">
                {["user", "authority"].map((r) => (
                  <button
                    key={r} type="button"
                    onClick={() => setForm({ ...form, role: r })}
                    className={`py-3 text-xs font-bold uppercase tracking-widest border transition-colors ${
                      form.role === r ? "bg-zinc-950 text-white border-zinc-950" : "bg-white border-zinc-200 hover:border-zinc-400"
                    }`}
                    data-testid={`register-role-${r}`}
                  >{r}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-2 block">Full Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-zinc-50 border border-zinc-200 p-3 w-full text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500" data-testid="register-name-input" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-2 block">Email</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-zinc-50 border border-zinc-200 p-3 w-full text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500" data-testid="register-email-input" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-2 block">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-zinc-50 border border-zinc-200 p-3 w-full text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500" data-testid="register-phone-input" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-2 block">Password</label>
              <input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-zinc-50 border border-zinc-200 p-3 w-full text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500" data-testid="register-password-input" />
            </div>
            {err && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3" data-testid="register-error">{err}</div>}
            <button disabled={busy} className="w-full bg-rose-600 text-white font-bold uppercase tracking-widest text-sm py-4 hover:bg-rose-700 transition-colors disabled:opacity-60" data-testid="register-submit-btn">
              {busy ? "Creating…" : "Create Account"}
            </button>
          </form>
          <div className="mt-4 text-xs text-zinc-500">
            Already have an account?{" "}
            <Link to="/login" className="text-rose-600 font-bold hover:underline" data-testid="register-to-login">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
