import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Plus, Trash2, Radio, Clock, Video, Mic, StopCircle, Shield, Download } from "lucide-react";
import Navbar from "@/components/Navbar";
import SOSButton from "@/components/SOSButton";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

function ThreatPill({ level }) {
  const map = { low: "bg-emerald-50 text-emerald-700 border-emerald-200", medium: "bg-amber-50 text-amber-700 border-amber-200", high: "bg-rose-50 text-rose-700 border-rose-200" };
  return <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 border ${map[level]}`}>{level}</span>;
}

function StatusPill({ status }) {
  const map = { active: "bg-rose-600 text-white", resolved: "bg-emerald-600 text-white", dismissed: "bg-zinc-500 text-white" };
  return <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 ${map[status] || "bg-zinc-200"}`}>{status}</span>;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loc, setLoc] = useState(null);
  const [threatLevel, setThreatLevel] = useState("high");
  const [newContact, setNewContact] = useState({ name: "", phone: "", relation: "" });
  const [toast, setToast] = useState("");
  const [channels, setChannels] = useState({ sms_enabled: false, email_enabled: false });
  const [sosActive, setSosActive] = useState(false);
  const [sosLoc, setSosLoc] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [recordedBack, setRecordedBack] = useState([]);
  const [recordedFront, setRecordedFront] = useState([]);
  const [vault, setVault] = useState(() => JSON.parse(localStorage.getItem("sos_vault") || "[]"));

  const backRecorderRef = useRef(null);
  const frontRecorderRef = useRef(null);
  const backStreamRef = useRef(null);
  const frontStreamRef = useRef(null);
  const backVideoRef = useRef(null);
  const frontVideoRef = useRef(null);
  const backChunksRef = useRef([]);
  const frontChunksRef = useRef([]);
  const stopAlarmRef = useRef(null);
  const sosEventRef = useRef(null);  const setBackVideoRef = (node) => {
    backVideoRef.current = node;
    if (node && backStreamRef.current) { node.srcObject = backStreamRef.current; node.play().catch(() => {}); }
  };
  const setFrontVideoRef = (node) => {
    frontVideoRef.current = node;
    if (node && frontStreamRef.current) { node.srcObject = frontStreamRef.current; node.play().catch(() => {}); }
  };

  const showToast = (msg, ms = 4000) => { setToast(msg); setTimeout(() => setToast(""), ms); };

  const load = async () => {
    const [a, c, s] = await Promise.all([
      api.get("/sos/my"),
      api.get("/contacts"),
      api.get("/notifications/status").catch(() => ({ data: { sms_enabled: false, email_enabled: false } })),
    ]);
    setAlerts(a.data);
    setContacts(c.data);
    setChannels(s.data);
  };

  useEffect(() => { load(); }, []);

  // Auto location tracking
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setLoc(p);
        api.post("/location/ping", p).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Save vault to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("sos_vault", JSON.stringify(vault));
  }, [vault]);

