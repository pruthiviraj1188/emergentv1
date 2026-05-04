import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Plus, Trash2, Radio, Clock, Video, Mic, StopCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import SOSButton from "@/components/SOSButton";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

function ThreatPill({ level }) {
  const map = {
    low: "bg-emerald-50 text-emerald-700 border-emerald-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    high: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 border ${map[level]}`}>{level}</span>
  );
}

function StatusPill({ status }) {
  const map = {
    active: "bg-rose-600 text-white",
    resolved: "bg-emerald-600 text-white",
    dismissed: "bg-zinc-500 text-white",
  };
  return <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 ${map[status] || "bg-zinc-200"}`}>{status}</span>;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loc, setLoc] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [threatLevel, setThreatLevel] = useState("high");
  const [newContact, setNewContact] = useState({ name: "", phone: "", relation: "" });
  const [toast, setToast] = useState("");
  const [channels, setChannels] = useState({ sms_enabled: false, email_enabled: false });
  const [sosActive, setSosActive] = useState(false);
  const [sosLoc, setSosLoc] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordingError, setRecordingError] = useState("");
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);

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

  // geolocation
  useEffect(() => {
    if (!tracking) return;
    if (!navigator.geolocation) { setTracking(false); return; }
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
  }, [tracking]);

  const fireSOS = async () => {
    if (contacts.length === 0) {
      setToast("No emergency contacts added. Please add one first.");
      setTimeout(() => setToast(""), 4000);
      return;
    }

    // Get fresh location
    const position = await new Promise((resolve) =>
      navigator.geolocation
        ? navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 5000 })
        : resolve(null)
    );

    const currentLoc = position
      ? { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }
      : loc;

    setSosLoc(currentLoc);
    setSosActive(true);
    startRecording();

    const mapsLink = currentLoc
      ? `https://maps.google.com/?q=${currentLoc.lat},${currentLoc.lng}`
      : "Location unavailable";

    const message = `🚨 SOS ALERT from ${user?.name}! I need help. My location: ${mapsLink}`;

    // Share via Web Share API if available (mobile)
    if (navigator.share) {
      navigator.share({ title: "SOS Alert", text: message }).catch(() => {});
    }

    // Open SMS to all contacts with location
    contacts.forEach((c, i) => {
      setTimeout(() => {
        window.open(`sms:${c.phone}?body=${encodeURIComponent(message)}`, "_blank");
      }, i * 300);
    });

    // Also open SMS to police (112 / 100)
    setTimeout(() => {
      window.open(`sms:112?body=${encodeURIComponent(message)}`, "_blank");
    }, contacts.length * 300);

    // Call first contact after a short delay
    setTimeout(() => {
      window.location.href = `tel:${contacts[0].phone}`;
    }, (contacts.length + 1) * 300);

    try {
      const payload = { threat_level: threatLevel, ...(currentLoc ? { lat: currentLoc.lat, lng: currentLoc.lng } : {}) };
      await api.post("/sos/trigger", payload);
      load();
    } catch {
      // silent
    }
  };

  const startRecording = async () => {
    setRecordingError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => setRecordedChunks([...chunks]);
      recorder.start();
      setRecording(true);
    } catch {
      setRecordingError("Camera/mic permission denied.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setRecording(false);
  };

  const downloadRecording = () => {
    if (!recordedChunks.length) return;
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sos-recording-${Date.now()}.webm`; a.click();
    URL.revokeObjectURL(url);
  };

  const dismissSOS = () => {
    stopRecording();
    setSosActive(false);
    setSosLoc(null);
    setRecordedChunks([]);
    setRecordingError("");
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
          data-testid="sos-toast"
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
                <a
                  href={`https://maps.google.com/?q=${sosLoc.lat},${sosLoc.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-rose-100 underline mt-1 block"
                >
                  📍 {sosLoc.lat.toFixed(5)}, {sosLoc.lng.toFixed(5)} — Open in Google Maps
                </a>
              ) : (
                <div className="text-xs text-rose-100 mt-1">Location unavailable</div>
              )}
              <div className="text-xs text-rose-100 mt-1">SMS sent to {contacts.length} contact{contacts.length !== 1 ? "s" : ""} + Police (112)</div>
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
              ) : recordedChunks.length > 0 ? (
                <button onClick={downloadRecording} className="flex items-center gap-1 text-xs uppercase tracking-widest font-bold bg-white text-rose-600 px-3 py-2 hover:bg-rose-50">
                  <Video size={12} /> Download Recording
                </button>
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
            <SOSButton onTrigger={fireSOS} />
            <div className="mt-6 flex gap-2 text-[10px] uppercase tracking-widest font-bold" data-testid="channel-status">
              <span className={`inline-flex items-center gap-1 px-2 py-1 border ${channels.sms_enabled ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-zinc-50 border-zinc-200 text-zinc-500"}`} data-testid="sms-channel-status">
                <span className={`w-1.5 h-1.5 rounded-full ${channels.sms_enabled ? "bg-emerald-500" : "bg-zinc-400"}`} /> SMS {channels.sms_enabled ? "Live" : "Off"}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 border ${channels.email_enabled ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-zinc-50 border-zinc-200 text-zinc-500"}`} data-testid="email-channel-status">
                <span className={`w-1.5 h-1.5 rounded-full ${channels.email_enabled ? "bg-emerald-500" : "bg-zinc-400"}`} /> Email {channels.email_enabled ? "Live" : "Off"}
              </span>
            </div>
            <div className="mt-6 flex gap-2">
              {["low", "medium", "high"].map((l) => (
                <button
                  key={l}
                  onClick={() => setThreatLevel(l)}
                  className={`text-[10px] uppercase tracking-widest font-bold px-3 py-2 border ${
                    threatLevel === l ? "bg-zinc-950 text-white border-zinc-950" : "bg-white border-zinc-200"
                  }`}
                  data-testid={`threat-level-${l}`}
                >{l} Threat</button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-6 text-center max-w-xs">
              Double tap to trigger. Starts camera &amp; mic recording, shares live location, calls your first contact.
            </p>
            {recording && (
              <div className="mt-4 w-full">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-600 uppercase tracking-widest mb-2">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                  <Video size={12} /> <Mic size={12} /> Recording in progress
                </div>
                <video ref={videoRef} autoPlay muted playsInline className="w-full border border-rose-200 rounded" />
              </div>
            )}
          </div>

          {/* Location & Tracking */}
          <div className="bg-white border border-zinc-200 p-6" data-testid="location-panel">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                <MapPin size={14} /> Live Location
              </div>
              <button
                onClick={() => setTracking((t) => !t)}
                className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 border ${
                  tracking ? "bg-rose-600 text-white border-rose-600" : "bg-white border-zinc-300"
                }`}
                data-testid="tracking-toggle"
              >{tracking ? "Tracking" : "Off"}</button>
            </div>
            {loc ? (
              <div className="text-sm">
                <div className="font-mono text-zinc-900">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</div>
                <div className="text-xs text-zinc-500">± {Math.round(loc.accuracy)} m</div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">{tracking ? "Acquiring GPS…" : "Enable to share your location during an SOS."}</p>
            )}
            <div className="mt-5 h-32 bg-gradient-to-br from-zinc-100 to-zinc-200 border border-zinc-200 flex items-center justify-center text-xs text-zinc-500">
              <Radio size={14} className="mr-2 text-rose-600" /> GPS signal {tracking ? "locked" : "standby"}
            </div>
          </div>

          {/* Contacts */}
          <div className="bg-white border border-zinc-200 p-6" data-testid="contacts-panel">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
              Emergency Contacts
            </div>
            <form onSubmit={addContact} className="space-y-2 mb-4" data-testid="add-contact-form">
              <input placeholder="Name" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} className="bg-zinc-50 border border-zinc-200 p-2 w-full text-sm" data-testid="contact-name-field" />
              <input placeholder="Phone" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} className="bg-zinc-50 border border-zinc-200 p-2 w-full text-sm" data-testid="contact-phone-field" />
              <input placeholder="Relation (optional)" value={newContact.relation} onChange={(e) => setNewContact({ ...newContact, relation: e.target.value })} className="bg-zinc-50 border border-zinc-200 p-2 w-full text-sm" data-testid="contact-relation-field" />
              <button className="w-full bg-zinc-950 text-white text-xs uppercase tracking-widest font-bold py-2 hover:bg-zinc-800 flex items-center justify-center gap-1" data-testid="add-contact-btn">
                <Plus size={12} /> Add Contact
              </button>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto" data-testid="contacts-list">
              {contacts.length === 0 && <div className="text-xs text-zinc-500">No contacts added yet.</div>}
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between border border-zinc-100 bg-zinc-50 p-2" data-testid={`contact-item-${c.id}`}>
                  <div className="text-sm">
                    <div className="font-bold">{c.name}</div>
                    <div className="text-xs text-zinc-500">{c.phone}{c.relation ? ` · ${c.relation}` : ""}</div>
                  </div>
                  <button onClick={() => delContact(c.id)} className="text-zinc-400 hover:text-rose-600" data-testid={`delete-contact-${c.id}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
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
