import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, LogOut } from "lucide-react";

export default function Navbar({ dark = false }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const onLogout = () => { logout(); nav("/"); };

  const bg = dark
    ? "bg-zinc-950/80 border-zinc-800 text-zinc-100"
    : "bg-white/70 border-white/40 text-zinc-900";

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${bg}`} data-testid="app-navbar">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display font-black text-lg tracking-tight" data-testid="nav-home-link">
          <ShieldAlert className="text-rose-600" size={22} />
          HerNet
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          {user && user.role === "user" && (
            <Link to="/app" className="hover:text-rose-600" data-testid="nav-user-dashboard">Dashboard</Link>
          )}
          {user && user.role === "admin" && (
            <Link to="/admin" className="hover:text-rose-600" data-testid="nav-admin-dashboard">Admin</Link>
          )}
          {user && user.role === "authority" && (
            <Link to="/authority" className="hover:text-rose-500" data-testid="nav-authority-dashboard">Ops</Link>
          )}
          {user ? (
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-current text-xs uppercase tracking-widest hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-colors"
              data-testid="nav-logout-btn"
            >
              <LogOut size={14} /> Logout
            </button>
          ) : (
            <>
              <Link to="/login" className="hover:text-rose-600" data-testid="nav-login-link">Login</Link>
              <Link
                to="/register"
                className="bg-rose-600 text-white px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-rose-700 transition-colors"
                data-testid="nav-register-link"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
