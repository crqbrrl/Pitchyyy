import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Club, Crown, Eye, Minus, Plus, RotateCcw, Trophy, Users, X } from "lucide-react";
import { cn } from "../lib/utils";
import { Action, GameState, applyAction, createGame, startHand } from "./engine.ts";
import { evaluateBest } from "./handEval.ts";
import { ActionControls, Board, CardBack, PlayingCard, PlayersOverview, TableHeader } from "./ui.tsx";

type Screen = "setup" | "handoff" | "acting" | "results" | "gameover";

const STORAGE_KEY = "poker_local_save";

interface SaveData {
  game: GameState;
  screen: Screen;
}

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (!data.game || !Array.isArray(data.game.players)) return null;
    return data;
  } catch {
    return null;
  }
}

/* ---------- Écran de configuration ---------- */

function SetupScreen({
  onStart,
  save,
  onResume,
  onExit,
}: {
  onStart: (names: string[], chips: number, sb: number, bb: number) => void;
  save: SaveData | null;
  onResume: () => void;
  onExit: () => void;
}) {
  const [names, setNames] = useState(["Joueur 1", "Joueur 2", "Joueur 3", "Joueur 4"]);
  const [chips, setChips] = useState(1000);
  const [smallBlind, setSmallBlind] = useState(10);
  const [bigBlind, setBigBlind] = useState(20);

  const valid =
    names.length >= 2 &&
    names.every((n) => n.trim().length > 0) &&
    smallBlind > 0 &&
    bigBlind >= smallBlind &&
    chips >= bigBlind * 2;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto px-4 py-8 space-y-6">
      <button onClick={onExit} className="text-white/60 hover:text-white flex items-center gap-1.5 text-sm font-semibold">
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-display font-bold text-white">Un seul téléphone</h1>
        <p className="text-white/60">On se passe l&apos;appareil à chaque tour de parole.</p>
      </div>

      {save && (
        <button
          onClick={onResume}
          className="w-full py-4 bg-amber-400 text-emerald-950 rounded-2xl font-bold text-lg hover:bg-amber-300 transition-all shadow-lg active:scale-[0.98]"
        >
          Reprendre la partie en cours
        </button>
      )}

      <div className="space-y-4 bg-white/5 border border-white/10 rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4" /> Joueurs
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setNames((n) => n.slice(0, -1))}
              disabled={names.length <= 2}
              className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center disabled:opacity-30 hover:bg-white/20"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setNames((n) => [...n, `Joueur ${n.length + 1}`])}
              disabled={names.length >= 8}
              className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center disabled:opacity-30 hover:bg-white/20"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setNames((n) => n.map((v, j) => (j === i ? e.target.value : v)))}
                className="flex-1 px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 outline-none focus:border-amber-400/60"
                placeholder={`Joueur ${i + 1}`}
                maxLength={20}
              />
              {names.length > 2 && (
                <button
                  onClick={() => setNames((n) => n.filter((_, j) => j !== i))}
                  className="p-2 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <label className="space-y-1">
            <span className="text-xs text-white/60 font-semibold uppercase tracking-wider">Tapis</span>
            <input
              type="number"
              value={chips}
              min={1}
              onChange={(e) => setChips(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-400/60"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-white/60 font-semibold uppercase tracking-wider">Petite blinde</span>
            <input
              type="number"
              value={smallBlind}
              min={1}
              onChange={(e) => setSmallBlind(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-400/60"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-white/60 font-semibold uppercase tracking-wider">Grosse blinde</span>
            <input
              type="number"
              value={bigBlind}
              min={1}
              onChange={(e) => setBigBlind(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-400/60"
            />
          </label>
        </div>
      </div>

      <button
        onClick={() => onStart(names.map((n) => n.trim()), chips, smallBlind, bigBlind)}
        disabled={!valid}
        className={cn(
          "w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg",
          valid
            ? "bg-white text-emerald-950 hover:bg-zinc-100 active:scale-[0.98]"
            : "bg-white/10 text-white/30 cursor-not-allowed",
        )}
      >
        Lancer la partie
      </button>
    </motion.div>
  );
}

/* ---------- Écran de passage d'appareil ---------- */

function HandoffScreen({ game, onReveal }: { game: GameState; onReveal: () => void }) {
  const player = game.players[game.toAct!];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto px-4 py-8 space-y-6">
      <TableHeader game={game} />
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center space-y-5">
        <p className="text-white/60 uppercase tracking-widest text-xs font-bold">Passe l&apos;appareil à</p>
        <h2 className="text-4xl font-display font-bold text-white">{player.name}</h2>
        <div className="flex justify-center gap-1.5">
          <CardBack size="md" />
          <CardBack size="md" />
        </div>
        <button
          onClick={onReveal}
          className="w-full py-4 bg-amber-400 text-emerald-950 rounded-2xl font-bold text-lg hover:bg-amber-300 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
        >
          <Eye className="w-5 h-5" />
          Voir mes cartes
        </button>
      </div>
      <PlayersOverview game={game} />
    </motion.div>
  );
}

/* ---------- Écran d'action ---------- */

function ActingScreen({ game, onAction }: { game: GameState; onAction: (a: Action) => void }) {
  const player = game.players[game.toAct!];

  const handHint = useMemo(() => {
    if (game.board.length < 3) return null;
    return evaluateBest([...player.hole, ...game.board]).name;
  }, [game.board, player.hole]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto px-4 py-8 space-y-6">
      <TableHeader game={game} />

      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display font-bold text-white">{player.name}</h2>
            <p className="text-white/60 text-sm">
              Tapis : <span className="font-bold text-white">{player.chips}</span>
              {player.bet > 0 && (
                <>
                  {" "}
                  • Misé : <span className="font-bold text-amber-300">{player.bet}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-1.5">
            <PlayingCard card={player.hole[0]} size="lg" />
            <PlayingCard card={player.hole[1]} size="lg" />
          </div>
        </div>
        {handHint && (
          <p className="text-center text-sm text-emerald-200 bg-emerald-400/10 border border-emerald-400/20 rounded-xl py-2 px-3">
            Ta main actuelle : <span className="font-bold">{handHint}</span>
          </p>
        )}

        <ActionControls game={game} onAction={onAction} />
      </div>

      <PlayersOverview game={game} />
    </motion.div>
  );
}

/* ---------- Écran de résultats ---------- */

function ResultsScreen({ game, onNext }: { game: GameState; onNext: () => void }) {
  const results = game.results!;
  const nameOf = (id: number) => game.players[id].name;
  const stillIn = game.players.filter((p) => p.chips > 0).length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-3">
        <div className="text-white/60 text-xs uppercase tracking-widest">Fin de la main n°{game.handNumber}</div>
        <Board game={game} />
      </div>

      {results.revealed.length > 0 && (
        <div className="space-y-2">
          {results.revealed.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{nameOf(r.id)}</p>
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

      <div className="space-y-2">
        {results.pots.map((pot, i) => (
          <div key={i} className="bg-amber-400/10 border border-amber-400/30 rounded-2xl px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-amber-200 text-xs font-bold uppercase tracking-wider">{pot.label}</span>
              <span className="text-amber-300 font-bold">{pot.amount}</span>
            </div>
            {pot.winners.map((w) => (
              <p key={w.id} className="text-white font-semibold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-300" />
                {nameOf(w.id)} remporte {w.amount}
                {w.handName && <span className="text-white/50 font-normal text-sm">({w.handName})</span>}
              </p>
            ))}
          </div>
        ))}
      </div>

      {results.eliminated.length > 0 && (
        <div className="bg-red-500/10 border border-red-400/30 rounded-2xl px-4 py-3">
          {results.eliminated.map((id) => (
            <p key={id} className="text-red-300 font-semibold">
              {nameOf(id)} est éliminé !
            </p>
          ))}
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full py-4 bg-white text-emerald-950 rounded-2xl font-bold text-lg hover:bg-zinc-100 transition-all shadow-lg active:scale-[0.98]"
      >
        {stillIn < 2 ? "Voir le vainqueur" : "Main suivante"}
      </button>

      <PlayersOverview game={game} />
    </motion.div>
  );
}

/* ---------- Écran de fin de partie ---------- */

function GameOverScreen({ game, onNewGame }: { game: GameState; onNewGame: () => void }) {
  const winner = game.players.find((p) => p.chips > 0)!;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto px-4 py-20 text-center space-y-8">
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="w-24 h-24 mx-auto bg-amber-400 rounded-full flex items-center justify-center shadow-2xl"
      >
        <Crown className="w-12 h-12 text-emerald-950" />
      </motion.div>
      <div className="space-y-2">
        <h1 className="text-4xl font-display font-bold text-white">{winner.name} gagne !</h1>
        <p className="text-white/60 text-lg">
          Avec {winner.chips} jetons après {game.handNumber} main{game.handNumber > 1 ? "s" : ""}.
        </p>
      </div>
      <button
        onClick={onNewGame}
        className="w-full py-4 bg-white text-emerald-950 rounded-2xl font-bold text-lg hover:bg-zinc-100 transition-all shadow-lg active:scale-[0.98]"
      >
        Nouvelle partie
      </button>
    </motion.div>
  );
}

/* ---------- Mode local (pass & play) ---------- */

export default function PokerApp({ onExit }: { onExit: () => void }) {
  const [game, setGame] = useState<GameState | null>(null);
  const [screen, setScreen] = useState<Screen>("setup");
  const [save, setSave] = useState<SaveData | null>(() => loadSave());

  useEffect(() => {
    if (!game || screen === "setup") return;
    // on sauvegarde "handoff" plutôt que "acting" pour ne pas exposer
    // les cartes du joueur en cours après un rechargement
    const data: SaveData = { game, screen: screen === "acting" ? "handoff" : screen };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [game, screen]);

  const afterEngine = (next: GameState) => {
    setGame(next);
    setScreen(next.results ? "results" : "handoff");
  };

  const handleNextHand = () => {
    if (!game) return;
    const stillIn = game.players.filter((p) => p.chips > 0).length;
    if (stillIn < 2) {
      setScreen("gameover");
      return;
    }
    afterEngine(startHand(game));
  };

  const handleNewGame = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSave(null);
    setGame(null);
    setScreen("setup");
  };

  const confirmRestart = () => {
    if (window.confirm("Abandonner la partie en cours ?")) handleNewGame();
  };

  return (
    <>
      {screen !== "setup" && game && (
        <header className="sticky top-0 z-50 bg-emerald-950/80 backdrop-blur-md border-b border-white/10">
          <div className="max-w-md mx-auto px-4 h-12 flex items-center justify-between">
            <span className="font-display font-bold text-white flex items-center gap-2">
              <Club className="w-4 h-4" /> Poker entre potes
            </span>
            <button
              onClick={confirmRestart}
              className="text-white/50 hover:text-white transition-colors flex items-center gap-1.5 text-sm font-semibold"
            >
              <RotateCcw className="w-4 h-4" />
              Recommencer
            </button>
          </div>
        </header>
      )}

      <AnimatePresence mode="wait">
        {screen === "setup" && (
          <SetupScreen
            key="setup"
            onStart={(names, chips, sb, bb) => afterEngine(createGame(names, chips, sb, bb))}
            save={save}
            onResume={() => {
              if (!save) return;
              setGame(save.game);
              setScreen(save.screen === "acting" ? "handoff" : save.screen);
            }}
            onExit={onExit}
          />
        )}
        {screen === "handoff" && game && game.toAct !== null && (
          <HandoffScreen
            key={`handoff-${game.toAct}-${game.street}-${game.handNumber}`}
            game={game}
            onReveal={() => setScreen("acting")}
          />
        )}
        {screen === "acting" && game && game.toAct !== null && (
          <ActingScreen
            key={`acting-${game.toAct}-${game.street}-${game.currentBet}-${game.handNumber}`}
            game={game}
            onAction={(a) => afterEngine(applyAction(game, a))}
          />
        )}
        {screen === "results" && game && game.results && (
          <ResultsScreen key={`results-${game.handNumber}`} game={game} onNext={handleNextHand} />
        )}
        {screen === "gameover" && game && <GameOverScreen key="gameover" game={game} onNewGame={handleNewGame} />}
      </AnimatePresence>
    </>
  );
}
