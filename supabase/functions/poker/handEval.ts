import { Card, rankLabelLong } from "./types.ts";

export interface HandEval {
  score: number[]; // comparaison lexicographique, plus grand = meilleur
  name: string;
}

// a > b => positif ; a < b => négatif ; égalité => 0
export function compareScore(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  const current: T[] = [];
  const recurse = (start: number) => {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i <= arr.length - (k - current.length); i++) {
      current.push(arr[i]);
      recurse(i + 1);
      current.pop();
    }
  };
  recurse(0);
  return result;
}

function evaluate5(cards: Card[]): HandEval {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  const uniq = [...new Set(ranks)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    // roue : A-5-4-3-2
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[1] - uniq[4] === 3) straightHigh = 5;
  }

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // groupes triés par (taille desc, rang desc)
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isFlush && straightHigh) {
    return {
      score: [8, straightHigh],
      name: straightHigh === 14 ? "Quinte flush royale" : `Quinte flush hauteur ${rankLabelLong(straightHigh)}`,
    };
  }
  if (groups[0][1] === 4) {
    return {
      score: [7, groups[0][0], groups[1][0]],
      name: `Carré de ${rankLabelLong(groups[0][0])}`,
    };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return {
      score: [6, groups[0][0], groups[1][0]],
      name: `Full aux ${rankLabelLong(groups[0][0])} par les ${rankLabelLong(groups[1][0])}`,
    };
  }
  if (isFlush) {
    return { score: [5, ...ranks], name: `Couleur hauteur ${rankLabelLong(ranks[0])}` };
  }
  if (straightHigh) {
    return { score: [4, straightHigh], name: `Suite hauteur ${rankLabelLong(straightHigh)}` };
  }
  if (groups[0][1] === 3) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return {
      score: [3, groups[0][0], ...kickers],
      name: `Brelan de ${rankLabelLong(groups[0][0])}`,
    };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return {
      score: [2, groups[0][0], groups[1][0], groups[2][0]],
      name: `Double paire, ${rankLabelLong(groups[0][0])} et ${rankLabelLong(groups[1][0])}`,
    };
  }
  if (groups[0][1] === 2) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return {
      score: [1, groups[0][0], ...kickers],
      name: `Paire de ${rankLabelLong(groups[0][0])}`,
    };
  }
  return { score: [0, ...ranks], name: `Hauteur ${rankLabelLong(ranks[0])}` };
}

// Meilleure main de 5 cartes parmi 5, 6 ou 7 cartes
export function evaluateBest(cards: Card[]): HandEval {
  let best: HandEval | null = null;
  for (const combo of combinations(cards, 5)) {
    const ev = evaluate5(combo);
    if (!best || compareScore(ev.score, best.score) > 0) best = ev;
  }
  return best!;
}
