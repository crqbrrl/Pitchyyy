// API de jeu — toute la logique tourne côté serveur : les clients ne reçoivent
// jamais le paquet ni les cartes privées des autres joueurs.
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  Action,
  GameState,
  applyAction,
  createGame,
  legalActions,
  startHand,
} from "./engine.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface Member {
  id: number;
  name: string;
  token: string;
}

interface Secret {
  phase: "lobby" | "playing" | "over";
  hostToken: string;
  config: { chips: number; sb: number; bb: number };
  members: Member[];
  game: GameState | null;
}

interface RoomRow {
  id: string;
  code: string;
  version: number;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// État visible par tous : sans le paquet ni les cartes privées.
// (les mains révélées au showdown restent dans game.results.revealed)
function publicState(code: string, secret: Secret) {
  let game: GameState | null = null;
  if (secret.game) {
    game = JSON.parse(JSON.stringify(secret.game)) as GameState;
    game.deck = [];
    for (const p of game.players) {
      p.hole = [];
    }
  }
  return {
    code,
    phase: secret.phase,
    config: secret.config,
    members: secret.members.map((m) => ({ id: m.id, name: m.name })),
    game,
  };
}

async function loadRoom(code: unknown): Promise<{ room: RoomRow; secret: Secret }> {
  if (typeof code !== "string" || !code.trim()) throw new ApiError("Code de salle manquant");
  const normalized = code.trim().toUpperCase();
  const { data: room } = await supabase
    .from("rooms")
    .select("id, code, version")
    .eq("code", normalized)
    .maybeSingle();
  if (!room) throw new ApiError("Salle introuvable — vérifie le code", 404);
  const { data: sec } = await supabase
    .from("room_secrets")
    .select("secret")
    .eq("room_id", room.id)
    .maybeSingle();
  if (!sec) throw new ApiError("Salle corrompue", 500);
  return { room: room as RoomRow, secret: sec.secret as Secret };
}

async function saveRoom(room: RoomRow, secret: Secret) {
  const state = publicState(room.code, secret);
  // verrou optimiste : si quelqu'un a écrit entre-temps, on rejette et le client réessaie
  const { data, error } = await supabase
    .from("rooms")
    .update({ state, version: room.version + 1, updated_at: new Date().toISOString() })
    .eq("id", room.id)
    .eq("version", room.version)
    .select("id");
  if (error) throw new ApiError(error.message, 500);
  if (!data || data.length === 0) throw new ApiError("Deux actions simultanées — réessaie", 409);
  const { error: secErr } = await supabase
    .from("room_secrets")
    .update({ secret })
    .eq("room_id", room.id);
  if (secErr) throw new ApiError(secErr.message, 500);
  return state;
}

function findMember(secret: Secret, token: unknown): Member {
  if (typeof token !== "string") throw new ApiError("Token manquant", 401);
  const member = secret.members.find((m) => m.token === token);
  if (!member) throw new ApiError("Tu ne fais pas partie de cette salle", 403);
  return member;
}

function cleanName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) throw new ApiError("Pseudo manquant");
  return name.trim().slice(0, 20);
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback;
  return Math.max(min, Math.min(max, n));
}

async function handleCreate(body: Record<string, unknown>) {
  const name = cleanName(body.name);
  const chips = clampInt(body.chips, 20, 1_000_000, 1000);
  const sb = clampInt(body.sb, 1, Math.floor(chips / 2), 10);
  const bb = clampInt(body.bb, sb, Math.floor(chips / 2), Math.min(sb * 2, Math.floor(chips / 2)));
  const token = crypto.randomUUID();
  const secret: Secret = {
    phase: "lobby",
    hostToken: token,
    config: { chips, sb, bb },
    members: [{ id: 0, name, token }],
  game: null,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const { data: inserted, error } = await supabase
      .from("rooms")
      .insert({ code, state: publicState(code, secret) })
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") continue; // collision de code, on retente
      throw new ApiError(error.message, 500);
    }
    const { error: secErr } = await supabase
      .from("room_secrets")
      .insert({ room_id: inserted!.id, secret });
    if (secErr) throw new ApiError(secErr.message, 500);
    return { code, playerId: 0, token, state: publicState(code, secret) };
  }
  throw new ApiError("Impossible de générer un code de salle", 500);
}

