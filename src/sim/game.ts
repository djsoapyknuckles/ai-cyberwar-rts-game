// A running match: the world plus its tick-stamped command queue and log. Replay = seed + map + command log.
import { applyCommand, type Command } from './commands.ts';
import { updateEconomy } from './economy.ts';
import type { Faction } from './data.ts';
import { MAPS } from './map.ts';
import { step } from './step.ts';
import { createWorld, DATA_VERSION, GAME_VERSION, type World } from './world.ts';

export interface StampedCommand {
  /** Tick on which the command is applied (before that tick's simulation step). */
  tick: number;
  faction: Faction;
  command: Command;
}

export interface Game {
  world: World;
  pending: StampedCommand[];
  /** Every command that was applied successfully, in order. */
  log: StampedCommand[];
  /** Rejected commands with reasons (useful for debugging controllers and LLM output). */
  rejected: { cmd: StampedCommand; reason: string }[];
}

export interface Replay {
  gameVersion: string;
  dataVersion: number;
  seed: number;
  mapId: string;
  ticks: number;
  commands: StampedCommand[];
  /** Who played the AI side. Written by the browser for the record; not needed to re-run the match. */
  opponent?: OpponentInfo;
}

export interface OpponentInfo {
  kind: 'scripted' | 'llm';
  /** Scripted strategy, or the LLM General's base strategy. */
  strategy: string;
  model?: string;
  provider?: 'ollama' | 'openai' | 'voxta';
  /** A Voxta character playing the General (D-023), e.g. "The Model". */
  character?: string;
  difficulty: string;
  /** A blind test, and the player's guess if they made one before the reveal. */
  blind: boolean;
  guess?: 'llm' | 'scripted';
}

export function createGame(seed: number, mapId = 'duel'): Game {
  const map = MAPS[mapId];
  if (!map) throw new Error(`unknown map ${mapId}`);
  const world = createWorld(seed, map);
  // Derive power, compute and income up front so tick 0 reports real values.
  updateEconomy(world);
  return { world, pending: [], log: [], rejected: [] };
}

/** Queue a command to apply `delay` ticks from now (0 = before the next step). */
export function issue(game: Game, faction: Faction, command: Command, delay = 0): void {
  game.pending.push({ tick: game.world.tick + delay, faction, command });
}

/** Apply due commands in the order they were issued, then step the world once. */
export function advance(game: Game): void {
  const now = game.world.tick;
  const due: StampedCommand[] = [];
  const later: StampedCommand[] = [];
  for (const c of game.pending) (c.tick <= now ? due : later).push(c);
  game.pending = later;
  for (const c of due) {
    const stamped = { ...c, tick: now };
    const err = applyCommand(game.world, c.faction, c.command);
    if (err === null) game.log.push(stamped);
    else game.rejected.push({ cmd: stamped, reason: err });
  }
  step(game.world);
}

export function toReplay(game: Game): Replay {
  return {
    gameVersion: GAME_VERSION, dataVersion: DATA_VERSION, seed: game.world.seed,
    mapId: game.world.map.id, ticks: game.world.tick, commands: game.log,
  };
}

/**
 * Re-run a replay from scratch. Refuses replays recorded with different game data. `onTick` sees the
 * game after every tick (for analysis tools).
 */
export function runReplay(replay: Replay, onTick?: (game: Game) => void): Game {
  if (replay.dataVersion !== DATA_VERSION) {
    throw new Error(`replay data version ${replay.dataVersion} does not match game data version ${DATA_VERSION}`);
  }
  const game = createGame(replay.seed, replay.mapId);
  let i = 0;
  while (game.world.tick < replay.ticks) {
    while (i < replay.commands.length && replay.commands[i]!.tick === game.world.tick) {
      const c = replay.commands[i++]!;
      issue(game, c.faction, c.command);
    }
    advance(game);
    onTick?.(game);
  }
  return game;
}
