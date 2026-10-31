// Re-run a saved replay and print what happened: a timeline every 15 s (income, Data sources and any that
// aren't feeding home, armies, workers) plus the events in between (sites claimed, fiber lit, buildings
// built and destroyed, losses). A replay of an LLM General also lists its turns in between (#49).
// Usage: npm run replay -- path/to/replay.json [--every 15]
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  buildings, FACTIONS, runReplay, sourceIssue, TICK_RATE, UNITS, units, type Faction, type Game, type Replay,
} from '../src/sim/index.ts';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { every: { type: 'string', default: '15' } } });
const file = positionals[0];
if (!file) throw new Error('usage: npm run replay -- path/to/replay.json');
const replay = JSON.parse(readFileSync(file, 'utf8')) as Replay;
const every = Number(values.every) * TICK_RATE;
const clock = (t: number) => `${Math.trunc(t / TICK_RATE / 60)}:${String(Math.trunc(t / TICK_RATE) % 60).padStart(2, '0')}`;
const short = (id: string) => id.replace('data_source', 'src');

let owners = new Map<string, Faction | null>();
let lit = new Map<number, Faction | null>();
let alive = new Map<number, { f: Faction; type: string }>();
let built = new Map<number, string>();
let events: string[] = [];
const turns = [...(replay.general ?? [])];
const talk = [...(replay.talk ?? [])];

/** Player chat and the General's replies up to `tick` (D-027): talk only, never orders. */
function talkLines(tick: number): string[] {
  const out: string[] = [];
  while (talk.length && talk[0]!.tick <= tick) {
    const t = talk.shift()!;
    const said = t.text === null ? `(no reply${t.error ? `: ${t.error}` : ''})` : `"${t.text}"`;
    out.push(`        ${t.from === 'player' ? 'Player' : 'General'} @${clock(t.tick)}: ${said}`);
  }
  return out;
}

/** The General's turns up to `tick`: orders, errors, fallback and taunts, one line each. */
function generalLines(tick: number): string[] {
  const out: string[] = [];
  while (turns.length && turns[0]!.tick <= tick) {
    const t = turns.shift()!;
    const lat = t.latency === null ? 'no reply' : `${(t.latency / TICK_RATE).toFixed(1)} s`;
    // Taunts show as chat (filtered, as the player saw them), not as orders.
    const orders = t.orders.filter((o) => o.tool !== 'taunt').map((o) => `${o.tool}${Object.keys(o.args).length ? JSON.stringify(o.args) : ''}`).join(' ');
    const parts = [t.fallback ? `FALLBACK ${t.fallback}` : orders || 'no orders', ...t.errors.map((e) => `! ${e}`), ...t.chat.map((c) => `"${c}"`)];
    out.push(`        General @${clock(t.tick)} (${lat}): ${parts.join(' · ')}`);
  }
  return out;
}

function line(game: Game): string {
  const w = game.world;
  const parts = FACTIONS.map((f) => {
    const army = units(w).filter((u) => u.faction === f && UNITS[u.type].role !== 'worker');
    const value = army.reduce((a, u) => a + UNITS[u.type].cost / 1000, 0);
    const workers = units(w).filter((u) => u.faction === f && UNITS[u.type].role === 'worker').length;
    const srcs = [...w.sites.values()].filter((s) => s.kind === 'data_source' && s.owner === f);
    const dead = srcs.map((s) => [s, sourceIssue(w, s, f)] as const).filter(([, i]) => i).map(([s, i]) => `${short(s.id)}:${i}`);
    return `${f} inc ${((w.factions[f].income * TICK_RATE) / 1000).toFixed(1)}/s data ${Math.trunc(w.factions[f].data / 1000)}`
      + ` srcs ${srcs.length}${dead.length ? ` [${dead.join(' ')}]` : ''} army ${value} (${army.length}) workers ${workers}`;
  });
  const routers = [...w.sites.values()].filter((s) => s.kind === 'router' && s.owner).map((s) => `${s.id}=${s.owner}`).join(' ');
  return `${clock(w.tick)}  ${parts.join('  |  ')}  | routers: ${routers}`;
}

const game = runReplay(replay, (g) => {
  const w = g.world;
  for (const s of w.sites.values()) {
    if (owners.has(s.id) && owners.get(s.id) !== s.owner) events.push(`${s.owner ?? 'nobody'} took ${s.id}${owners.get(s.id) ? ` from ${owners.get(s.id)}` : ''}`);
  }
  owners = new Map([...w.sites.values()].map((s) => [s.id, s.owner]));
  for (const l of w.links) {
    if (lit.has(l.index) && lit.get(l.index) !== l.owner && l.owner) events.push(`${l.owner} lit ${l.a}-${l.b}`);
  }
  lit = new Map(w.links.map((l) => [l.index, l.owner]));
  const now = new Map(units(w).map((u) => [u.id, { f: u.faction, type: u.type }]));
  const lost: Record<string, number> = {};
  for (const [id, u] of alive) if (!now.has(id)) lost[`${u.f} ${u.type}`] = (lost[`${u.f} ${u.type}`] ?? 0) + 1;
  for (const [k, n] of Object.entries(lost)) events.push(`lost ${n} ${k}`);
  alive = now;
  const standing = new Map(buildings(w).map((b) => [b.id, `${b.faction} ${b.type}`]));
  for (const [id, name] of built) if (!standing.has(id)) events.push(`destroyed ${name}`);
  for (const b of buildings(w)) if (b.built && !built.has(b.id)) events.push(`built ${b.faction} ${b.type}`);
  built = new Map(buildings(w).filter((b) => b.built).map((b) => [b.id, `${b.faction} ${b.type}`]));
  if (w.tick % every === 0 || w.winner) {
    console.log(line(g));
    if (events.length) console.log(`        ${[...new Set(events)].join('; ')}`);
    for (const l of generalLines(w.tick)) console.log(l);
    for (const l of talkLines(w.tick)) console.log(l);
    events = [];
  }
});
console.log(`winner: ${game.world.winner ?? 'none'} at ${clock(game.world.tick)} (seed ${replay.seed}, ${replay.commands.length} commands)`);
const o = replay.opponent;
if (o) {
  const who = o.kind === 'llm' ? `LLM General (${o.model ?? '?'} via ${o.provider ?? '?'}, base ${o.strategy})` : `scripted ${o.strategy}`;
  const blind = o.blind ? ` · blind test, guessed ${o.guess ?? 'nothing'}${o.guess ? (o.guess === o.kind ? ' (right)' : ' (wrong)') : ''}` : '';
  console.log(`opponent: ${who}, difficulty ${o.difficulty}${blind}`);
}
if (replay.general) {
  const g = replay.general;
  const fell = g.filter((t) => t.fallback).length;
  const orders = g.reduce((a, t) => a + t.orders.length + t.rejected, 0);
  const rejected = g.reduce((a, t) => a + t.rejected, 0);
  console.log(`General: ${g.length} turns, ${fell} fallbacks, ${rejected}/${orders} orders rejected, ${g.reduce((a, t) => a + t.chat.length, 0)} taunts`);
}
