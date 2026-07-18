import { Card } from "./types.ts";
import { newShuffledDeck } from "./deck.ts";
import { evaluateBest, compareScore, HandEval } from "./handEval.ts";

export interface PlayerState {
  id: number;
  name: string;
  chips: number;
  hole: Card[];
  folded: boolean;
  allIn: boolean;
  bet: number; // misé sur ce tour d'enchères
  total: number; // misé sur toute la main
  acted: boolean;
  out: boolean; // éliminé de la partie
}

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

export interface PotWinner {
  id: number;
  amount: number;
  handName?: string;
}

export interface PotResult {
  label: string;
  amount: number;
  winners: PotWinner[];
}

export interface HandResults {
  pots: PotResult[];
  revealed: { id: number; hole: Card[]; handName: string }[];
  eliminated: number[];
}

export interface GameState {
  players: PlayerState[];
  deck: Card[];
  board: Card[];
  street: Street;
  dealer: number;
  sbIndex: number;
  bbIndex: number;
  toAct: number | null;
  currentBet: number;
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  results: HandResults | null;
  lastAction: string | null;
}

export type Action =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; amount: number }; // amount = mise totale visée sur ce tour

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

function nextIndex(players: PlayerState[], from: number, pred: (p: PlayerState) => boolean): number {
  const n = players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (pred(players[i])) return i;
  }
  return -1;
}

const isAlive = (p: PlayerState) => !p.out;
const canAct = (p: PlayerState) => !p.out && !p.folded && !p.allIn;

function needsAction(s: GameState, p: PlayerState): boolean {
  return canAct(p) && (!p.acted || p.bet < s.currentBet);
}

export function potTotal(s: GameState): number {
  return s.players.reduce((sum, p) => sum + p.total, 0);
}

function pay(p: PlayerState, amount: number) {
  const paid = Math.min(amount, p.chips);
  p.chips -= paid;
  p.bet += paid;
  p.total += paid;
  if (p.chips === 0) p.allIn = true;
  return paid;
}

export function createGame(names: string[], startChips: number, smallBlind: number, bigBlind: number): GameState {
  const players: PlayerState[] = names.map((name, id) => ({
    id,
    name,
    chips: startChips,
    hole: [],
    folded: false,
    allIn: false,
    bet: 0,
    total: 0,
    acted: false,
    out: false,
  }));
  const state: GameState = {
    players,
    deck: [],
    board: [],
    street: "preflop",
    dealer: Math.floor(Math.random() * players.length),
    sbIndex: 0,
    bbIndex: 0,
    toAct: null,
    currentBet: 0,
    minRaise: bigBlind,
    smallBlind,
    bigBlind,
    handNumber: 0,
    results: null,
    lastAction: null,
  };
  return startHand(state);
}

export function startHand(prev: GameState): GameState {
  const s = clone(prev);
  s.results = null;
  s.board = [];
  s.lastAction = null;
  for (const p of s.players) {
    p.out = p.chips <= 0;
    p.hole = [];
    p.folded = p.out;
    p.allIn = false;
    p.bet = 0;
    p.total = 0;
    p.acted = false;
  }
  const aliveCount = s.players.filter(isAlive).length;
  if (aliveCount < 2) return s;

  s.handNumber++;
  if (!(s.handNumber === 1 && isAlive(s.players[s.dealer]))) {
    s.dealer = nextIndex(s.players, s.dealer, isAlive);
  }
  // En tête-à-tête, le donneur est la petite blinde
  s.sbIndex = aliveCount === 2 ? s.dealer : nextIndex(s.players, s.dealer, isAlive);
  s.bbIndex = nextIndex(s.players, s.sbIndex, isAlive);
  pay(s.players[s.sbIndex], s.smallBlind);
  pay(s.players[s.bbIndex], s.bigBlind);

  s.deck = newShuffledDeck();
  for (const p of s.players) {
    if (isAlive(p)) p.hole = [s.deck.pop()!, s.deck.pop()!];
  }

  s.street = "preflop";
  s.currentBet = s.bigBlind;
  s.minRaise = s.bigBlind;
  s.toAct = nextIndex(s.players, s.bbIndex, (p) => needsAction(s, p));
  if (s.toAct === -1) {
    // tout le monde est déjà à tapis avec les blindes
    s.toAct = null;
    runOut(s);
    return showdown(s);
  }
  return s;
}

