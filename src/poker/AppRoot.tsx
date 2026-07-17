import { useState } from "react";
import { motion } from "motion/react";
import { Club, Smartphone, Wifi } from "lucide-react";
import PokerApp from "./PokerApp.tsx";
import OnlineApp from "./OnlineApp.tsx";
import { loadSession } from "./online.ts";

type Mode = "home" | "local" | "online";

export default function AppRoot() {
  // si une table en ligne est en cours, on y retourne directement
  const [mode, setMode] = useState<Mode>(() => (loadSession() ? "online" : "home"));

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 pb-10">
      {mode === "home" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto px-4 py-16 space-y-8">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 mx-auto bg-white rounded-2xl flex items-center justify-center shadow-lg">
              <Club className="w-8 h-8 text-emerald-800" />
            </div>
            <h1 className="text-4xl font-display font-bold text-white">Poker entre potes</h1>
            <p className="text-white/60">Texas Hold&apos;em No-Limit, sans inscription.</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setMode("online")}
              className="w-full p-6 bg-white text-emerald-950 rounded-3xl text-left hover:bg-zinc-100 transition-all shadow-lg active:scale-[0.98] flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-emerald-900 text-white rounded-2xl flex items-center justify-center shrink-0">
                <Wifi className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-lg">Chacun son téléphone</div>
                <div className="text-emerald-900/60 text-sm">Crée une table, partage le code, jouez à distance</div>
              </div>
            </button>

            <button
              onClick={() => setMode("local")}
              className="w-full p-6 bg-white/10 border border-white/15 text-white rounded-3xl text-left hover:bg-white/20 transition-all active:scale-[0.98] flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-lg">Un seul téléphone</div>
                <div className="text-white/50 text-sm">On se passe l&apos;appareil à chaque tour (pass &amp; play)</div>
              </div>
            </button>
          </div>
        </motion.div>
      )}
      {mode === "local" && <PokerApp onExit={() => setMode("home")} />}
      {mode === "online" && <OnlineApp onExit={() => setMode("home")} />}
    </div>
  );
}
