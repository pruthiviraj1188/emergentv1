import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Siren, CheckCircle2, Radio, Crosshair } from "lucide-react";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";

function LevelDot({ level }) {
  const c = level === "high" ? "bg-rose-500" : level === "medium" ? "bg-amber-400" : "bg-emerald-500";
  return <span className={`w-2 h-2 rounded-full ${c} ${level === "high" ? "pulse-ring" : ""}`} />;
}

export default function AuthorityDashboard() {
  const [alerts, setAlerts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");

  const load = async () => {
    const { data } = await api.get("/sos/active");
    setAlerts(data);
    if (selected && !data.find((a) => a.id === selected.id)) setSelected(null);
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolve = async (id) => {
    await api.post(`/sos/${id}/resolve`, { resolution_note: note });
    setNote("");
    load();
  };

  const sortedByThreat = useMemo(() =>
    [...alerts].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.threat_level] - order[b.threat_level];
    }), [alerts]);

  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-100" data-testid="authority-dashboard">
      <Navbar dark />
      <div className="max-w-full mx-auto grid grid-cols-1 lg:grid-cols-4 min-h-[calc(100vh-4rem)]">
        {/* Sidebar feed */}
        <aside className="lg:col-span-1 border-r border-zinc-800 overflow-y-auto" data-testid="authority-alert-feed">
          <div className="p-5 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
            <div className="text-[10px] uppercase tracking-[0.25em] text-rose-500 font-bold flex items-center gap-2">
              <Radio size={12} /> Active Feed
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <h2 className="font-display text-2xl font-black tracking-tighter">{alerts.length} Incidents</h2>
              <span className="text-xs text-zinc-500">Auto-refresh 5s</span>
            </div>
          </div>
          <div className="divide-y divide-zinc-800">
            {sortedByThreat.length === 0 && <div className="p-6 text-sm text-zinc-500">No active incidents.</div>}
            {sortedByThreat.map((a) => {
              const isActive = selected?.id === a.id;
              const isHigh = a.threat_level === "high";
              return (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`w-full text-left p-4 transition-colors ${isActive ? "bg-zinc-900" : "hover:bg-zinc-900/60"} ${isHigh ? "border-l-2 border-rose-500" : "border-l-2 border-transparent"}`}
                  data-testid={`alert-feed-item-${a.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LevelDot level={a.threat_level} />
                      <span className="text-xs uppercase tracking-widest font-bold">{a.threat_level}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">{new Date(a.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-2 font-bold">{a.user_name}</div>
                  <div className="text-xs text-zinc-500">{a.user_phone || "No phone"}</div>
                  <div className="text-xs text-zinc-400 font-mono mt-1">
                    {a.lat != null ? `${a.lat.toFixed(3)}, ${a.lng.toFixed(3)}` : "Location unavailable"}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main / Map */}
        <main className="lg:col-span-3 bg-zinc-950 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: "linear-gradient(rgba(244,63,94,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(244,63,94,0.2) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }} />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <Crosshair className="text-rose-600/10" size={500} />
          </div>

          {/* Overlaid cards */}
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="relative z-10 m-8 max-w-2xl bg-zinc-900 border border-zinc-800 p-8"
                data-testid="alert-detail-card"
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-rose-500 font-bold">
                  <Siren size={14} /> Active Incident
                </div>
                <h2 className="font-display text-3xl font-black tracking-tighter mt-2">{selected.user_name}</h2>
                <div className="mt-1 text-zinc-400 text-sm">{selected.user_phone || "No phone on file"}</div>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="border border-zinc-800 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">Threat Level</div>
                    <div className="font-display text-2xl font-black mt-1 uppercase">{selected.threat_level}</div>
                  </div>
                  <div className="border border-zinc-800 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">Triggered</div>
                    <div className="mt-1 text-sm">{new Date(selected.created_at).toLocaleString()}</div>
                  </div>
                  <div className="col-span-2 border border-zinc-800 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-2"><MapPin size={12} /> Location</div>
                    <div className="font-mono text-sm mt-1">
                      {selected.lat != null ? `${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}` : "Unavailable"}
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block mb-1">Resolution Note</label>
                  <textarea
                    value={note} onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-950 border border-zinc-800 p-3 text-sm text-zinc-100"
                    placeholder="Dispatch status, notes, outcome…"
                    data-testid="resolve-note-input"
                  />
                </div>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => resolve(selected.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest text-xs px-5 py-3 inline-flex items-center gap-2" data-testid="resolve-alert-btn">
                    <CheckCircle2 size={14} /> Mark Resolved
                  </button>
                  <button onClick={() => setSelected(null)} className="border border-zinc-700 text-zinc-300 font-bold uppercase tracking-widest text-xs px-5 py-3">Close</button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="relative z-10 h-full flex items-center justify-center text-center p-10"
              >
                <div className="max-w-md">
                  <Crosshair size={40} className="mx-auto text-rose-500" />
                  <h2 className="mt-4 font-display text-3xl font-black tracking-tighter">Command Center</h2>
                  <p className="text-zinc-400 mt-2">Select an active incident from the feed to view details, location, and dispatch actions.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
