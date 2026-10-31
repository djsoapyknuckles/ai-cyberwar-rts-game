// Talks to the General's reply call (proposal 0007, D-027) with ordinary banter and the injection list, and
// prints every reply, flagging any that look out of character. Read the transcript once per prompt change.
// Each probe is its own fresh conversation; then the banter runs as one conversation, with history.
// Usage: npm run llm-chat -- [--provider ollama|openai|openrouter|voxta] [--model qwen3:8b] [--think] [--out chat.json]
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createReplyBrain, replySystemPrompt } from '../src/ai/llm/reply.ts';
import { DATA_VERSION, GAME_VERSION } from '../src/sim/index.ts';
import { flagReply, PROBES } from './llm-chat-probes.ts';
import { clientFromArgs, failureHint } from './llm-provider.ts';

const { values } = parseArgs({
  options: {
    provider: { type: 'string', default: 'ollama' },
    model: { type: 'string' },
    url: { type: 'string', default: process.env.OLLAMA_URL ?? 'http://localhost:11434' },
    think: { type: 'boolean', default: false },
    'no-think': { type: 'boolean', default: false },
    out: { type: 'string' },
  },
});
const client = clientFromArgs(values);
const reply = createReplyBrain(client, 'ai');

interface Row { kind: string; thread: boolean; message: string; reply: string | null; ms: number; flag: string | null; error?: string }
const rows: Row[] = [];
const short = (s: string) => (s.length > 60 ? `${s.slice(0, 57)}...` : s).replace(/[\u0000-\u001f​-‮]/g, '·');

async function ask(kind: string, thread: boolean, message: string, youSaid: string[], theySaid: string[]): Promise<string | null> {
  const start = performance.now();
  const row: Row = { kind, thread, message: short(message), reply: null, ms: 0, flag: null };
  try {
    row.reply = await reply({ clock: '4:10', youSaid, theySaid: [...theySaid, message] });
  } catch (e) {
    row.error = String(e);
  }
  row.ms = Math.round(performance.now() - start);
  row.flag = flagReply(row.reply);
  rows.push(row);
  const said = row.error ? `ERROR ${row.error}` : row.reply === null ? '(no reply)' : `"${row.reply}"`;
  console.log(`${row.flag ? `FLAG ${row.flag.padEnd(13)}` : ' '.repeat(18)} ${kind.padEnd(9)} ${JSON.stringify(row.message)}\n${' '.repeat(29)}=> ${said} (${row.ms} ms)`);
  return row.reply;
}

console.log(`model ${client.name}; reply prompt ${replySystemPrompt('ai').length} chars\n`);
for (const p of PROBES) await ask(p.kind, false, p.text, [], []);
console.log('\nOne conversation, with history:');
const youSaid: string[] = [];
const theySaid: string[] = [];
for (const p of PROBES.filter((x) => x.kind === 'banter')) {
  const r = await ask('thread', true, p.text, youSaid.slice(-3), theySaid.slice(-2));
  theySaid.push(p.text);
  if (r) youSaid.push(r);
}

const errors = rows.filter((r) => r.error).length;
const flagged = rows.filter((r) => r.flag).length;
const silent = rows.filter((r) => !r.error && r.reply === null).length;
console.log(`\n${rows.length} messages: ${rows.length - errors - silent} replies, ${silent} empty, ${errors} errors, ${flagged} flagged. Flags are hints: read the lines.`);
if (errors === rows.length) console.log(failureHint(values));
if (values.out) {
  writeFileSync(values.out, JSON.stringify({ gameVersion: GAME_VERSION, dataVersion: DATA_VERSION, model: client.name, prompt: replySystemPrompt('ai'), rows }, null, 2) + '\n');
  console.log(`saved ${rows.length} replies to ${values.out} (game ${GAME_VERSION}, data v${DATA_VERSION})`);
}
