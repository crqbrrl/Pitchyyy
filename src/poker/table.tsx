import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Coins } from "lucide-react";
import { cn } from "../lib/utils";
import { Card as CardType } from "./types.ts";
import { GameState, potTotal } from "./engine.ts";
import { CardBack, EmptySlot, PlayingCard } from "./ui.tsx";

// Position d'un siège sur l'ellipse du tapis, en % du conteneur.
// index 0 = en bas (le joueur au premier plan), puis sens horaire visuel
// (le joueur suivant dans l'ordre du jeu est à gauche, comme autour d'une vraie table).
function seatPos(index: number, count: number, radiusFactor = 1) {
  const angle = Math.PI / 2 + (2 * Math.PI * index) / count;
  return {
    left: 50 + 41 * radiusFactor * Math.cos(angle),
    top: 50 + 41 * radiusFactor * Math.sin(angle),
  };
}

export function PokerTable({
  game,
  viewpointId = 0,
  myHole = [],
  hideAllHoles = false,
  className,
}: {
  game: GameState;
  /** joueur affiché en bas de la table */
  viewpointId?: number;
  /** cartes du joueur au premier plan, affichées face visible sur le tapis */
  myHole?: CardType[];
  /** mode pass & play : ne jamais montrer de faces hors abattage */
  hideAllHoles?: boolean;
  className?: string;
}) {
  // dimensions réelles du conteneur, pour animer la distribution depuis le centre
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 360, h: 320 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const n = game.players.length;
  // le joueur au premier plan est placé en bas, les autres suivent dans l'ordre
  const seats = game.players.map((p) => ({ p, seat: (p.id - viewpointId + n) % n }));

  const revealed = new Map(game.results?.revealed.map((r) => [r.id, r]) ?? []);
  const won = new Map<number, number>();
  if (game.results) {
    for (const pot of game.results.pots) {
      for (const w of pot.winners) won.set(w.id, (won.get(w.id) ?? 0) + w.amount);
    }
  }
  const pot = game.results ? game.results.pots.reduce((a, p) => a + p.amount, 0) : potTotal(game);

  return (
    <div ref={ref} className={cn("relative h-80 select-none", className)}>
      {/* le tapis : bord bois + feutre vert */}
      <div className="absolute inset-x-6 inset-y-4 rounded-[50%] bg-gradient-to-b from-amber-950 to-stone-950 shadow-[0_12px_30px_rgba(0,0,0,0.45)]" />
      <div className="absolute inset-x-8 inset-y-6 rounded-[50%] bg-[radial-gradient(ellipse_at_center,_#059669_0%,_#065f46_60%,_#064e3b_100%)] shadow-[inset_0_0_36px_rgba(0,0,0,0.45)] border border-emerald-300/20" />

      {/* centre : tableau + pot + dernière action */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
        <div className="flex gap-1" style={{ perspective: 400 }}>
          {game.board.map((c, i) => (
            <motion.div
              key={`${game.handNumber}-${i}`}
              initial={{ opacity: 0, y: -16, rotateY: 180 }}
              animate={{ opacity: 1, y: 0, rotateY: 0 }}
              transition={{ duration: 0.45, delay: i < 3 ? i * 0.12 : 0, ease: "easeOut" }}
            >
              <PlayingCard card={c} size="sm" />
            </motion.div>
          ))}
          {Array.from({ length: 5 - game.board.length }).map((_, i) => (
            <EmptySlot key={`e${i}`} size="sm" />
          ))}
        </div>
        {pot > 0 && (
          <div className="flex items-center gap-1.5 bg-black/40 text-amber-300 text-xs font-bold px-3 py-1 rounded-full">
            <Coins className="w-3 h-3" />
            Pot : {pot}
          </div>
        )}
        {game.lastAction && (
          <p className="text-white/70 text-[11px] italic text-center max-w-44 leading-tight">{game.lastAction}</p>
        )}
      </div>

      {/* mises en cours, posées entre les sièges et le centre */}
      {seats.map(({ p, seat }) => {
        if (p.bet <= 0) return null;
        const pos = seatPos(seat, n, 0.52);
        return (
          <motion.div
            key={`bet-${p.id}-${game.street}-${p.bet}`}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
            style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
          >
            <span className="flex items-center gap-1 bg-black/50 border border-amber-300/30 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-200 shadow" />
              {p.bet}
            </span>
          </motion.div>
        );
      })}

      {/* les sièges */}
      {seats.map(({ p, seat }) => {
        const pos = seatPos(seat, n);
        const isTurn = game.toAct !== null && game.players[game.toAct].id === p.id;
        const rev = revealed.get(p.id);
        const gain = won.get(p.id);
        // distribution : les cartes partent du centre de la table
        const dealDx = ((50 - pos.left) / 100) * dims.w;
        const dealDy = ((50 - pos.top) / 100) * dims.h;
        const showFace = rev ? rev.hole : !hideAllHoles && p.id === viewpointId && myHole.length === 2 ? myHole : null;
        const showCards = !p.out && !((p.folded || game.results) && !rev);

        return (
          <div
            key={p.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
            style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
          >
            <div className={cn("flex flex-col items-center gap-0.5 w-20", p.out && "opacity-40")}>
              <div className="flex gap-0.5 h-9 items-end">
                {showCards &&
                  [0, 1].map((i) => (
                    <motion.div
                      key={`${game.handNumber}-${p.id}-${i}`}
                      initial={{ x: dealDx, y: dealDy, opacity: 0, scale: 0.3 }}
                      animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, delay: seat * 0.08 + i * (n * 0.08), ease: "easeOut" }}
                    >
                      {showFace ? <PlayingCard card={showFace[i]} size="xs" /> : <CardBack size="xs" />}
                    </motion.div>
                  ))}
              </div>
              <div
                className={cn(
                  "relative px-2 py-1 rounded-lg border text-center min-w-16 max-w-20 transition-all",
                  isTurn
                    ? "bg-amber-400/20 border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.45)]"
                    : "bg-black/45 border-white/15",
                )}
              >
                <p className="text-[11px] font-bold text-white truncate leading-tight">{p.name}</p>
                <p className="text-[11px] text-amber-300 font-semibold tabular-nums leading-tight">{p.chips}</p>
                {p.id === game.dealer && (
                  <span className="absolute -right-2 -top-2 w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full bg-white text-emerald-900 text-[9px] font-bold flex items-center justify-center shadow">
                    D
                  </span>
                )}
              </div>
              {gain !== undefined ? (
                <motion.span
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[10px] font-bold text-amber-300 bg-amber-400/15 border border-amber-400/40 px-1.5 py-px rounded-full"
                >
                  +{gain}
                </motion.span>
              ) : rev ? (
                <span className="text-[9px] text-white/70 bg-black/40 px-1.5 py-px rounded-full max-w-24 truncate">
                  {rev.handName}
                </span>
              ) : p.out ? (
                <span className="text-[9px] uppercase tracking-wider text-white/50">éliminé</span>
              ) : p.folded ? (
                <span className="text-[9px] uppercase tracking-wider text-white/50">couché</span>
              ) : p.allIn ? (
                <span className="text-[9px] uppercase tracking-wider text-amber-300 font-bold">tapis</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
