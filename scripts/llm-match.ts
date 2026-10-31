// Full headless matches: an LLM General (local Ollama model) plays the AI side against scripted human bots,
// or head-to-head against the attack-every-turn control (--human control, the Gate 2 bar).
// The sim waits while the model thinks; its measured latency still costs game ticks (lockstep).
// Prints per-match results and the Gate 2 numbers (D-018): win rate, gap to the attack-every-turn
// control on the same seeds, invalid-command rate, p95 latency.
// Usage: npm run llm-match -- --model qwen3:8b [--matches 30] [--seed 1] [--human control|all|boom|rush|turtle] [--base boom]
//   [--minutes 20] [--think] [--chat] [--with-control] [--control] [--out results.json]
// --provider voxta-chat [--character name]: a Voxta character plays the General (D-023), one chat per match;
//   key (chat scope) from VOXTA_API_KEY; first character if --character is not given.
// --think: let a local model reason before answering (off by default, like the browser game; slow, most turns run late).
// --with-control: also play the control on the same seeds and report the gap. --control: control only, no model.
// --out: also save results, every General turn log and the summary as JSON (with game + data version).
// Gate 2 (D-018): npm run llm-match -- --human control --matches 30 --with-control. The control-vs-control
// baseline B absorbs faction balance; the LLM must win at least B + 15 points.
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createLlmBrain } from '../src/ai/llm/client.ts';
import { createVoxtaBrain, VOXTA_TURN_TIMEOUT } from '../src/ai/llm/voxta-brain.ts';
import { createVoxtaChat } from '../src/ai/llm/voxta-chat.ts';
import { clientFromArgs } from './llm-provider.ts';
import { createControl } from '../src/ai/llm/control.ts';
import { createGeneral, type TurnLog } from '../src/ai/llm/general.ts';
import { matchReport, type MatchRecord } from '../src/ai/llm/report.ts';
import { turnStats } from '../src/ai/llm/stats.ts';
import type { Controller } from '../src/ai/controller.ts';
import { createScriptedBot, STRATEGIES, type Strategy } from '../src/ai/scripted.ts';
import { runMatchAsync } from '../src/harness/match.ts';
import { TICK_RATE } from '../src/sim/index.ts';

const { values } = parseArgs({
  options: {
    provider: { type: 'string', default: 'ollama' },
    model: { type: 'string' },
    url: { type: 'string', default: process.env.OLLAMA_URL ?? 'http://localhost:11434' },
    matches: { type: 'string', default: '3' },
    seed: { type: 'string', default: '1' },
    human: { type: 'string', default: 'all' },
    base: { type: 'string', default: 'boom' },
    minutes: { type: 'string', default: '20' },
    think: { type: 'boolean', default: false },
    'no-think': { type: 'boolean', default: false },
    chat: { type: 'boolean', default: false },
    'with-control': { type: 'boolean', default: false },
    control: { type: 'boolean', default: false },
    out: { type: 'string' },
    character: { type: 'string' },
  },
});
const base = STRATEGIES[values.base];
interface Opponent { name: string; make: (seed: number) => Controller }
const scripted = (s: Strategy): Opponent => ({ name: s.name, make: (seed) => createScriptedBot('human', s, seed) });
const headToHead = values.human === 'control';
const opponents: Opponent[] | undefined = headToHead && base
  ? [{ name: 'control', make: (seed) => createControl('human', base, seed) }]
  : values.human === 'all' ? Object.values(STRATEGIES).map(scripted)
  : STRATEGIES[values.human] ? [scripted(STRATEGIES[values.human]!)] : undefined;
if (!base || !opponents) {
  console.error(`unknown strategy; choose from: control, all, ${Object.keys(STRATEGIES).join(', ')}`);
  process.exit(2);
}

// A Voxta character keeps its own chat per match, so it isn't an LlmClient; find the character once.
const voxtaChat = values.provider === 'voxta-chat';
const newChat = () => createVoxtaChat({ apiKey: process.env.VOXTA_API_KEY ?? '' });
let character: { id: string; name: string } | undefined;
if (voxtaChat) {
  const probe = newChat();
  const list = await probe.characters();
  probe.close();
  character = values.character ? list.find((c) => c.name === values.character) : list[0];
  if (!character) {
    console.error(`no Voxta character${values.character ? ` named "${values.character}"` : ''}; have: ${list.map((c) => c.name).join(', ')}`);
    process.exit(2);
  }
}
const llmClient = voxtaChat ? null : clientFromArgs(values);
const client = { name: llmClient?.name ?? `voxta-chat:${character!.name}` };
/** Called after each match: ends the match's Voxta chat. */
let endMatch = () => {};
const n = Number(values.matches);
const maxTicks = Number(values.minutes) * 60 * TICK_RATE;

