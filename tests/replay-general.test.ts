import { describe, expect, it } from 'vitest';
import { createGeneral, turnRecords, type Brain } from '../src/ai/llm/general.ts';
import { createScriptedBot, STRATEGIES } from '../src/ai/scripted.ts';
import { runMatch } from '../src/harness/match.ts';
import { hashWorld, runReplay, toReplay, type Replay } from '../src/sim/index.ts';

// #49: a saved replay keeps what the LLM General decided and said, not only the commands it caused.
const boom = STRATEGIES.boom!;
const turnOf = (...orders: unknown[]) => JSON.stringify({ orders });

describe('replay with the General turn log', () => {
  it('saves every turn (orders, errors, fallback, filtered chat) and still re-runs to the same state', () => {
    const brain: Brain = ({ tick }) => tick === 0 ? turnOf({ tool: 'expand', args: {} }, { tool: 'taunt', args: { message: 'hello,\u0007 meat' } })
      : tick < 1000 ? turnOf({ tool: 'launch_nukes', args: {} })
      : null;
    const general = createGeneral('ai', brain, boom, { seed: 5 });
    const { game } = runMatch({ seed: 5, maxTicks: 2 * 60 * 20, human: createScriptedBot('human', boom, 5), ai: general });
    const general_ = turnRecords(general.log);
    const replay = JSON.parse(JSON.stringify({ ...toReplay(game), general: general_ })) as Replay;

    expect(hashWorld(runReplay(replay).world)).toBe(hashWorld(game.world));
    expect(replay.general).toEqual(general_);
    expect(replay.general).toHaveLength(general.log.length);
    const [first, second, last] = [replay.general![0]!, replay.general![1]!, replay.general!.at(-1)!];
    expect(first).toMatchObject({ tick: 0, orders: [{ tool: 'expand', args: {} }, { tool: 'taunt', args: { message: 'hello,\u0007 meat' } }], fallback: null, chat: ['hello, meat'] });
    expect(first.latency).toBeGreaterThan(0);
    expect(second).toMatchObject({ orders: [], rejected: 1, fallback: 'invalid' });
    expect(second.errors[0]).toContain('launch_nukes');
    expect(last).toMatchObject({ latency: null, fallback: 'late' });
    // The raw reply is left out: it can be long, and the orders already say what it meant.
    expect(Object.keys(first)).not.toContain('reply');
  });

  it('a replay without the turn log still loads', () => {
    const { game } = runMatch({ seed: 4, maxTicks: 60 * 20, human: createScriptedBot('human', boom, 4), ai: createScriptedBot('ai', boom, 4) });
    const replay = JSON.parse(JSON.stringify(toReplay(game))) as Replay;
    expect(replay.general).toBeUndefined();
    expect(hashWorld(runReplay(replay).world)).toBe(hashWorld(game.world));
  });
});
