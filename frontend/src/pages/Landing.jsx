import React, { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, MapPin, Video, WifiOff, Radar, Lock, CloudUpload, BadgeCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import LoginCard from "@/components/LoginCard";
import { api, formatApiError } from "@/lib/api";

const HERO_BG = "https://static.prod-images.emergentagent.com/jobs/79229011-d864-41d5-b69f-d48e7278b45a/images/aecd2c919ea0baa6c599adbf154b014cb4ddacbf86a6348f006769919e3ac986.png";
const TRUST_BG = "https://static.prod-images.emergentagent.com/jobs/79229011-d864-41d5-b69f-d48e7278b45a/images/a352efa580b7cd6ecff276fa8504c8140afcf141d810a3abd7c252ef1bc69a75.png";
const CITY_IMG = "https://images.pexels.com/photos/7524005/pexels-photo-7524005.jpeg";
const MAP_IMG = "https://images.pexels.com/photos/7856880/pexels-photo-7856880.jpeg";

const STATS = [
  { k: "10K+", v: "Active Users" },
  { k: "99.9%", v: "Response Rate" },
  { k: "24/7", v: "AI Monitoring" },
];

const STEPS = [
  { n: 1, t: "Create Account", d: "Sign up in seconds with your email. Set up emergency contacts and preferences." },
  { n: 2, t: "Enable Safety Monitoring", d: "Activate AI-powered threat detection and location tracking with one tap." },
  { n: 3, t: "Stay Protected", d: "Get real-time alerts and instant emergency response whenever you need it." },
];

const FEATURES = [
  { icon: ShieldAlert, t: "SOS Emergency", d: "Instant alert to authorities and emergency contacts with one tap. Help arrives faster when every second counts.", accent: true },
  { icon: MapPin, t: "Live Location Tracking", d: "Real-time GPS sharing during threats. Your trusted contacts always know where you are." },
  { icon: Radar, t: "AI Threat Detection", d: "Advanced AI classifies Low, Medium, and High threat levels. Smart protection that learns and adapts." },
  { icon: Video, t: "Auto Video & Audio Recording", d: "Automatically starts recording during SOS alerts. Crucial evidence stored securely in the cloud." },
  { icon: WifiOff, t: "Offline Alert System", d: "Sends last known location if phone is switched off. Protection that works even when offline." },
];

const TRUST = [
  { icon: Lock, t: "End-to-End Encryption", d: "Military-grade encryption protects all your data and communications." },
  { icon: Radar, t: "Real-Time Monitoring", d: "24/7 AI-powered surveillance ensures immediate threat detection." },
  { icon: CloudUpload, t: "Secure Cloud Storage", d: "Your recordings and data are stored safely in encrypted cloud servers." },
  { icon: BadgeCheck, t: "Verified Authorities", d: "Direct connection to verified emergency services and law enforcement." },
];

export default function Landing() {
  const [news, setNews] = useState({ email: "", status: null });
  const [contact, setContact] = useState({ name: "", email: "", message: "", status: null });

  const subscribe = async (e) => {
    e.preventDefault();
    try {
      await api.post("/newsletter/subscribe", { email: news.email });
      setNews({ email: "", status: "Subscribed. Stay safe." });
    } catch (er) {
      setNews((n) => ({ ...n, status: formatApiError(er.response?.data?.detail) || "Failed" }));
    }
  };
  const sendContact = async (e) => {
    e.preventDefault();
    try {
      await api.post("/contact", { name: contact.name, email: contact.email, message: contact.message });
      setContact({ name: "", email: "", message: "", status: "Message sent. We'll be in touch." });
    } catch (er) {
      setContact((c) => ({ ...c, status: formatApiError(er.response?.data?.detail) || "Failed" }));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900" data-testid="landing-page">
      <Navbar />

      {/* Hero + Login */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-[520px] h-[520px] bg-rose-100/60 blur-3xl rounded-full" />
          <div className="absolute top-60 -left-32 w-[380px] h-[380px] bg-zinc-200/70 blur-3xl rounded-full" />
        </div>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 lg:pt-24 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="lg:col-span-7"
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-rose-600 border border-rose-200 bg-rose-50 px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 pulse-ring" /> Alert Network Online
            </span>
            <h1 className="mt-6 font-display text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-zinc-950 leading-[0.95]">
              Your Safety. <br /> <span className="text-rose-600">Powered by AI.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-700">
              Real-time threat detection, SOS alerts, and live location tracking for complete protection. Stay safe with AI-powered monitoring that never sleeps.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#login" className="bg-rose-600 text-white font-bold uppercase tracking-widest text-sm px-8 py-4 hover:bg-rose-700 transition-colors" data-testid="hero-get-started-btn">Get Started</a>
              <a href="#how" className="bg-zinc-950 text-white font-bold uppercase tracking-widest text-sm px-8 py-4 hover:bg-zinc-800 transition-colors" data-testid="hero-learn-more-btn">Learn More</a>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
              {STATS.map((s, i) => (
                <div key={i} className="border-l-2 border-rose-600 pl-4">
                  <div className="font-display text-3xl md:text-4xl font-black tracking-tight">{s.k}</div>
                  <div className="text-xs uppercase tracking-widest text-zinc-500 mt-1">{s.v}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="lg:col-span-5 relative" id="login">
            <div className="absolute inset-0 -z-10 opacity-70">
              <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
            </div>
            <LoginCard />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6 md:px-12 lg:px-24 bg-white border-t border-zinc-200">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-rose-600 mb-3">Process</div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-950">How It Works</h2>
            <p className="mt-3 text-zinc-600">Get protected in three simple steps.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14">
            {STEPS.map((s) => (
              <div key={s.n} className="relative" data-testid={`step-${s.n}`}>
                <div className="absolute -top-6 -left-4 font-display text-[160px] leading-none font-black text-zinc-100 select-none pointer-events-none -z-10">
                  {s.n}
                </div>
                <div className="relative">
                  <div className="inline-flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
                    Step 0{s.n}
                  </div>
                  <h3 className="font-display text-2xl font-bold tracking-tight mb-2">{s.t}</h3>
                  <p className="text-zinc-600 leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 md:px-12 lg:px-24 bg-zinc-50 border-t border-zinc-200">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-rose-600 mb-3">Capabilities</div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-950">Powerful Features</h2>
            <p className="mt-3 text-zinc-600">Comprehensive protection powered by cutting-edge AI technology.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className={`p-8 border transition-all hover:-translate-y-1 hover:shadow-xl ${
                    f.accent
                      ? "bg-zinc-950 text-white border-zinc-950 md:col-span-2 lg:row-span-1"
                      : "bg-white border-zinc-200"
                  }`}
                  data-testid={`feature-card-${i}`}
                >
                  <Icon size={28} className={f.accent ? "text-rose-500" : "text-rose-600"} />
                  <h3 className="font-display mt-5 text-xl font-bold tracking-tight">{f.t}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${f.accent ? "text-zinc-300" : "text-zinc-600"}`}>{f.d}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Real-time protection */}
      <section className="py-24 px-6 md:px-12 lg:px-24 bg-white border-t border-zinc-200">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-rose-600 mb-3">In Action</div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-950">Real-Time Protection</h2>
            <p className="mt-4 text-zinc-600 leading-relaxed">
              See how HerNet monitors and protects you in real-time. Continuous signals, verified responders, and instant intervention when it matters.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-zinc-700">
              <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-rose-600" />Low-latency alert propagation (&lt; 2 sec)</li>
              <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-rose-600" />Chain-of-custody recordings</li>
              <li className="flex items-center gap-3"><span className="w-1.5 h-1.5 rounded-full bg-rose-600" />Direct dispatch to verified authorities</li>
            </ul>
          </div>
          <div className="lg:col-span-7 relative">
            <img src={CITY_IMG} alt="safe walk" className="w-full h-[460px] object-cover grayscale-[30%]" />
            <div className="absolute left-4 top-4 bg-white border border-zinc-200 p-4 shadow-xl max-w-[240px]">
              <div className="text-xs uppercase tracking-widest text-zinc-500">Live Tracking</div>
              <div className="mt-1 font-display text-lg font-bold">Emma K.</div>
              <div className="text-xs text-zinc-500">5 min ago</div>
              <div className="mt-3 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-2 py-1 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> SAFE
              </div>
            </div>
            <div className="absolute right-4 bottom-4 bg-zinc-950 text-white p-4 border border-zinc-800 w-[260px] shadow-2xl">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
                <ShieldAlert size={14} className="text-rose-500" /> HerNet Protected
              </div>
              <div className="mt-3 w-full h-24 bg-cover bg-center border border-zinc-800" style={{ backgroundImage: `url(${MAP_IMG})` }} />
              <div className="mt-3 grid grid-cols-3 gap-1 text-[10px] uppercase tracking-widest">
                <div className="bg-rose-600 text-center py-2 font-bold">SOS</div>
                <div className="bg-zinc-800 text-center py-2">Share</div>
                <div className="bg-zinc-800 text-center py-2">Record</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="relative py-24 px-6 md:px-12 lg:px-24 border-t border-zinc-800 text-white" style={{ backgroundImage: `url(${TRUST_BG})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 bg-zinc-950/85" />
        <div className="relative max-w-7xl mx-auto">
          <div className="mb-14 max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-rose-500 mb-3">Integrity</div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">Trust & Security</h2>
            <p className="mt-3 text-zinc-300">Your safety and privacy are our top priorities.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800">
            {TRUST.map((t, i) => {
              const Icon = t.icon;
              return (
                <div key={i} className="bg-zinc-950 p-8">
                  <Icon size={24} className="text-rose-500" />
                  <h3 className="font-display mt-4 text-lg font-bold tracking-tight">{t.t}</h3>
                  <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{t.d}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-12 flex flex-wrap gap-6 text-xs uppercase tracking-widest text-zinc-400">
            <div><span className="text-white font-bold mr-1">ISO 27001</span> Certified</div>
            <div><span className="text-white font-bold mr-1">GDPR</span> Compliant</div>
            <div><span className="text-white font-bold mr-1">256-bit</span> Encryption</div>
            <div><span className="text-white font-bold mr-1">99.9%</span> Uptime</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 md:px-12 lg:px-24 bg-rose-600 text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-rose-100 mb-2">Join 10,000+ Protected Users</div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">Start Protecting Yourself Today</h2>
            <p className="mt-3 text-rose-100 max-w-xl">Don't wait for an emergency. Get instant access to AI-powered safety monitoring and 24/7 protection.</p>
          </div>
          <a href="#login" className="bg-white text-rose-600 font-bold uppercase tracking-widest text-sm px-8 py-4 hover:bg-zinc-100 transition-colors" data-testid="cta-get-started-btn">Get Started Now</a>
        </div>
      </section>

      {/* Footer / Newsletter / Contact */}
      <footer className="bg-zinc-950 text-zinc-300 py-20 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center gap-2 font-display font-black text-2xl tracking-tight text-white">
              <ShieldAlert className="text-rose-500" /> HerNet
            </div>
            <p className="mt-4 text-sm text-zinc-400 leading-relaxed max-w-xs">AI-powered personal safety network. Built with dignity, designed for action.</p>
          </div>
          <div>
            <h4 className="font-display font-bold text-white text-lg">Stay Updated</h4>
            <p className="text-sm text-zinc-400 mt-1">Get safety tips and updates.</p>
            <form onSubmit={subscribe} className="mt-4 flex flex-col gap-2" data-testid="newsletter-form">
              <input
                type="email" required value={news.email} onChange={(e) => setNews({ ...news, email: e.target.value })}
                placeholder="Email Address"
                className="bg-zinc-900 border border-zinc-800 p-3 text-sm text-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500 outline-none"
                data-testid="newsletter-email-input"
              />
              <button className="bg-rose-600 text-white font-bold uppercase tracking-widest text-xs py-3 hover:bg-rose-700" data-testid="newsletter-submit-btn">
                Subscribe to Newsletter
              </button>
              {news.status && <div className="text-xs text-zinc-400" data-testid="newsletter-status">{news.status}</div>}
            </form>
          </div>
          <div>
            <h4 className="font-display font-bold text-white text-lg">Get in Touch</h4>
            <p className="text-sm text-zinc-400 mt-1">We're here to help.</p>
            <form onSubmit={sendContact} className="mt-4 space-y-2" data-testid="contact-form">
              <input required placeholder="Name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className="bg-zinc-900 border border-zinc-800 p-3 text-sm w-full text-white" data-testid="contact-name-input" />
              <input required type="email" placeholder="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className="bg-zinc-900 border border-zinc-800 p-3 text-sm w-full text-white" data-testid="contact-email-input" />
              <textarea required placeholder="Message" rows={3} value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} className="bg-zinc-900 border border-zinc-800 p-3 text-sm w-full text-white" data-testid="contact-message-input" />
              <button className="bg-white text-zinc-950 font-bold uppercase tracking-widest text-xs py-3 w-full hover:bg-zinc-200" data-testid="contact-submit-btn">Send Message</button>
              {contact.status && <div className="text-xs text-zinc-400" data-testid="contact-status">{contact.status}</div>}
            </form>
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-zinc-800 mt-12 pt-6 text-xs text-zinc-500 flex flex-wrap justify-between gap-3">
          <div>© {new Date().getFullYear()} HerNet · All rights reserved</div>
          <div>We respect your privacy. Unsubscribe anytime.</div>
        </div>
      </footer>
    </div>
  );
}