/** Plays `n` seeds against one opponent and records each match. */
async function play(general: MatchRecord['general'], make: (seed: number) => Controller, human: Opponent, verbose: boolean): Promise<void> {
  for (let i = 0; i < n; i++) {
    const seed = Number(values.seed) + i;
    const ai = make(seed);
    const start = performance.now();
    const r = await runMatchAsync({ seed, maxTicks, human: human.make(seed), ai });
    endMatch();
    const log = verbose && 'log' in ai ? ai.log as TurnLog[] : [];
    records.push({ general, opponent: human.name, seed, winner: r.winner, ticks: r.ticks, turns: log });
    if (verbose && 'log' in ai) {
      const s = turnStats(log);
      console.log(`  ${human.name} seed ${seed}: winner=${r.winner ?? 'draw'} after ${(r.ticks / TICK_RATE / 60).toFixed(1)} min | ${s.turns} turns, `
        + `invalid ${s.invalidPct}%, fallbacks ${s.fallbacks.late}/${s.fallbacks.invalid}/${s.fallbacks.error} (late/invalid/error), p95 ${s.p95 ?? '-'} s | `
        + `${Math.round((performance.now() - start) / 1000)} s wall`);
      if (values.chat) for (const t of log) for (const m of t.chat) console.log(`    [${Math.trunc(t.tick / TICK_RATE)}s] ${m}`);
    }
  }
}

const records: MatchRecord[] = [];
const model = (seed: number) => {
  if (llmClient) return createGeneral('ai', createLlmBrain(llmClient, 'ai'), base, { seed, lockstep: true });
  const brain = createVoxtaBrain({ chat: newChat(), characterId: character!.id, faction: 'ai' });
  endMatch = () => brain.close();
  return createGeneral('ai', brain, base, { seed, lockstep: true, timeout: VOXTA_TURN_TIMEOUT });
};
const control = (seed: number) => createControl('ai', base, seed);
const runModel = !values.control;
const runControl = values.control || values['with-control'];
console.log(`${runModel ? client.name : 'control'} (base ${base.name}) vs ${opponents.map((o) => o.name).join(', ')}, ${n} seeds each`);
for (const human of opponents) {
  if (runModel) await play('llm', model, human, true);
  if (runControl) await play('control', control, human, false);
  const vs = matchReport({ model: null, options: {}, matches: records.filter((r) => r.opponent === human.name) }).summary;
  console.log(`vs ${human.name}: ${vs.llm ? `General ${vs.llm.winPct}%` : ''}${vs.llm && vs.control ? ' | ' : ''}${vs.control ? `control ${vs.control.winPct}%` : ''}`);
}
// The URL is left out of the saved options: it may carry credentials.
const { url: _url, ...options } = values;
const report = matchReport({ model: runModel ? client.name : null, options, matches: records });
const { llm, control: ctl, gap, stats: s } = report.summary;
if (llm && s) {
  console.log(`General ${llm.winPct}% overall | invalid-command rate ${s.invalidPct}% (${s.rejected}/${s.orders}) | latency p50 ${s.p50 ?? '-'} s, p95 ${s.p95 ?? '-'} s`);
}
if (ctl) console.log(`control ${ctl.winPct}% overall`);
if (llm && ctl) {
  console.log(headToHead
    ? `Gate 2 (D-018): LLM ${llm.winPct}% vs baseline B ${ctl.winPct}% = ${gap} points (need >= 15 on >= 30 seeds), invalid < 2%, p95 < 3 s`
    : `gap to control vs scripted bots: ${gap} points (secondary report; the Gate 2 bar is --human control)`);
}
if (values.out) {
  writeFileSync(values.out, JSON.stringify(report, null, 2) + '\n');
  console.log(`saved ${report.matches.length} matches to ${values.out} (game ${report.gameVersion}, data v${report.dataVersion})`);
}
