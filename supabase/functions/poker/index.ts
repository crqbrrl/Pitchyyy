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
  config: { chips: number; sb: number; bb: number; blindPeriod?: number; turnSeconds?: number };
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
// La version permet aux clients d'ignorer une réponse de sondage périmée.
function publicState(code: string, secret: Secret, version: number) {
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
    version,
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
    .select("id, code, version, room_secrets(secret)")
    .eq("code", normalized)
    .maybeSingle();
  if (!room) throw new ApiError("Salle introuvable — vérifie le code", 404);
  const embedded = room.room_secrets as { secret: Secret } | { secret: Secret }[] | null;
  const secretRow = Array.isArray(embedded) ? embedded[0] : embedded;
  if (!secretRow) throw new ApiError("Salle corrompue", 500);
  return { room: room as unknown as RoomRow, secret: secretRow.secret };
}

async function saveRoom(room: RoomRow, secret: Secret) {
  const state = publicState(room.code, secret, room.version + 1);
  // écriture atomique (état public + secret) avec verrou optimiste :
  // si quelqu'un a écrit entre-temps, on rejette et le client réessaie
  const { data: saved, error } = await supabase.rpc("save_room", {
    p_room_id: room.id,
    p_expected_version: room.version,
    p_state: state,
    p_secret: secret,
  });
  if (error) throw new ApiError(error.message, 500);
  if (!saved) throw new ApiError("Deux actions simultanées — réessaie", 409);
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
  const blindPeriod = clampInt(body.blindPeriod, 0, 100, 0); // 0 = blindes fixes
  const turnSeconds = clampInt(body.turnSeconds, 0, 300, 0); // 0 = pas de timer
  const token = crypto.randomUUID();
  const secret: Secret = {
    phase: "lobby",
    hostToken: token,
    config: { chips, sb, bb, blindPeriod, turnSeconds },
    members: [{ id: 0, name, token }],
    game: null,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const state = publicState(code, secret, 0);
    // insertion atomique rooms + room_secrets
    const { error } = await supabase.rpc("create_room", {
      p_code: code,
      p_state: state,
      p_secret: secret,
    });
    if (error) {
      if (error.code === "23505") continue; // collision de code, on retente
      throw new ApiError(error.message, 500);
    }
    return { code, playerId: 0, token, state };
  }
  throw new ApiError("Impossible de générer un code de salle", 500);
}

async function handleJoin(body: Record<string, unknown>) {
  const { room, secret } = await loadRoom(body.code);
  if (secret.phase !== "lobby") throw new ApiError("La partie a déjà commencé", 403);
  if (secret.members.length >= 8) throw new ApiError("Salle pleine (8 joueurs max)", 403);
  let name = cleanName(body.name);
  const baseName = name;
  for (let n = 2; secret.members.some((m) => m.name === name); n++) {
    const suffix = ` ${n}`;
    name = baseName.slice(0, 20 - suffix.length) + suffix;
  }
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
    secret.config.blindPeriod ?? 0,
  );
  secret.game.turnStartedAt = Date.now();
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
  secret.game.turnStartedAt = secret.game.toAct !== null ? Date.now() : null;
  const state = await saveRoom(room, secret);
  return { state };
}

// N'importe quel joueur de la salle peut signaler que le temps du joueur au
// tour est écoulé : le serveur vérifie l'horloge lui-même puis joue
// parole si possible, sinon se couche. Idempotent grâce au verrou de version.
async function handleTimeout(body: Record<string, unknown>) {
  const { room, secret } = await loadRoom(body.code);
  findMember(secret, body.token);
  if (secret.phase !== "playing" || !secret.game) throw new ApiError("La partie n'est pas en cours", 400);
  const game = secret.game;
  const turnSeconds = secret.config.turnSeconds ?? 0;
  if (turnSeconds <= 0) throw new ApiError("Pas de timer sur cette table", 400);
  if (game.results || game.toAct === null || !game.turnStartedAt) {
    return { state: publicState(room.code, secret, room.version) };
  }
  // 1 s de grâce pour absorber les décalages réseau
  if (Date.now() - game.turnStartedAt < (turnSeconds + 1) * 1000) {
    return { state: publicState(room.code, secret, room.version) };
  }
  const legal = legalActions(game)!;
  const slowName = game.players[game.toAct].name;
  secret.game = applyAction(game, legal.canCheck ? { type: "check" } : { type: "fold" });
  secret.game.lastAction = `⏱ Temps écoulé — ${slowName} ${legal.canCheck ? ": parole" : "se couche"}`;
  secret.game.turnStartedAt = secret.game.toAct !== null ? Date.now() : null;
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
  if (!secret.game.results) return { state: publicState(room.code, secret, room.version) };
  const alive = secret.game.players.filter((p) => p.chips > 0).length;
  if (alive < 2) {
    secret.phase = "over";
  } else {
    secret.game = startHand(secret.game);
    secret.game.turnStartedAt = secret.game.toAct !== null ? Date.now() : null;
  }
  const state = await saveRoom(room, secret);
  return { state };
}

async function handleState(body: Record<string, unknown>) {
  // chemin chaud (sondé toutes les 2 s par chaque joueur) : on lit directement
  // l'état public déjà matérialisé, sans toucher aux secrets
  if (typeof body.code !== "string" || !body.code.trim()) throw new ApiError("Code de salle manquant");
  const { data } = await supabase
    .from("rooms")
    .select("state")
    .eq("code", body.code.trim().toUpperCase())
    .maybeSingle();
  if (!data) throw new ApiError("Salle introuvable — vérifie le code", 404);
  return { state: data.state };
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
      case "timeout":
        result = await handleTimeout(body);
        break;
      case "state":
        result = await handleState(body);
        break;
      default:
        throw new ApiError("Opération inconnue");
    }
    // `now` permet aux clients de synchroniser le compte à rebours du timer
    return new Response(JSON.stringify({ ok: true, now: Date.now(), ...(result as object) }), {
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
