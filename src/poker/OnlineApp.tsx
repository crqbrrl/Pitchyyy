import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Copy, Crown, Loader2, Trophy, Users, Wifi } from "lucide-react";
import { cn } from "../lib/utils";
import { Card as CardType } from "./types.ts";
import { Action } from "./engine.ts";
import { evaluateBest } from "./handEval.ts";
import {
  OnlineSession,
  RoomState,
  clearSession,
  createRoom,
  fetchMyCards,
  fetchState,
  joinRoom,
  loadSession,
  nextHand,
  saveSession,
  sendAction,
  startGame,
} from "./online.ts";
import { ActionControls, Board, CardBack, PlayingCard, PlayersOverview } from "./ui.tsx";

const POLL_MS = 2000;

type OnlineScreen = "menu" | "create" | "join" | "room";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-white/60 font-semibold uppercase tracking-wider">{children}</span>;
}

const inputCls =
  "w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 outline-none focus:border-amber-400/60";

export default function OnlineApp({ onExit }: { onExit: () => void }) {
  const [screen, setScreen] = useState<OnlineScreen>(() => (loadSession() ? "room" : "menu"));
  const [session, setSession] = useState<OnlineSession | null>(() => loadSession());
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sondage régulier de l'état de la salle (2 s) + rafraîchissement au retour d'onglet
  useEffect(() => {
    if (!session || screen !== "room") return;
    let stopped = false;
    const tick = async () => {
      try {
        const s = await fetchState(session.code);
        if (!stopped) setState(s);
      } catch (e) {
        if (!stopped && e instanceof Error && e.message.includes("introuvable")) {
          clearSession();
          setSession(null);
          setScreen("menu");
          setError("La salle n'existe plus");
        }
      }
    };
    tick();
    const iv = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session, screen]);

  const runOp = useCallback(async (op: () => Promise<RoomState>) => {
    setBusy(true);
    setError(null);
    try {
      setState(await op());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }, []);

  const leave = () => {
    clearSession();
    setSession(null);
    setState(null);
    setScreen("menu");
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (screen === "room") {
              if (!window.confirm("Quitter la table ? Tu pourras revenir avec le même lien tant que la partie existe.")) return;
              leave();
            } else if (screen === "menu") {
              onExit();
            } else {
              setScreen("menu");
            }
          }}
          className="text-white/60 hover:text-white flex items-center gap-1.5 text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          {screen === "room" ? "Quitter la table" : "Retour"}
        </button>
        <span className="text-white/40 text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5" /> En ligne
        </span>
      </div>

      {error && (
        <div className="bg-red-500/15 border border-red-400/30 text-red-200 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {screen === "menu" && (
        <MenuScreen
          hasSession={!!loadSession()}
          onResume={() => {
            setSession(loadSession());
            setScreen("room");
          }}
          onCreate={() => setScreen("create")}
          onJoin={() => setScreen("join")}
        />
      )}
      {screen === "create" && (
        <CreateScreen
          busy={busy}
          onSubmit={async (name, chips, sb, bb) => {
            setBusy(true);
            setError(null);
            try {
              const r = await createRoom(name, chips, sb, bb);
              setSession(r.session);
              setState(r.state);
              setScreen("room");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erreur inconnue");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {screen === "join" && (
        <JoinScreen
          busy={busy}
          onSubmit={async (code, name) => {
            setBusy(true);
            setError(null);
            try {
              const r = await joinRoom(code, name);
              setSession(r.session);
              setState(r.state);
              setScreen("room");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erreur inconnue");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {screen === "room" && session && (
        <RoomScreen session={session} state={state} busy={busy} runOp={runOp} onLeave={leave} />
      )}
    </div>
  );
}

function MenuScreen({
  hasSession,
  onResume,
  onCreate,
  onJoin,
}: {
  hasSession: boolean;
  onResume: () => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-6">
      <h1 className="text-3xl font-display font-bold text-white text-center mb-8">Chacun son téléphone</h1>
      {hasSession && (
        <button
          onClick={onResume}
          className="w-full py-4 bg-amber-400 text-emerald-950 rounded-2xl font-bold text-lg hover:bg-amber-300 transition-all shadow-lg active:scale-[0.98]"
        >
          Revenir à ma table
        </button>
      )}
      <button
        onClick={onCreate}
        className="w-full py-4 bg-white text-emerald-950 rounded-2xl font-bold text-lg hover:bg-zinc-100 transition-all shadow-lg active:scale-[0.98]"
      >
        Créer une table
      </button>
      <button
        onClick={onJoin}
        className="w-full py-4 bg-white/10 border border-white/15 text-white rounded-2xl font-bold text-lg hover:bg-white/20 transition-all active:scale-[0.98]"
      >
        Rejoindre avec un code
      </button>
      <p className="text-white/50 text-sm text-center pt-4">
        Crée une table, partage le code à 4 lettres, et chacun joue depuis son propre téléphone.
      </p>
    </motion.div>
  );
}

function CreateScreen({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (name: string, chips: number, sb: number, bb: number) => void;
}) {
  const [name, setName] = useState("");
  const [chips, setChips] = useState(1000);
  const [sb, setSb] = useState(10);
  const [bb, setBb] = useState(20);
  const valid = name.trim().length > 0 && sb > 0 && bb >= sb && chips >= bb * 2;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <h2 className="text-2xl font-display font-bold text-white">Créer une table</h2>
      <label className="block space-y-1">
        <FieldLabel>Ton pseudo</FieldLabel>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Cyriaque" maxLength={20} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1">
          <FieldLabel>Tapis</FieldLabel>
          <input type="number" value={chips} min={1} onChange={(e) => setChips(Number(e.target.value))} className={inputCls} />
        </label>
        <label className="space-y-1">
          <FieldLabel>Petite blinde</FieldLabel>
          <input type="number" value={sb} min={1} onChange={(e) => setSb(Number(e.target.value))} className={inputCls} />
        </label>
        <label className="space-y-1">
          <FieldLabel>Grosse blinde</FieldLabel>
          <input type="number" value={bb} min={1} onChange={(e) => setBb(Number(e.target.value))} className={inputCls} />
        </label>
      </div>
      <button
        onClick={() => onSubmit(name.trim(), chips, sb, bb)}
        disabled={!valid || busy}
        className={cn(
          "w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2",
          valid && !busy ? "bg-white text-emerald-950 hover:bg-zinc-100 active:scale-[0.98]" : "bg-white/10 text-white/30 cursor-not-allowed",
        )}
      >
        {busy && <Loader2 className="w-5 h-5 animate-spin" />}
        Créer la table
      </button>
    </motion.div>
  );
}

function JoinScreen({ busy, onSubmit }: { busy: boolean; onSubmit: (code: string, name: string) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const valid = code.trim().length >= 4 && name.trim().length > 0;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <h2 className="text-2xl font-display font-bold text-white">Rejoindre une table</h2>
      <label className="block space-y-1">
        <FieldLabel>Code de la table</FieldLabel>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className={cn(inputCls, "text-center text-2xl font-bold tracking-[0.4em] uppercase")}
          placeholder="ABCD"
          maxLength={4}
          autoCapitalize="characters"
        />
      </label>
      <label className="block space-y-1">
        <FieldLabel>Ton pseudo</FieldLabel>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Léo" maxLength={20} />
      </label>
      <button
        onClick={() => onSubmit(code.trim(), name.trim())}
        disabled={!valid || busy}
        className={cn(
          "w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2",
          valid && !busy ? "bg-white text-emerald-950 hover:bg-zinc-100 active:scale-[0.98]" : "bg-white/10 text-white/30 cursor-not-allowed",
        )}
      >
        {busy && <Loader2 className="w-5 h-5 animate-spin" />}
        Rejoindre
      </button>
    </motion.div>
  );
}

function RoomScreen({
  session,
  state,
  busy,
  runOp,
  onLeave,
}: {
  session: OnlineSession;
  state: RoomState | null;
  busy: boolean;
  runOp: (op: () => Promise<RoomState>) => Promise<void>;
  onLeave: () => void;
}) {
  const [myCards, setMyCards] = useState<{ handNumber: number; hole: CardType[] }>({ handNumber: 0, hole: [] });
  const fetchingCards = useRef(false);

  const game = state?.game ?? null;
  const isHost = session.playerId === 0;
  const myTurn = game !== null && game.toAct !== null && game.players[game.toAct].id === session.playerId;
  const me = game?.players[session.playerId] ?? null;

  // Récupère mes cartes à chaque nouvelle main
  useEffect(() => {
    if (!game || game.handNumber === 0 || myCards.handNumber === game.handNumber || fetchingCards.current) return;
    fetchingCards.current = true;
    fetchMyCards(session)
      .then((r) => setMyCards(r))
      .catch(() => {})
      .finally(() => {
        fetchingCards.current = false;
      });
  }, [game, game?.handNumber, myCards.handNumber, session]);

  if (!state) {
    return (
      <div className="text-center py-20 text-white/60">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        Connexion à la table…
      </div>
    );
  }

  if (state.phase === "lobby") {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center space-y-4">
          <p className="text-white/60 uppercase tracking-widest text-xs font-bold">Code de la table</p>
          <div className="text-5xl font-display font-bold text-white tracking-[0.3em] pl-[0.3em]">{state.code}</div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(`${state.code}`).catch(() => {});
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200"
          >
            <Copy className="w-4 h-4" /> Copier le code
          </button>
          <p className="text-white/50 text-sm">
            Tes potes vont sur cette même adresse, choisissent « Rejoindre avec un code » et entrent <b>{state.code}</b>.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4" /> Joueurs ({state.members.length}/8)
          </h3>
          {state.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white">
              <span className="font-semibold">
                {m.name}
                {m.id === session.playerId && <span className="text-white/50"> (toi)</span>}
              </span>
              {m.id === 0 && <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">hôte</span>}
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            onClick={() => runOp(() => startGame(session))}
            disabled={state.members.length < 2 || busy}
            className={cn(
              "w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg",
              state.members.length >= 2 && !busy
                ? "bg-white text-emerald-950 hover:bg-zinc-100 active:scale-[0.98]"
                : "bg-white/10 text-white/30 cursor-not-allowed",
            )}
          >
            {state.members.length < 2 ? "En attente de joueurs…" : "Lancer la partie"}
          </button>
        ) : (
          <p className="text-center text-white/60 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            En attente que {state.members[0]?.name} lance la partie…
          </p>
        )}
      </motion.div>
    );
  }

  if (state.phase === "over" || (game && game.players.filter((p) => p.chips > 0).length < 2 && game.results)) {
    const winner = game?.players.find((p) => p.chips > 0);
    if (state.phase === "over" && winner) {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-8 py-12">
          <div className="w-24 h-24 mx-auto bg-amber-400 rounded-full flex items-center justify-center shadow-2xl">
            <Crown className="w-12 h-12 text-emerald-950" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-display font-bold text-white">
              {winner.name} gagne !{winner.id === session.playerId && " 🎉"}
            </h1>
            <p className="text-white/60 text-lg">
              Avec {winner.chips} jetons après {game!.handNumber} main{game!.handNumber > 1 ? "s" : ""}.
            </p>
          </div>
          <button
            onClick={onLeave}
            className="w-full py-4 bg-white text-emerald-950 rounded-2xl font-bold text-lg hover:bg-zinc-100 transition-all shadow-lg active:scale-[0.98]"
          >
            Quitter la table
          </button>
        </motion.div>
      );
    }
  }

  if (!game) return null;

  const holeVisible = myCards.handNumber === game.handNumber ? myCards.hole : [];
  const handHint =
    holeVisible.length === 2 && game.board.length >= 3 && me && !me.folded
      ? evaluateBest([...holeVisible, ...game.board]).name
      : null;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3 text-white/60 text-xs uppercase tracking-widest">
          <span>Table {state.code}</span>
          <span>•</span>
          <span>Main n°{game.handNumber}</span>
          <span>•</span>
          <span>
            Blindes {game.smallBlind}/{game.bigBlind}
          </span>
        </div>
        <Board game={game} />
        <div className="inline-flex items-center gap-2 bg-black/30 text-amber-300 font-bold px-4 py-1.5 rounded-full">
          Pot : {game.players.reduce((a, p) => a + p.total, 0)}
        </div>
        {game.lastAction && <p className="text-white/70 text-sm italic">{game.lastAction}</p>}
      </div>

      {/* Résultats de la main */}
      {game.results ? (
        <div className="space-y-4">
          {game.results.revealed.length > 0 && (
            <div className="space-y-2">
              {game.results.revealed.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">
                      {game.players[r.id].name}
                      {r.id === session.playerId && <span className="text-white/50"> (toi)</span>}
                    </p>
                    <p className="text-white/60 text-sm">{r.handName}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <PlayingCard card={r.hole[0]} size="sm" />
                    <PlayingCard card={r.hole[1]} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {game.results.pots.map((pot, i) => (
            <div key={i} className="bg-amber-400/10 border border-amber-400/30 rounded-2xl px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-amber-200 text-xs font-bold uppercase tracking-wider">{pot.label}</span>
                <span className="text-amber-300 font-bold">{pot.amount}</span>
              </div>
              {pot.winners.map((w) => (
                <p key={w.id} className="text-white font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-300" />
                  {game.players[w.id].name} remporte {w.amount}
                  {w.handName && <span className="text-white/50 font-normal text-sm">({w.handName})</span>}
                </p>
              ))}
            </div>
          ))}
          {game.results.eliminated.length > 0 && (
            <div className="bg-red-500/10 border border-red-400/30 rounded-2xl px-4 py-3">
              {game.results.eliminated.map((id) => (
                <p key={id} className="text-red-300 font-semibold">
                  {game.players[id].name} est éliminé !
                </p>
              ))}
            </div>
          )}
          <button
            onClick={() => runOp(() => nextHand(session))}
            disabled={busy}
            className="w-full py-4 bg-white text-emerald-950 rounded-2xl font-bold text-lg hover:bg-zinc-100 transition-all shadow-lg active:scale-[0.98]"
          >
            {game.players.filter((p) => p.chips > 0).length < 2 ? "Voir le vainqueur" : "Main suivante"}
          </button>
        </div>
      ) : (
        /* Main en cours : mes cartes + actions */
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-display font-bold text-white">{session.name}</h2>
              {me && (
                <p className="text-white/60 text-sm">
                  Tapis : <span className="font-bold text-white">{me.chips}</span>
                  {me.bet > 0 && (
                    <>
                      {" "}
                      • Misé : <span className="font-bold text-amber-300">{me.bet}</span>
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="flex gap-1.5">
              {holeVisible.length === 2 && me && !me.folded ? (
                <>
                  <PlayingCard card={holeVisible[0]} size="lg" />
                  <PlayingCard card={holeVisible[1]} size="lg" />
                </>
              ) : me && !me.folded && !me.out ? (
                <>
                  <CardBack size="lg" />
                  <CardBack size="lg" />
                </>
              ) : null}
            </div>
          </div>
          {handHint && (
            <p className="text-center text-sm text-emerald-200 bg-emerald-400/10 border border-emerald-400/20 rounded-xl py-2 px-3">
              Ta main actuelle : <span className="font-bold">{handHint}</span>
            </p>
          )}
          {me?.folded ? (
            <p className="text-center text-white/50 text-sm py-2">Tu t&apos;es couché — la main continue sans toi.</p>
          ) : myTurn ? (
            <ActionControls
              key={`${game.handNumber}-${game.street}-${game.currentBet}-${game.toAct}`}
              game={game}
              disabled={busy}
              onAction={(a: Action) => runOp(() => sendAction(session, a))}
            />
          ) : (
            <p className="text-center text-white/60 text-sm py-2 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {game.toAct !== null ? `Au tour de ${game.players[game.toAct].name}…` : "…"}
            </p>
          )}
        </div>
      )}

      <PlayersOverview game={game} highlightId={session.playerId} />
    </div>
  );
}
