import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { Users, ShieldAlert, CheckCircle2, Activity } from "lucide-react";

function Stat({ icon: Icon, label, value, accent = false, testId }) {
  return (
    <div className={`p-6 border ${accent ? "bg-zinc-950 text-white border-zinc-950" : "bg-white border-zinc-200"}`} data-testid={testId}>
      <Icon size={20} className={accent ? "text-rose-500" : "text-rose-600"} />
      <div className={`mt-6 text-xs font-bold uppercase tracking-widest ${accent ? "text-zinc-400" : "text-zinc-500"}`}>{label}</div>
      <div className="font-display text-4xl font-black tracking-tighter mt-1">{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const load = async () => {
    const [s, u, a] = await Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/users"),
      api.get("/sos/all"),
    ]);
    setStats(s.data); setUsers(u.data); setAlerts(a.data);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="admin-dashboard">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-rose-600 mb-1">Platform Control</div>
        <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tighter">Admin Dashboard</h1>
        <p className="text-zinc-500 mt-1">Monitor users, authorities, and all incidents across the network.</p>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="admin-stats-grid">
          <Stat icon={Users} label="Users" value={stats?.total_users ?? "—"} testId="stat-users" />
          <Stat icon={ShieldAlert} label="Authorities" value={stats?.total_authorities ?? "—"} testId="stat-authorities" />
          <Stat icon={Activity} label="Active Alerts" value={stats?.active_alerts ?? "—"} accent testId="stat-active-alerts" />
          <Stat icon={CheckCircle2} label="Resolved" value={stats?.resolved_alerts ?? "—"} testId="stat-resolved" />
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-white border border-zinc-200 p-6" data-testid="admin-alerts-table">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Recent Alerts</div>
              <span className="text-xs text-zinc-500">{alerts.length}</span>
            </div>
            <div className="divide-y divide-zinc-100 max-h-[520px] overflow-y-auto">
              {alerts.length === 0 && <div className="text-sm text-zinc-500 py-6">No alerts yet.</div>}
              {alerts.map((a) => (
                <div key={a.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold">{a.user_name}</div>
                    <div className="text-xs text-zinc-500">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 ${
                      a.status === "active" ? "bg-rose-600 text-white" :
                      a.status === "resolved" ? "bg-emerald-600 text-white" : "bg-zinc-500 text-white"
                    }`}>{a.status}</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 border border-zinc-200">{a.threat_level}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-zinc-200 p-6" data-testid="admin-users-table">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Users</div>
              <span className="text-xs text-zinc-500">{users.length}</span>
            </div>
            <div className="divide-y divide-zinc-100 max-h-[520px] overflow-y-auto">
              {users.map((u) => (
                <div key={u.id} className="py-3">
                  <div className="font-bold">{u.name}</div>
                  <div className="text-xs text-zinc-500 flex items-center justify-between">
                    <span>{u.email}</span>
                    <span className="uppercase tracking-widest font-bold">{u.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
