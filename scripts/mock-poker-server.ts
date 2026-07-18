// Serveur miroir de l'edge function Supabase pour les tests locaux :
// même API, même moteur, stockage en mémoire.
// Lancement : npx tsx scripts/mock-poker-server.ts  (port 8787)
import express from "express";
import {
  Action,
  GameState,
  applyAction,
  createGame,
  legalActions,
  startHand,
} from "../src/poker/engine.ts";

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

class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const rooms = new Map<string, Secret>();
const versions = new Map<string, number>();
const bump = (code: string) => versions.set(code, (versions.get(code) ?? 0) + 1);

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return rooms.has(code) ? genCode() : code;
}

function publicState(code: string, secret: Secret) {
  let game: GameState | null = null;
  if (secret.game) {
    game = JSON.parse(JSON.stringify(secret.game)) as GameState;
    game.deck = [];
    for (const p of game.players) p.hole = [];
  }
  return {
    code,
    version: versions.get(code) ?? 0,
    phase: secret.phase,
    config: secret.config,
    members: secret.members.map((m) => ({ id: m.id, name: m.name })),
    game,
  };
}

function loadRoom(code: unknown): { code: string; secret: Secret } {
  if (typeof code !== "string" || !code.trim()) throw new ApiError("Code de salle manquant");
  const normalized = code.trim().toUpperCase();
  const secret = rooms.get(normalized);
  if (!secret) throw new ApiError("Salle introuvable — vérifie le code", 404);
  return { code: normalized, secret };
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

const handlers: Record<string, (body: Record<string, unknown>) => unknown> = {
  create(body) {
    const name = cleanName(body.name);
    const chips = clampInt(body.chips, 20, 1_000_000, 1000);
    const sb = clampInt(body.sb, 1, Math.floor(chips / 2), 10);
    const bb = clampInt(body.bb, sb, Math.floor(chips / 2), Math.min(sb * 2, Math.floor(chips / 2)));
    const token = crypto.randomUUID();
    const code = genCode();
    const secret: Secret = {
      phase: "lobby",
      hostToken: token,
      config: { chips, sb, bb },
      members: [{ id: 0, name, token }],
      game: null,
    };
    rooms.set(code, secret);
    versions.set(code, 0);
    return { code, playerId: 0, token, state: publicState(code, secret) };
  },
  join(body) {
    const { code, secret } = loadRoom(body.code);
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
    bump(code);
    return { code, playerId: member.id, token, state: publicState(code, secret) };
  },
  start(body) {
    const { code, secret } = loadRoom(body.code);
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
    bump(code);
    return { state: publicState(code, secret) };
  },
  act(body) {
    const { code, secret } = loadRoom(body.code);
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
    bump(code);
    return { state: publicState(code, secret) };
  },
  my_cards(body) {
    const { secret } = loadRoom(body.code);
    const member = findMember(secret, body.token);
    const game = secret.game;
    if (!game) return { handNumber: 0, hole: [] };
    return { handNumber: game.handNumber, hole: game.players[member.id]?.hole ?? [] };
  },
  next_hand(body) {
    const { code, secret } = loadRoom(body.code);
    findMember(secret, body.token);
    if (secret.phase !== "playing" || !secret.game) throw new ApiError("La partie n'est pas en cours", 400);
    if (!secret.game.results) return { state: publicState(code, secret) };
    const alive = secret.game.players.filter((p) => p.chips > 0).length;
    if (alive < 2) {
      secret.phase = "over";
    } else {
      secret.game = startHand(secret.game);
    }
    bump(code);
    return { state: publicState(code, secret) };
  },
  state(body) {
    const { code, secret } = loadRoom(body.code);
    return { state: publicState(code, secret) };
  },
};

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  next();
});
app.options("*", (_req, res) => res.send("ok"));
app.post("*", (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const handler = handlers[body?.op as string];
    if (!handler) throw new ApiError("Opération inconnue");
    res.json({ ok: true, ...(handler(body) as object) });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    res.status(status).json({ ok: false, error: err instanceof Error ? err.message : "Erreur interne" });
  }
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`Mock poker API sur http://127.0.0.1:${port}`));
