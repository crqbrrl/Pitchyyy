import { Card } from "./types.ts";
import { Action, GameState } from "./engine.ts";

// L'URL de l'API peut être surchargée (tests locaux via le serveur miroir)
const API_URL =
  (import.meta.env.VITE_POKER_API_URL as string | undefined) ??
  "https://qfnekrdmwkpoedamwxaf.supabase.co/functions/v1/poker";

// Clef "anon" Supabase : publique par conception (elle n'ouvre que ce que les
// policies autorisent — ici, rien d'autre que l'appel de la fonction de jeu)
const ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbmVrcmRtd2twb2VkYW13eGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMTE4MzQsImV4cCI6MjA5OTg4NzgzNH0.wsnkVzbiawLTkgcuL_ppbhGUOCAkC2-hS1sOy7i_6E4";

export interface RoomState {
  code: string;
  version?: number; // croissante à chaque écriture — permet d'ignorer un sondage périmé
  phase: "lobby" | "playing" | "over";
  config: { chips: number; sb: number; bb: number };
  members: { id: number; name: string }[];
  game: GameState | null;
}

export class ApiCallError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface OnlineSession {
  code: string;
  playerId: number;
  token: string;
  name: string;
}

const SESSION_KEY = "poker_online_session";

export function loadSession(): OnlineSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as OnlineSession;
    if (!s.code || !s.token) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: OnlineSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data || data.ok !== true) {
    throw new ApiCallError((data?.error as string) ?? `Erreur réseau (${res.status})`, res.status);
  }
  return data;
}

export async function createRoom(
  name: string,
  chips: number,
  sb: number,
  bb: number,
): Promise<{ session: OnlineSession; state: RoomState }> {
  const r = await post({ op: "create", name, chips, sb, bb });
  const session: OnlineSession = {
    code: r.code as string,
    playerId: r.playerId as number,
    token: r.token as string,
    name,
  };
  saveSession(session);
  return { session, state: r.state as RoomState };
}

export async function joinRoom(code: string, name: string): Promise<{ session: OnlineSession; state: RoomState }> {
  const r = await post({ op: "join", code, name });
  const session: OnlineSession = {
    code: r.code as string,
    playerId: r.playerId as number,
    token: r.token as string,
    name,
  };
  saveSession(session);
  return { session, state: r.state as RoomState };
}

export async function fetchState(code: string): Promise<RoomState> {
  const r = await post({ op: "state", code });
  return r.state as RoomState;
}

export async function startGame(session: OnlineSession): Promise<RoomState> {
  const r = await post({ op: "start", code: session.code, token: session.token });
  return r.state as RoomState;
}

export async function sendAction(session: OnlineSession, action: Action): Promise<RoomState> {
  const r = await post({ op: "act", code: session.code, token: session.token, action });
  return r.state as RoomState;
}

export async function nextHand(session: OnlineSession): Promise<RoomState> {
  const r = await post({ op: "next_hand", code: session.code, token: session.token });
  return r.state as RoomState;
}

export async function fetchMyCards(session: OnlineSession): Promise<{ handNumber: number; hole: Card[] }> {
  const r = await post({ op: "my_cards", code: session.code, token: session.token });
  return { handNumber: r.handNumber as number, hole: r.hole as Card[] };
}