export function applyAction(prev: GameState, action: Action): GameState {
  const s = clone(prev);
  if (s.toAct === null) return s;
  const p = s.players[s.toAct];

  switch (action.type) {
    case "fold":
      p.folded = true;
      p.acted = true;
      s.lastAction = `${p.name} se couche`;
      break;
    case "check":
      p.acted = true;
      s.lastAction = `${p.name} : parole`;
      break;
    case "call": {
      const paid = pay(p, s.currentBet - p.bet);
      p.acted = true;
      s.lastAction = p.allIn ? `${p.name} suit à tapis (${paid})` : `${p.name} suit (${paid})`;
      break;
    }
    case "raise": {
      const wasBet = s.currentBet;
      const target = Math.min(action.amount, p.bet + p.chips);
      pay(p, target - p.bet);
      if (target > s.currentBet) {
        const raiseSize = target - s.currentBet;
        // une relance incomplète (tapis) ne rouvre pas les enchères
        if (raiseSize >= s.minRaise) {
          s.minRaise = raiseSize;
          for (const q of s.players) if (q !== p) q.acted = false;
        }
        s.currentBet = target;
        s.lastAction =
          (p.allIn ? `${p.name} fait tapis à ${target}` : null) ??
          (wasBet === 0 ? `${p.name} mise ${target}` : `${p.name} relance à ${target}`);
      } else {
        s.lastAction = p.allIn ? `${p.name} fait tapis (${target})` : `${p.name} suit`;
      }
      p.acted = true;
      break;
    }
  }
  return advance(s);
}

function advance(s: GameState): GameState {
  const inHand = s.players.filter((q) => !q.folded && !q.out);

  // tout le monde s'est couché sauf un : il remporte le pot sans montrer
  if (inHand.length === 1) {
    const winner = inHand[0];
    const amount = potTotal(s);
    winner.chips += amount;
    for (const q of s.players) {
      q.bet = 0;
      q.total = 0;
    }
    s.street = "showdown";
    s.toAct = null;
    s.results = {
      pots: [{ label: "Pot", amount, winners: [{ id: winner.id, amount }] }],
      revealed: [],
      eliminated: eliminatedIds(s),
    };
    return s;
  }

  const next = nextIndex(s.players, s.toAct!, (q) => needsAction(s, q));
  if (next !== -1) {
    s.toAct = next;
    return s;
  }

  // tour d'enchères terminé
  for (const q of s.players) {
    q.bet = 0;
    q.acted = false;
  }
  s.currentBet = 0;
  s.minRaise = s.bigBlind;

  if (s.street === "river") {
    s.toAct = null;
    return showdown(s);
  }

  const stillCanBet = inHand.filter((q) => !q.allIn);
  if (stillCanBet.length < 2) {
    // tapis généralisé : on déroule le tableau jusqu'à la river
    s.toAct = null;
    runOut(s);
    return showdown(s);
  }

  dealNext(s);
  s.toAct = nextIndex(s.players, s.dealer, (q) => needsAction(s, q));
  return s;
}

function dealNext(s: GameState) {
  if (s.street === "preflop") {
    s.board.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!);
    s.street = "flop";
  } else if (s.street === "flop") {
    s.board.push(s.deck.pop()!);
    s.street = "turn";
  } else if (s.street === "turn") {
    s.board.push(s.deck.pop()!);
    s.street = "river";
  }
}

function runOut(s: GameState) {
  while (s.street !== "river" && s.street !== "showdown") dealNext(s);
}

function eliminatedIds(s: GameState): number[] {
  return s.players.filter((q) => !q.out && q.chips === 0).map((q) => q.id);
}

