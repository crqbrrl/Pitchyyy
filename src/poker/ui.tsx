import { useMemo, useState } from "react";
import { Coins, Hand } from "lucide-react";
import { cn } from "../lib/utils";
import { Card as CardType, SUIT_SYMBOLS, SUIT_IS_RED, rankLabel } from "./types.ts";
import { Action, GameState, legalActions, potTotal } from "./engine.ts";

export type CardSize = "xs" | "sm" | "md" | "lg";

export function PlayingCard({ card, size = "md" }: { card: CardType; size?: CardSize }) {
  const sizes = {
    xs: "w-6 h-9 text-[10px] rounded",
    sm: "w-9 h-13 text-sm rounded-md",
    md: "w-12 h-17 text-lg rounded-lg",
    lg: "w-16 h-23 text-2xl rounded-xl",
  };
  return (
    <div
      className={cn(
        "bg-white shadow-md flex flex-col items-center justify-center font-bold border border-zinc-200 shrink-0",
        sizes[size],
        SUIT_IS_RED[card.suit] ? "text-red-600" : "text-zinc-900",
      )}
    >
      <span className="leading-none">{rankLabel(card.rank)}</span>
      <span className="leading-none">{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}

export function CardBack({ size = "md" }: { size?: CardSize }) {
  const sizes = {
    xs: "w-6 h-9 rounded",
    sm: "w-9 h-13 rounded-md",
    md: "w-12 h-17 rounded-lg",
    lg: "w-16 h-23 rounded-xl",
  };
  return (
    <div
      className={cn(
        "shrink-0 border border-emerald-950/40 shadow-md bg-emerald-700",
        "bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.12)_0_4px,transparent_4px_8px)]",
        sizes[size],
      )}
    />
  );
}

export function EmptySlot({ size = "md" }: { size?: CardSize }) {
  const sizes = {
    xs: "w-6 h-9 rounded",
    sm: "w-9 h-13 rounded-md",
    md: "w-12 h-17 rounded-lg",
    lg: "w-16 h-23 rounded-xl",
  };
  return <div className={cn("border-2 border-dashed border-white/15 shrink-0", sizes[size])} />;
}

export function Board({ game, cardSize = "md" }: { game: GameState; cardSize?: "sm" | "md" | "lg" }) {
  return (
    <div className="flex gap-1.5 justify-center">
      {game.board.map((c, i) => (
        <PlayingCard key={i} card={c} size={cardSize} />
      ))}
      {Array.from({ length: 5 - game.board.length }).map((_, i) => (
        <EmptySlot key={`e${i}`} size={cardSize} />
      ))}
    </div>
  );
}

export function PlayersOverview({
  game,
  revealHoles = false,
  highlightId,
}: {
  game: GameState;
  revealHoles?: boolean;
  highlightId?: number;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {game.players
        .filter((p) => !p.out || p.hole.length > 0 || game.handNumber > 0)
        .map((p) => {
          const isTurn = game.toAct !== null && game.players[game.toAct].id === p.id;
          return (
            <div
              key={p.id}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl border text-sm",
                p.out || p.folded
                  ? "bg-white/5 border-white/5 text-white/40"
                  : isTurn
                    ? "bg-amber-400/15 border-amber-400/50 text-white"
                    : "bg-white/10 border-white/10 text-white",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {p.id === game.dealer && (
                  <span className="w-5 h-5 rounded-full bg-white text-emerald-900 text-[10px] font-bold flex items-center justify-center shrink-0">
                    D
                  </span>
                )}
                <span className="font-semibold truncate">
                  {p.name}
                  {highlightId === p.id && <span className="text-white/50"> (toi)</span>}
                </span>
                {p.folded && !p.out && <span className="text-[10px] uppercase tracking-wider shrink-0">couché</span>}
                {p.out && <span className="text-[10px] uppercase tracking-wider shrink-0">éliminé</span>}
                {p.allIn && !p.folded && (
                  <span className="text-[10px] uppercase tracking-wider text-amber-300 shrink-0">tapis</span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {revealHoles && !p.folded && !p.out && p.hole.length === 2 && (
                  <span className="flex gap-0.5">
                    <PlayingCard card={p.hole[0]} size="sm" />
                    <PlayingCard card={p.hole[1]} size="sm" />
                  </span>
                )}
                {p.bet > 0 && <span className="text-amber-300 font-semibold">{p.bet}</span>}
                <span className="font-bold tabular-nums">{p.chips}</span>
              </div>
            </div>
          );
        })}
    </div>
  );
}

export function TableHeader({ game }: { game: GameState }) {
  return (
    <div className="text-center space-y-3">
      <div className="flex items-center justify-center gap-3 text-white/60 text-xs uppercase tracking-widest">
        <span>Main n°{game.handNumber}</span>
        <span>•</span>
        <span>
          Blindes {game.smallBlind}/{game.bigBlind}
        </span>
      </div>
      <Board game={game} />
      <div className="inline-flex items-center gap-2 bg-black/30 text-amber-300 font-bold px-4 py-1.5 rounded-full">
        <Coins className="w-4 h-4" />
        Pot : {potTotal(game)}
      </div>
      {game.lastAction && <p className="text-white/70 text-sm italic">{game.lastAction}</p>}
    </div>
  );
}

// Boutons d'action du joueur dont c'est le tour (partagé local / en ligne)
export function ActionControls({
  game,
  onAction,
  disabled = false,
}: {
  game: GameState;
  onAction: (a: Action) => void;
  disabled?: boolean;
}) {
  const legal = useMemo(() => legalActions(game), [game]);
  const player = game.toAct !== null ? game.players[game.toAct] : null;
  const [raiseTo, setRaiseTo] = useState(legal?.minRaiseTo ?? 0);
  if (!legal || !player) return null;

  const pot = potTotal(game);
  const clampRaise = (v: number) => Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, v));
  const value = clampRaise(raiseTo);
  const isAllInRaise = value === legal.maxRaiseTo;

  return (
    <div className={cn("space-y-4", disabled && "opacity-50 pointer-events-none")}>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onAction({ type: "fold" })}
          className="py-4 bg-red-500/15 border border-red-400/30 text-red-300 rounded-2xl font-bold hover:bg-red-500/25 transition-all active:scale-[0.98]"
        >
          Se coucher
        </button>
        {legal.canCheck ? (
          <button
            onClick={() => onAction({ type: "check" })}
            className="py-4 bg-white/10 border border-white/15 text-white rounded-2xl font-bold hover:bg-white/20 transition-all active:scale-[0.98]"
          >
            Parole
          </button>
        ) : (
          <button
            onClick={() => onAction({ type: "call" })}
            className="py-4 bg-white/10 border border-white/15 text-white rounded-2xl font-bold hover:bg-white/20 transition-all active:scale-[0.98]"
          >
            Suivre {legal.callAmount}
            {legal.callAmount >= player.chips && (
              <span className="block text-[10px] uppercase tracking-wider text-amber-300">tapis</span>
            )}
          </button>
        )}
      </div>

      {legal.canRaise && (
        <div className="space-y-3 pt-1 border-t border-white/10">
          <div className="flex items-center justify-between pt-3">
            <span className="text-white/60 text-sm font-semibold">
              {legal.isOpeningBet ? "Miser" : "Relancer à"}
            </span>
            <span className="text-white font-bold text-xl tabular-nums">{value}</span>
          </div>
          {legal.maxRaiseTo > legal.minRaiseTo && (
            <input
              type="range"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              step={1}
              value={value}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setRaiseTo(legal.minRaiseTo)}
              className="flex-1 py-2 bg-white/10 text-white/80 rounded-lg text-sm font-semibold hover:bg-white/20"
            >
              Min
            </button>
            <button
              onClick={() => setRaiseTo(clampRaise(game.currentBet + pot))}
              className="flex-1 py-2 bg-white/10 text-white/80 rounded-lg text-sm font-semibold hover:bg-white/20"
            >
              Pot
            </button>
            <button
              onClick={() => setRaiseTo(legal.maxRaiseTo)}
              className="flex-1 py-2 bg-white/10 text-white/80 rounded-lg text-sm font-semibold hover:bg-white/20"
            >
              Tapis
            </button>
          </div>
          <button
            onClick={() => onAction({ type: "raise", amount: value })}
            className="w-full py-4 bg-amber-400 text-emerald-950 rounded-2xl font-bold text-lg hover:bg-amber-300 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Hand className="w-5 h-5" />
            {isAllInRaise ? `Tapis (${value})` : legal.isOpeningBet ? `Miser ${value}` : `Relancer à ${value}`}
          </button>
        </div>
      )}
    </div>
  );
}
