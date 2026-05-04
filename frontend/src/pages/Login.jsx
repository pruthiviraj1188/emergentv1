import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import LoginCard from "@/components/LoginCard";

export default function Login() {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-zinc-50" data-testid="login-page">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-zinc-950 text-white relative overflow-hidden">
        <div className="flex items-center gap-2 font-display font-black text-xl">
          <ShieldAlert className="text-rose-500" /> HerNet
        </div>
        <div>
          <h1 className="font-display text-5xl font-black tracking-tighter">
            When seconds matter, <br /> <span className="text-rose-500">HerNet responds.</span>
          </h1>
          <p className="mt-6 text-zinc-400 max-w-md">Sign in to access your protection network, view alerts and manage your trusted contacts.</p>
        </div>
        <div className="text-xs text-zinc-500 uppercase tracking-widest">© HerNet · Safety Grid</div>
        <div className="absolute -right-20 -top-20 w-[500px] h-[500px] bg-rose-600/20 blur-3xl rounded-full" />
      </div>
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="text-xs uppercase tracking-widest text-zinc-500 hover:text-rose-600" data-testid="login-back-home">← Back to home</Link>
          <div className="mt-4">
            <LoginCard />
          </div>
        </div>
      </div>
    </div>
  );
}