function showdown(s: GameState): GameState {
  s.street = "showdown";
  s.toAct = null;

  const contenders = s.players.filter((q) => !q.folded && !q.out);
  const evals = new Map<number, HandEval>();
  for (const q of contenders) {
    evals.set(q.id, evaluateBest([...q.hole, ...s.board]));
  }

  // découpage en pots (pots annexes en cas de tapis)
  const caps = [...new Set(contenders.map((q) => q.total))].sort((a, b) => a - b);
  const slices: { amount: number; eligible: PlayerState[] }[] = [];
  let prevCap = 0;
  for (const cap of caps) {
    const amount = s.players.reduce(
      (sum, q) => sum + Math.max(0, Math.min(q.total, cap) - Math.min(q.total, prevCap)),
      0,
    );
    if (amount > 0) {
      slices.push({ amount, eligible: contenders.filter((q) => q.total >= cap) });
    }
    prevCap = cap;
  }
  // sécurité : argent mort au-delà de la plus grosse mise d'un joueur en lice
  const extra = s.players.reduce((sum, q) => sum + Math.max(0, q.total - prevCap), 0);
  if (extra > 0 && slices.length > 0) slices[slices.length - 1].amount += extra;

  const pots: PotResult[] = [];
  slices.forEach((slice, i) => {
    let bestScore: number[] | null = null;
    for (const q of slice.eligible) {
      const score = evals.get(q.id)!.score;
      if (!bestScore || compareScore(score, bestScore) > 0) bestScore = score;
    }
    const winners = slice.eligible.filter((q) => compareScore(evals.get(q.id)!.score, bestScore!) === 0);
    // jetons impairs au premier joueur à gauche du donneur (le donneur en dernier)
    const n = s.players.length;
    const ordered = [...winners].sort(
      (a, b) => ((a.id - s.dealer - 1 + n) % n) - ((b.id - s.dealer - 1 + n) % n),
    );
    const share = Math.floor(slice.amount / winners.length);
    let remainder = slice.amount - share * winners.length;
    const potWinners: PotWinner[] = ordered.map((q) => {
      const amount = share + (remainder-- > 0 ? 1 : 0);
      q.chips += amount;
      return { id: q.id, amount, handName: evals.get(q.id)!.name };
    });
    const label = slices.length === 1 ? "Pot" : i === 0 ? "Pot principal" : `Pot annexe ${i}`;
    pots.push({ label, amount: slice.amount, winners: potWinners });
  });

  for (const q of s.players) {
    q.bet = 0;
    q.total = 0;
  }

  s.results = {
    pots,
    revealed: contenders.map((q) => ({ id: q.id, hole: q.hole, handName: evals.get(q.id)!.name })),
    eliminated: eliminatedIds(s),
  };
  return s;
}

export interface LegalActions {
  canCheck: boolean;
  callAmount: number; // 0 si rien à suivre
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number; // = tapis
  isOpeningBet: boolean;
}

export function legalActions(s: GameState): LegalActions | null {
  if (s.toAct === null) return null;
  const p = s.players[s.toAct];
  const callAmount = Math.min(s.currentBet - p.bet, p.chips);
  const maxRaiseTo = p.bet + p.chips;
  // un joueur qui a déjà parlé et ne fait face qu'à une relance incomplète
  // (tapis inférieur à la relance minimum) ne peut que suivre ou se coucher :
  // les enchères ne sont pas rouvertes (p.acted n'est remis à zéro que par
  // une relance complète)
  const facingIncompleteRaise = p.acted && p.bet < s.currentBet;
  return {
    canCheck: p.bet === s.currentBet,
    callAmount,
    canRaise: maxRaiseTo > s.currentBet && !facingIncompleteRaise,
    minRaiseTo: Math.min(s.currentBet + s.minRaise, maxRaiseTo),
    maxRaiseTo,
    isOpeningBet: s.currentBet === 0,
  };
}