const startRecording = async () => {
    setRecordingError("");
    backChunksRef.current = [];
    frontChunksRef.current = [];
    try {
      // Get microphone audio once and share across both recorders
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = audioStream.getAudioTracks()[0];

      // Back camera + shared audio
      const backVideo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const backStream = new MediaStream([...backVideo.getVideoTracks(), audioTrack]);
      backStreamRef.current = backStream;
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/webm";
      const backRecorder = new MediaRecorder(backStream, { mimeType });
      backRecorderRef.current = backRecorder;
      backRecorder.ondataavailable = (e) => { if (e.data?.size > 0) backChunksRef.current.push(e.data); };
      backRecorder.start(500);

      // Front camera + shared audio
      try {
        const frontVideo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        const frontStream = new MediaStream([...frontVideo.getVideoTracks(), audioTrack]);
        frontStreamRef.current = frontStream;
        const frontRecorder = new MediaRecorder(frontStream, { mimeType });
        frontRecorderRef.current = frontRecorder;
        frontRecorder.ondataavailable = (e) => { if (e.data?.size > 0) frontChunksRef.current.push(e.data); };
        frontRecorder.start(500);
      } catch { /* front cam unavailable */ }

      setRecording(true);
    } catch (err) {
      setRecordingError(`Camera/mic error: ${err.message}`);
    }
  };

  const stopRecording = (onStopped) => {
    let stopped = 0;
    const total = (backRecorderRef.current ? 1 : 0) + (frontRecorderRef.current ? 1 : 0);
    if (total === 0) { onStopped?.(); return; }
    const checkDone = () => { stopped++; if (stopped >= total) onStopped?.(); };
    if (backRecorderRef.current) {
      backRecorderRef.current.onstop = () => { setRecordedBack([...backChunksRef.current]); checkDone(); };
      backRecorderRef.current.stop();
    }
    if (frontRecorderRef.current) {
      frontRecorderRef.current.onstop = () => { setRecordedFront([...frontChunksRef.current]); checkDone(); };
      frontRecorderRef.current.stop();
    }
    backStreamRef.current?.getTracks().forEach((t) => t.stop());
    frontStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (backVideoRef.current) backVideoRef.current.srcObject = null;
    if (frontVideoRef.current) frontVideoRef.current.srcObject = null;
    setRecording(false);
  };

  const saveToVault = (currentLoc, backChunks, frontChunks) => {
    const timestamp = new Date().toISOString();
    const mapsLink = currentLoc ? `https://maps.google.com/?q=${currentLoc.lat},${currentLoc.lng}` : null;
    const backUrl = backChunks.length ? URL.createObjectURL(new Blob(backChunks, { type: "video/webm" })) : null;
    const frontUrl = frontChunks.length ? URL.createObjectURL(new Blob(frontChunks, { type: "video/webm" })) : null;
    const entry = { id: Date.now(), timestamp, location: currentLoc, mapsLink, backVideoUrl: backUrl, frontVideoUrl: frontUrl, user: user?.name };
    setVault((prev) => { const updated = [entry, ...prev]; localStorage.setItem("sos_vault", JSON.stringify(updated.map(e => ({ ...e, backVideoUrl: null, frontVideoUrl: null })))); return updated; });
    return entry;
  };

  const fireSOS = async () => {
    startRecording();
    setSosActive(true);

    const position = await new Promise((resolve) =>
      navigator.geolocation
        ? navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 5000 })
        : resolve(null)
    );

    const currentLoc = position
      ? { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }
      : loc;

    setSosLoc(currentLoc);
    sosEventRef.current = { currentLoc };

    const mapsLink = currentLoc
      ? `https://maps.google.com/?q=${currentLoc.lat},${currentLoc.lng}`
      : "Location unavailable";

    const message = `🚨 SOS ALERT from ${user?.name}! I need help. My live location: ${mapsLink}`;

    // SMS to all contacts with location
    contacts.forEach((c, i) => {
      setTimeout(() => {
        window.open(`sms:${c.phone}?body=${encodeURIComponent(message)}`, "_blank");
      }, i * 300);
    });

    // SMS + call to police (112)
    setTimeout(() => {
      window.open(`sms:112?body=${encodeURIComponent(message)}`, "_blank");
    }, contacts.length * 300);

    setTimeout(() => {
      window.open(`tel:112`, "_blank");
    }, contacts.length * 300 + 500);

    // Call first emergency contact
    if (contacts.length > 0) {
      setTimeout(() => { window.location.href = `tel:${contacts[0].phone}`; }, contacts.length * 300 + 1000);
    }

    // Auto-stop recording after 60s and save to vault
    setTimeout(() => {
      if (backRecorderRef.current?.state === "recording" || frontRecorderRef.current?.state === "recording") {
        stopRecording((/* after stop */) => {
          if (sosEventRef.current) {
            saveToVault(sosEventRef.current.currentLoc, backChunksRef.current, frontChunksRef.current);
            sosEventRef.current = null;
            showToast("✅ Recording saved to vault automatically");
          }
        });
      }
    }, 60000);

    try {
      const payload = { threat_level: threatLevel, ...(currentLoc ? { lat: currentLoc.lat, lng: currentLoc.lng } : {}) };
      await api.post("/sos/trigger", payload);
      load();
    } catch { /* silent */ }
  };

  const dismissSOS = () => {
    if (stopAlarmRef.current) stopAlarmRef.current();
    // Stop recording and auto-save to vault
    stopRecording(() => {
      if (sosEventRef.current) {
        saveToVault(sosEventRef.current.currentLoc, backChunksRef.current, frontChunksRef.current);
        sosEventRef.current = null;
        showToast("✅ Recording saved to vault");
      }
    });
    setSosActive(false);
    setSosLoc(null);
    setRecordedBack([]);
    setRecordedFront([]);
    setRecordingError("");
  };

  const downloadVaultVideo = (url, label) => {
    const a = document.createElement("a");
    a.href = url; a.download = `vault-${label}-${Date.now()}.webm`; a.click();
  };

  const addContact = async (e) => {
    e.preventDefault();
    if (!newContact.name || !newContact.phone) return;
    await api.post("/contacts", newContact);
    setNewContact({ name: "", phone: "", relation: "" });
    load();
  };
  const delContact = async (id) => { await api.delete(`/contacts/${id}`); load(); };

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="user-dashboard">
      <Navbar />
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 right-6 z-50 bg-zinc-950 text-white px-5 py-3 text-sm shadow-2xl border-l-4 border-rose-600"
        >{toast}</motion.div>
      )}

      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-rose-600 mb-1">Protection Grid</div>
            <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tighter">Welcome, {user?.name}</h1>
            <p className="text-zinc-500 mt-1">Your safety dashboard is active.</p>
          </div>
          <div className="flex gap-2 items-center text-xs uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Online
          </div>
        </div>

        {/* SOS Active Banner */}
        {sosActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-rose-600 text-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-l-4 border-rose-900"
          >
            <div>
              <div className="font-bold uppercase tracking-widest text-sm">🚨 SOS Active — Location Shared</div>
              {sosLoc ? (
                <a href={`https://maps.google.com/?q=${sosLoc.lat},${sosLoc.lng}`} target="_blank" rel="noreferrer" className="text-xs text-rose-100 underline mt-1 block">
                  📍 {sosLoc.lat.toFixed(5)}, {sosLoc.lng.toFixed(5)} — Open in Google Maps
                </a>
              ) : (
                <div className="text-xs text-rose-100 mt-1">Acquiring location…</div>
              )}
              <div className="text-xs text-rose-100 mt-1">SMS sent to {contacts.length} contact{contacts.length !== 1 ? "s" : ""} · Calling Police (112)</div>
              {recordingError && <div className="text-xs text-rose-200 mt-1">{recordingError}</div>}
            </div>
            <div className="flex flex-col gap-2 items-end">
              {recording ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" /> REC
                  </span>
                  <button onClick={stopRecording} className="flex items-center gap-1 text-xs uppercase tracking-widest font-bold bg-white text-rose-600 px-3 py-2 hover:bg-rose-50">
                    <StopCircle size={12} /> Stop
                  </button>
                </div>
              ) : null}
              <button onClick={dismissSOS} className="text-xs uppercase tracking-widest font-bold bg-rose-900 text-white px-4 py-2 hover:bg-rose-800">
                Dismiss
              </button>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* SOS */}
          <div className="lg:col-span-2 bg-white border border-zinc-200 p-10 flex flex-col items-center justify-center" data-testid="sos-panel">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500 mb-6">Emergency Trigger</div>
            <SOSButton onTrigger={fireSOS} onStopAlarm={stopAlarmRef} />
            <div className="mt-6 flex gap-2">
              {["low", "medium", "high"].map((l) => (
                <button key={l} onClick={() => setThreatLevel(l)}
                  className={`text-[10px] uppercase tracking-widest font-bold px-3 py-2 border ${threatLevel === l ? "bg-zinc-950 text-white border-zinc-950" : "bg-white border-zinc-200"}`}
                  data-testid={`threat-level-${l}`}>{l} Threat</button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-4 text-center max-w-xs">
              Tap once — siren, WhatsApp + SMS location, call contact, record front &amp; back camera.
            </p>
            {recording && (
              <div className="mt-4 w-full space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-600 uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                  <Video size={12} /> <Mic size={12} /> Recording — Back &amp; Front Camera
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-zinc-500 mb-1">Back Camera</div>
                    <video ref={setBackVideoRef} autoPlay muted playsInline className="w-full border border-rose-200 rounded" />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 mb-1">Front Camera</div>
                    <video ref={setFrontVideoRef} autoPlay muted playsInline className="w-full border border-rose-200 rounded" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="bg-white border border-zinc-200 p-6" data-testid="location-panel">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
              <MapPin size={14} /> Live Location
            </div>
            {loc ? (
              <div className="text-sm">
                <div className="font-mono text-zinc-900">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</div>
                <div className="text-xs text-zinc-500">± {Math.round(loc.accuracy)} m</div>
                <a href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer"
                  className="text-xs text-rose-600 underline mt-1 block">Open in Google Maps</a>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Acquiring GPS…</p>
            )}
            <div className="mt-5 h-32 bg-gradient-to-br from-zinc-100 to-zinc-200 border border-zinc-200 flex items-center justify-center text-xs text-zinc-500">
              <Radio size={14} className="mr-2 text-rose-600" /> GPS signal {loc ? "locked" : "acquiring"}
            </div>
          </div>

          {/* Contacts */}
          <div className="bg-white border border-zinc-200 p-6" data-testid="contacts-panel">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
              Emergency Contacts
            </div>
            <form onSubmit={addContact} className="space-y-2 mb-4" data-testid="add-contact-form">
              <input placeholder="Name" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} className="bg-zinc-50 border border-zinc-200 p-2 w-full text-sm" />
              <input placeholder="Phone (with country code)" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} className="bg-zinc-50 border border-zinc-200 p-2 w-full text-sm" />
              <input placeholder="Relation (optional)" value={newContact.relation} onChange={(e) => setNewContact({ ...newContact, relation: e.target.value })} className="bg-zinc-50 border border-zinc-200 p-2 w-full text-sm" />
              <button className="w-full bg-zinc-950 text-white text-xs uppercase tracking-widest font-bold py-2 hover:bg-zinc-800 flex items-center justify-center gap-1">
                <Plus size={12} /> Add Contact
              </button>
            </form>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {contacts.length === 0 && <div className="text-xs text-zinc-500">No contacts added yet.</div>}
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between border border-zinc-100 bg-zinc-50 p-2">
                  <div className="text-sm">
                    <div className="font-bold">{c.name}</div>
                    <div className="text-xs text-zinc-500">{c.phone}{c.relation ? ` · ${c.relation}` : ""}</div>
                  </div>
                  <button onClick={() => delContact(c.id)} className="text-zinc-400 hover:text-rose-600"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Vault */}
          <div className="lg:col-span-4 bg-zinc-950 text-white border border-zinc-800 p-6" data-testid="vault-panel">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6">
              <Shield size={14} className="text-rose-500" /> Safety Vault — Secure Evidence Storage
            </div>
            {vault.length === 0 ? (
              <div className="text-sm text-zinc-500">No SOS events recorded yet. Vault is empty.</div>
            ) : (
              <div className="space-y-4">
                {vault.map((entry) => (
                  <div key={entry.id} className="border border-zinc-800 bg-zinc-900 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-xs font-bold uppercase tracking-widest text-rose-400">SOS Event</span>
                        </div>
                        <div className="text-xs text-zinc-400 flex items-center gap-1">
                          <Clock size={10} /> {new Date(entry.timestamp).toLocaleString()}
                        </div>
                        {entry.location && (
                          <div className="mt-2">
                            <a href={entry.mapsLink} target="_blank" rel="noreferrer"
                              className="text-xs text-emerald-400 underline flex items-center gap-1">
                              <MapPin size={10} /> {entry.location.lat.toFixed(5)}, {entry.location.lng.toFixed(5)} — Open in Maps
                            </a>
        
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {entry.backVideoUrl && (
                          <button onClick={() => downloadVaultVideo(entry.backVideoUrl, "back")}
                            className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-3 py-2 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700">
                            <Download size={10} /> Back Cam
                          </button>
                        )}
                        {entry.frontVideoUrl && (
                          <button onClick={() => downloadVaultVideo(entry.frontVideoUrl, "front")}
                            className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-3 py-2 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700">
                            <Download size={10} /> Front Cam
                          </button>
                        )}
                        <button onClick={() => setVault((v) => v.filter((e) => e.id !== entry.id))}
                          className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-3 py-2 bg-rose-900 text-rose-200 hover:bg-rose-800 border border-rose-800">
                          <Trash2 size={10} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alert History */}
          <div className="lg:col-span-4 bg-white border border-zinc-200 p-6" data-testid="alert-history-panel">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
              <Clock size={14} /> Alert History
            </div>
            {alerts.length === 0 ? (
              <div className="text-sm text-zinc-500">No alerts yet. Stay safe.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {alerts.map((a) => (
                  <div key={a.id} className="py-3 flex items-center justify-between gap-4" data-testid={`alert-row-${a.id}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusPill status={a.status} />
                        <ThreatPill level={a.threat_level} />
                        <span className="text-xs text-zinc-500">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-sm mt-1">{a.note || "No note provided."}</div>
                    </div>
                    <div className="text-xs text-zinc-500 font-mono">
                      {a.lat != null ? `${a.lat.toFixed(3)}, ${a.lng.toFixed(3)}` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
