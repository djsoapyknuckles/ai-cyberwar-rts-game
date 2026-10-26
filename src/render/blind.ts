// Blind test (Gate 2): after the match the player guesses who they played before the reveal, and the
// game keeps a running tally, so the result is on record without analyzing replays.
import type { OpponentInfo } from '../sim/index.ts';

export interface BlindTally { played: number; correct: number }

const KEY = 'cyberwar.blind-tally';
/** The parts of Web Storage this needs; every call may throw (private mode), so all are guarded. */
export interface TallyStorage { getItem(k: string): string | null; setItem(k: string, v: string): void }

export function loadTally(s: TallyStorage): BlindTally {
  try {
    const t = JSON.parse(s.getItem(KEY) ?? 'null') as Partial<BlindTally> | null;
    const ok = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
    return t && ok(t.played) && ok(t.correct) && t.correct! <= t.played! ? { played: t.played!, correct: t.correct! } : { played: 0, correct: 0 };
  } catch { return { played: 0, correct: 0 }; }
}

/** Records one guess against the truth and returns the new tally. */
export function recordGuess(s: TallyStorage, opponent: OpponentInfo, guess: 'llm' | 'scripted'): BlindTally {
  opponent.guess = guess;
  const t = loadTally(s);
  const next = { played: t.played + 1, correct: t.correct + (guess === opponent.kind ? 1 : 0) };
  try { s.setItem(KEY, JSON.stringify(next)); } catch { /* not saved: the tally covers this match only */ }
  return next;
}

/** Text for the reveal, after the guess. */
export function revealText(opponent: OpponentInfo, tally: BlindTally): string {
  const who = opponent.kind === 'llm' ? `the LLM General (${opponent.model ?? 'unknown model'})` : `the scripted ${opponent.strategy} bot`;
  const right = opponent.guess === opponent.kind;
  return `You played ${who}. Your guess was ${right ? 'right' : 'wrong'}. Blind tests so far: ${tally.correct} of ${tally.played} guessed right.`;
}
