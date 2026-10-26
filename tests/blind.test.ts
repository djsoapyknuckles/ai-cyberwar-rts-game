import { describe, expect, it } from 'vitest';
import { loadTally, recordGuess, revealText, type TallyStorage } from '../src/render/blind.ts';
import { createScriptedBot, STRATEGIES } from '../src/ai/scripted.ts';
import { runMatch } from '../src/harness/match.ts';
import { hashWorld, runReplay, toReplay, type OpponentInfo } from '../src/sim/index.ts';

// Gate 2 blind test: the guess and the answer go on record, so no replay analysis is needed.
const mem = (): TallyStorage => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } }; };
const llm = (): OpponentInfo => ({ kind: 'llm', strategy: 'boom', model: 'qwen3:8b', provider: 'ollama', difficulty: 'hard', blind: true });

describe('blind test record', () => {
  it('counts guesses and right answers across matches, and says who it was', () => {
    const s = mem();
    const first = llm();
    expect(recordGuess(s, first, 'llm')).toEqual({ played: 1, correct: 1 });
    expect(first.guess).toBe('llm');
    expect(revealText(first, loadTally(s))).toBe('You played the LLM General (qwen3:8b). Your guess was right. Blind tests so far: 1 of 1 guessed right.');
    const second: OpponentInfo = { kind: 'scripted', strategy: 'boom', difficulty: 'hard', blind: true };
    expect(recordGuess(s, second, 'llm')).toEqual({ played: 2, correct: 1 });
    expect(revealText(second, loadTally(s))).toContain('the scripted boom bot. Your guess was wrong');
  });

  it('survives missing, corrupt or blocked storage', () => {
    const corrupt = mem();
    corrupt.setItem('cyberwar.blind-tally', '{"played":1,"correct":5}');
    expect(loadTally(corrupt)).toEqual({ played: 0, correct: 0 });
    const blocked: TallyStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(recordGuess(blocked, llm(), 'scripted')).toEqual({ played: 1, correct: 0 });
  });

  it('a replay with opponent info still re-runs to the same final state', () => {
    const { game } = runMatch({ seed: 4, maxTicks: 2 * 60 * 20, human: createScriptedBot('human', STRATEGIES.rush!, 4), ai: createScriptedBot('ai', STRATEGIES.boom!, 4) });
    const replay = JSON.parse(JSON.stringify({ ...toReplay(game), opponent: llm() }));
    expect(hashWorld(runReplay(replay).world)).toBe(hashWorld(game.world));
    expect(replay.opponent).toMatchObject({ kind: 'llm', blind: true });
  });
});
