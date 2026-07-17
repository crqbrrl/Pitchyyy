export type Suit = "s" | "h" | "d" | "c";

export interface Card {
  rank: number; // 2..14 (14 = As)
  suit: Suit;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

export const SUIT_IS_RED: Record<Suit, boolean> = {
  s: false,
  h: true,
  d: true,
  c: false,
};

export function rankLabel(rank: number): string {
  if (rank === 14) return "A";
  if (rank === 13) return "R";
  if (rank === 12) return "D";
  if (rank === 11) return "V";
  return String(rank);
}

export function rankLabelLong(rank: number): string {
  if (rank === 14) return "As";
  if (rank === 13) return "Roi";
  if (rank === 12) return "Dame";
  if (rank === 11) return "Valet";
  return String(rank);
}