async function handleJoin(body: Record<string, unknown>) {
  const { room, secret } = await loadRoom(body.code);
  if (secret.phase !== "lobby") throw new ApiError("La partie a déjà commencé", 403);
  if (secret.members.length >= 8) throw new ApiError("Salle pleine (8 joueurs max)", 403);
  let name = cleanName(body.name);
  while (secret.members.some((m) => m.name === name)) name = `${name.slice(0, 17)} 2`;
  const token = crypto.randomUUID();
  const member: Member = { id: secret.members.length, name, token };
  secret.members.push(member);
  const state = await saveRoom(room, secret);
  return { code: room.code, playerId: member.id, token, state };
}

async function handleStart(body: Record<string, unknown>) {
  const { room, secret } = await loadRoom(body.code);
  const member = findMember(secret, body.token);
  if (secret.hostToken !== member.token) throw new ApiError("Seul l'hôte peut lancer la partie", 403);
  if (secret.phase !== "lobby") throw new ApiError("La partie a déjà commencé", 403);
  if (secret.members.length < 2) throw new ApiError("Il faut au moins 2 joueurs", 400);
  secret.game = createGame(
    secret.members.map((m) => m.name),
    secret.config.chips,
    secret.config.sb,
    secret.config.bb,
  );
  secret.phase = "playing";
  const state = await saveRoom(room, secret);
  return { state };
}

async function handleAct(body: Record<string, unknown>) {
  const { room, secret } = await loadRoom(body.code);
  const member = findMember(secret, body.token);
  if (secret.phase !== "playing" || !secret.game) throw new ApiError("La partie n'est pas en cours", 400);
  const game = secret.game;
  if (game.results) throw new ApiError("La main est terminée", 400);
  if (game.toAct === null || game.players[game.toAct].id !== member.id) {
    throw new ApiError("Ce n'est pas ton tour", 403);
  }

  const legal = legalActions(game)!;
  const raw = body.action as Record<string, unknown> | undefined;
  let action: Action;
  switch (raw?.type) {
    case "fold":
      action = { type: "fold" };
      break;
    case "check":
      if (!legal.canCheck) throw new ApiError("Tu ne peux pas checker, il y a une mise", 400);
      action = { type: "check" };
      break;
    case "call":
      action = { type: "call" };
      break;
    case "raise": {
      if (!legal.canRaise) throw new ApiError("Relance impossible", 400);
      const amount = clampInt(raw.amount, 1, legal.maxRaiseTo, 0);
      if (amount < legal.minRaiseTo && amount !== legal.maxRaiseTo) {
        throw new ApiError(`Relance minimum : ${legal.minRaiseTo}`, 400);
      }
      action = { type: "raise", amount };
      break;
    }
    default:
      throw new ApiError("Action inconnue");
  }

  secret.game = applyAction(game, action);
  const state = await saveRoom(room, secret);
  return { state };
}

async function handleMyCards(body: Record<string, unknown>) {
  const { secret } = await loadRoom(body.code);
  const member = findMember(secret, body.token);
  const game = secret.game;
  if (!game) return { handNumber: 0, hole: [] };
  return { handNumber: game.handNumber, hole: game.players[member.id]?.hole ?? [] };
}

async function handleNextHand(body: Record<string, unknown>) {
  const { room, secret } = await loadRoom(body.code);
  findMember(secret, body.token);
  if (secret.phase !== "playing" || !secret.game) throw new ApiError("La partie n'est pas en cours", 400);
  // idempotent : si quelqu'un d'autre a déjà lancé la main suivante, on renvoie l'état actuel
  if (!secret.game.results) return { state: publicState(room.code, secret) };
  const alive = secret.game.players.filter((p) => p.chips > 0).length;
  if (alive < 2) {
    secret.phase = "over";
  } else {
    secret.game = startHand(secret.game);
  }
  const state = await saveRoom(room, secret);
  return { state };
}

async function handleState(body: Record<string, unknown>) {
  const { room, secret } = await loadRoom(body.code);
  return { state: publicState(room.code, secret) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method !== "POST") throw new ApiError("POST uniquement", 405);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new ApiError("Corps JSON invalide");

    let result: unknown;
    switch (body.op) {
      case "create":
        result = await handleCreate(body);
        break;
      case "join":
        result = await handleJoin(body);
        break;
      case "start":
        result = await handleStart(body);
        break;
      case "act":
        result = await handleAct(body);
        break;
      case "my_cards":
        result = await handleMyCards(body);
        break;
      case "next_hand":
        result = await handleNextHand(body);
        break;
      case "state":
        result = await handleState(body);
        break;
      default:
        throw new ApiError("Opération inconnue");
    }
    return new Response(JSON.stringify({ ok: true, ...(result as object) }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erreur interne";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
